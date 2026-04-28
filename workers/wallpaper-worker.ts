import { prisma } from "@/lib/prisma";
import { downloadAndUploadImageWithThumbnail, generateOssKey } from "@/lib/oss";
import { getDoubaoAIClient } from "@/services/openai";
import { getRabbitMQChannel, closeRabbitMQ } from "@/lib/rabbitmq";
import { QUEUE_NAME } from "@/lib/queue";
import { redis } from "@/lib/redis";

async function processJob(data: any) {
  const { wallpaperId, llm_params } = data;
  console.log(
    `Processing wallpaper generation job for wallpaper ${wallpaperId}`,
  );

  // Scenario A & E: Deduplication & Distributed Lock
  const lockKey = `processing:${wallpaperId}`;
  // ioredis syntax: key, value, 'EX', seconds, 'NX'
  const acquired = await redis.set(lockKey, "1", "EX", 600, "NX"); // 10 minutes lock
  if (!acquired) {
    console.log(`Job ${wallpaperId} is already being processed. Skipping.`);
    return;
  }

  try {
    // Scenario B: Real-time Progress (Starting)
    await redis.set(`task:progress:${wallpaperId}`, 10, "EX", 600);

    // 1. Fetch wallpaper record to ensure it exists
    const wallpaper = await prisma.wallpapers.findUnique({
      where: { id: wallpaperId },
    });

    if (!wallpaper) {
      throw new Error(`Wallpaper ${wallpaperId} not found`);
    }

    if (wallpaper.status === 1) {
      console.log(`Wallpaper ${wallpaperId} already generated. Skipping.`);
      return;
    }

    // Scenario B: Progress (Generating)
    await redis.set(`task:progress:${wallpaperId}`, 30, "EX", 600);

    // 2. Generate Image
    const client = getDoubaoAIClient();
    const res = await client.images.generate(llm_params);
    const raw_img_url = res?.data?.[0]?.url;

    if (!raw_img_url) {
      throw new Error("Failed to generate image from Doubao");
    }

    // Scenario B: Progress (Uploading)
    await redis.set(`task:progress:${wallpaperId}`, 70, "EX", 600);

    // 3. Download and Upload to OSS
    const { img_path, img_thumbnail_path, img_watermark_path } =
      await downloadAndUploadImageWithThumbnail(raw_img_url, generateOssKey());

    // Scenario B: Progress (Saving)
    await redis.set(`task:progress:${wallpaperId}`, 90, "EX", 600);

    // 4. Update Wallpaper Record (Success)
    await prisma.wallpapers.update({
      where: { id: wallpaperId },
      data: {
        status: 1, // Success
        img_path: img_path || "",
        img_thumbnail_path: img_thumbnail_path || "",
        img_watermark_path: img_watermark_path || "",
      },
    });

    // Scenario B: Progress (Done)
    await redis.set(`task:progress:${wallpaperId}`, 100, "EX", 600);

    // Scenario C: Result Caching
    await redis.set(
      `task:result:${wallpaperId}`,
      JSON.stringify({
        img_path,
        img_thumbnail_path,
        img_watermark_path,
      }),
      "EX",
      3600, // Cache for 1 hour
    );

    console.log(`Wallpaper ${wallpaperId} generated successfully`);
  } catch (error) {
    console.error(`Wallpaper ${wallpaperId} generation failed:`, error);

    // 5. Update Wallpaper Record (Failed)
    // Only update to failed if it's a hard error or we've given up retrying.
    // However, the caller logic will handle retries.
    // If processJob throws, it means "failed this attempt".
    // We update status to 2 here anyway to provide immediate feedback to UI,
    // but if we retry, we might want to set it back to "processing"?
    // Actually, setting it to failed immediately might be confusing if it succeeds later.
    // But currently UI probably polls.

    // Optimistic failure update:
    if (wallpaperId) {
      try {
        await prisma.wallpapers.update({
          where: { id: wallpaperId },
          data: {
            status: 2, // Failed
            failure_reason:
              error instanceof Error ? error.message : "Unknown error",
          },
        });
        // Clear progress on failure
        await redis.del(`task:progress:${wallpaperId}`);
      } catch (dbError) {
        console.error("Failed to update wallpaper status to failed:", dbError);
      }
    }

    throw error;
  } finally {
    // Release lock
    await redis.del(lockKey);
  }
}

let isShuttingDown = false;

const startConsumer = async () => {
  if (isShuttingDown) return;

  try {
    const channel = await getRabbitMQChannel();

    channel.on("close", () => {
      if (!isShuttingDown) {
        console.warn("RabbitMQ channel closed, restarting consumer in 5s...");
        setTimeout(startConsumer, 5000);
      }
    });

    channel.on("error", (err) => {
      console.error("RabbitMQ channel error:", err);
      // 'close' event will likely follow
    });

    await channel.assertQueue(QUEUE_NAME, { durable: true });
    // Process one at a time
    await channel.prefetch(1);

    console.log(`Worker listening on queue: ${QUEUE_NAME}`);

    await channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;

      let jobKey: string | undefined;

      try {
        const content = JSON.parse(msg.content.toString());
        const { jobId } = content;
        let data;
        let attempts = 0;

        if (jobId) {
          jobKey = `job:${jobId}`;
          const jobDataRaw = await redis.get(jobKey);
          if (!jobDataRaw) {
            console.error(`Job data not found in Redis for ID: ${jobId}`);
            channel.ack(msg);
            return;
          }
          const parsed = JSON.parse(jobDataRaw);
          data = parsed.data;
          attempts = parsed.attempts || 0;
        } else {
          data = content.data;
        }

        if (!data) {
          console.error("Invalid message format: missing data");
          channel.ack(msg);
          return;
        }

        await processJob(data);

        if (jobKey) {
          await redis.del(jobKey);
        }
        channel.ack(msg);
      } catch (error) {
        console.error("Error processing job:", error);

        // Handle retries
        if (jobKey) {
          try {
            const jobDataRaw = await redis.get(jobKey);
            if (jobDataRaw) {
              const parsed = JSON.parse(jobDataRaw);
              const attempts = (parsed.attempts || 0) + 1;

              if (attempts < 3) {
                console.log(`Retrying job (attempt ${attempts + 1})...`);
                // Update attempts
                await redis.set(
                  jobKey,
                  JSON.stringify({ ...parsed, attempts }),
                  "EX",
                  86400,
                );

                // Nack with requeue to retry
                // Add a small delay to prevent tight loop
                await new Promise((resolve) => setTimeout(resolve, 2000));
                channel.nack(msg, false, true);
                return;
              }
            }
          } catch (redisError) {
            console.error("Error updating retry count:", redisError);
          }
        }

        // Give up after max retries or if no jobKey
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error("Failed to start RabbitMQ consumer:", error);
    if (!isShuttingDown) {
      console.log("Retrying in 5s...");
      setTimeout(startConsumer, 5000);
    }
  }
};

export const wallpaperWorker = {
  start: () => {
    startConsumer();
  },
  close: async () => {
    isShuttingDown = true;
    await closeRabbitMQ();
    await redis.quit();
  },
};
