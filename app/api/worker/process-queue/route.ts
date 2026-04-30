import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadAndUploadImageWithThumbnail, generateOssKey } from "@/lib/oss";
import { getDoubaoAIClient } from "@/services/openai";
import { getRabbitMQChannel, closeRabbitMQ } from "@/lib/rabbitmq";
import { redis } from "@/lib/redis";
import { QUEUE_WALLPAPER_GENERATION, redisKeys, redisTTL } from "@/lib/constants";

// Vercel Cron Job secret validation
function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

async function processJob(data: any) {
  const { wallpaperId, llm_params } = data;

  const lockKey = redisKeys.wallpaperProcessingLock(wallpaperId);
  const acquired = await redis.set(lockKey, "1", "EX", redisTTL.processingLock, "NX");
  if (!acquired) {
    console.log(`Job ${wallpaperId} is already being processed. Skipping.`);
    return;
  }

  try {
    await redis.set(redisKeys.taskProgress(wallpaperId), 10, "EX", redisTTL.taskProgress);

    const wallpaper = await prisma.wallpapers.findUnique({
      where: { id: wallpaperId },
    });

    if (!wallpaper) throw new Error(`Wallpaper ${wallpaperId} not found`);
    if (wallpaper.status === 1) {
      console.log(`Wallpaper ${wallpaperId} already generated. Skipping.`);
      return;
    }

    await redis.set(redisKeys.taskProgress(wallpaperId), 30, "EX", redisTTL.taskProgress);

    const client = getDoubaoAIClient();
    const res = await client.images.generate(llm_params);
    const raw_img_url = res?.data?.[0]?.url;

    if (!raw_img_url) throw new Error("Failed to generate image from Doubao");

    await redis.set(redisKeys.taskProgress(wallpaperId), 70, "EX", redisTTL.taskProgress);

    const { img_path, img_thumbnail_path, img_watermark_path } =
      await downloadAndUploadImageWithThumbnail(raw_img_url, generateOssKey());

    await redis.set(redisKeys.taskProgress(wallpaperId), 90, "EX", redisTTL.taskProgress);

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

    console.log(`Wallpaper ${wallpaperId} generated successfully`);
  } catch (error) {
    console.error(`Wallpaper ${wallpaperId} generation failed:`, error);
    if (wallpaperId) {
      try {
        await prisma.wallpapers.update({
          where: { id: wallpaperId },
          data: {
            status: 2,
            failure_reason:
              error instanceof Error ? error.message : "Unknown error",
          },
        });
        await redis.del(redisKeys.taskProgress(wallpaperId));
      } catch (dbError) {
        console.error("Failed to update wallpaper status to failed:", dbError);
      }
    }
    throw error;
  } finally {
    await redis.del(lockKey);
  }
}

// Process up to N messages per cron invocation to stay within function timeout
const MAX_JOBS_PER_RUN = 3;

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { wallpaperId: string; status: "ok" | "error" }[] = [];
  let channel: Awaited<ReturnType<typeof getRabbitMQChannel>> | null = null;

  try {
    channel = await getRabbitMQChannel();
    await channel.assertQueue(QUEUE_WALLPAPER_GENERATION, { durable: true });

    for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
      const msg = await channel.get(QUEUE_WALLPAPER_GENERATION, { noAck: false });
      if (!msg) break; // queue empty

      let jobKey: string | undefined;

      try {
        const content = JSON.parse(msg.content.toString());
        const { jobId } = content;
        let data;
        let attempts = 0;

        if (jobId) {
          jobKey = redisKeys.jobData(jobId);
          const jobDataRaw = await redis.get(jobKey);
          if (!jobDataRaw) {
            console.error(`Job data not found in Redis for ID: ${jobId}`);
            channel.ack(msg);
            continue;
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
          continue;
        }

        await processJob(data);

        if (jobKey) await redis.del(jobKey);
        channel.ack(msg);
        results.push({ wallpaperId: data.wallpaperId, status: "ok" });
      } catch (error) {
        console.error("Error processing job:", error);

        if (jobKey) {
          try {
            const jobDataRaw = await redis.get(jobKey);
            if (jobDataRaw) {
              const parsed = JSON.parse(jobDataRaw);
              const attempts = (parsed.attempts || 0) + 1;

              if (attempts < 3) {
                await redis.set(
                  jobKey,
                  JSON.stringify({ ...parsed, attempts }),
                  "EX",
                  redisTTL.jobData,
                );
                channel.nack(msg, false, true);
                continue;
              }
            }
          } catch (redisError) {
            console.error("Error updating retry count:", redisError);
          }
        }

        channel.ack(msg);
        results.push({
          wallpaperId: (JSON.parse(msg.content.toString()) as any)?.data
            ?.wallpaperId,
          status: "error",
        });
      }
    }
  } catch (error) {
    console.error("Worker cron error:", error);
    return NextResponse.json(
      { error: "Worker failed", detail: String(error) },
      { status: 500 },
    );
  } finally {
    await closeRabbitMQ();
  }

  return NextResponse.json({ processed: results.length, results });
}
