import { prisma } from "@/lib/prisma";
import { downloadAndUploadImageWithThumbnail, generateOssKey } from "@/lib/oss";
import { getDoubaoAIClient } from "@/services/openai";
import { getRabbitMQChannel, closeRabbitMQ } from "@/lib/rabbitmq";
import { redis } from "@/lib/redis";
import { wallpaperStatusChannel } from "@/lib/redis-subscriber";
import { QUEUE_WALLPAPER_GENERATION, redisKeys, redisTTL } from "@/lib/constants";

async function processJob(data: any) {
  const { wallpaperId, llm_params } = data;
  console.log(
    `Processing wallpaper generation job for wallpaper ${wallpaperId}`,
  );

  // Scenario A & E: Deduplication & Distributed Lock
  const lockKey = redisKeys.wallpaperProcessingLock(wallpaperId);
  const acquired = await redis.set(lockKey, "1", "EX", redisTTL.processingLock, "NX");
  if (!acquired) {
    console.log(`Job ${wallpaperId} is already being processed. Skipping.`);
    return;
  }

  let wallpaperUserId: number | undefined;

  try {
    await redis.set(redisKeys.taskProgress(wallpaperId), 10, "EX", redisTTL.taskProgress);

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

    wallpaperUserId = wallpaper.user_id;

    await redis.set(redisKeys.taskProgress(wallpaperId), 30, "EX", redisTTL.taskProgress);

    // 2. Generate Image
    const client = getDoubaoAIClient();
    const res = await client.images.generate(llm_params);
    const raw_img_url = res?.data?.[0]?.url;

    if (!raw_img_url) {
      throw new Error("Failed to generate image from Doubao");
    }

    await redis.set(redisKeys.taskProgress(wallpaperId), 70, "EX", redisTTL.taskProgress);

    // 3. Download and Upload to OSS
    const { img_path, img_thumbnail_path, img_watermark_path } =
      await downloadAndUploadImageWithThumbnail(raw_img_url, generateOssKey());

    await redis.set(redisKeys.taskProgress(wallpaperId), 90, "EX", redisTTL.taskProgress);

    // 4. Update Wallpaper Record (Success)
    await prisma.wallpapers.update({
      where: { id: wallpaperId },
      data: {
        status: 1,
        img_path: img_path || "",
        img_thumbnail_path: img_thumbnail_path || "",
        img_watermark_path: img_watermark_path || "",
      },
    });

    await redis.set(redisKeys.taskProgress(wallpaperId), 100, "EX", redisTTL.taskProgress);
    await redis.set(
      redisKeys.taskResult(wallpaperId),
      JSON.stringify({ img_path, img_thumbnail_path, img_watermark_path }),
      "EX",
      3600,
    );

    await redis.publish(
      wallpaperStatusChannel(wallpaperUserId),
      JSON.stringify({ wallpaperId, status: 1, img_path, img_thumbnail_path, img_watermark_path }),
    );

    console.log(`Wallpaper ${wallpaperId} generated successfully`);
  } catch (error) {
    console.error(`Wallpaper ${wallpaperId} generation failed:`, error);

    if (wallpaperId) {
      try {
        const failureReason = error instanceof Error ? error.message : "Unknown error";
        await prisma.wallpapers.update({
          where: { id: wallpaperId },
          data: {
            status: 2,
            failure_reason: failureReason,
          },
        });
        await redis.del(redisKeys.taskProgress(wallpaperId));

        if (wallpaperUserId !== undefined) {
          await redis.publish(
            wallpaperStatusChannel(wallpaperUserId),
            JSON.stringify({ wallpaperId, status: 2, failure_reason: failureReason }),
          );
        }
      } catch (dbError) {
        console.error("Failed to update wallpaper status to failed:", dbError);
      }
    }

    throw error;
  } finally {
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

    await channel.assertQueue(QUEUE_WALLPAPER_GENERATION, { durable: true });
    await channel.prefetch(1);

    console.log(`Worker listening on queue: ${QUEUE_WALLPAPER_GENERATION}`);

    await channel.consume(QUEUE_WALLPAPER_GENERATION, async (msg) => {
      if (!msg) return;

      let jobKey: string | undefined;

      try {
        const content = JSON.parse(msg.content.toString());
        const { jobId } = content;
        let data;

        if (jobId) {
          jobKey = redisKeys.jobData(jobId);
          const jobDataRaw = await redis.get(jobKey);
          if (!jobDataRaw) {
            console.error(`Job data not found in Redis for ID: ${jobId}`);
            channel.ack(msg);
            return;
          }
          const parsed = JSON.parse(jobDataRaw);
          data = parsed.data;
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
                  redisTTL.jobData,
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
