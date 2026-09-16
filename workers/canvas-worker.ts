import { prisma } from "@/lib/prisma";
import { getRabbitMQChannel, closeRabbitMQ } from "@/lib/rabbitmq";
import { redis } from "@/lib/redis";
import { canvasQueue } from "@/lib/queue";
import { QUEUE_CANVAS_STEP, redisKeys, redisTTL } from "@/lib/constants";
import { executeNodeStep, pollProviderJob, NormalizedStepError } from "@/services/canvas-executor";
import {
  claimDueProviderJobs,
  enqueueReadySteps,
  recoverInterruptedWork,
  skipDownstreamSteps,
} from "@/lib/canvas/orchestrator";
import { completeStepRun, failStepRun } from "@/models/canvas";

/**
 * 画布执行 Worker：
 * - execute-step 消息：认领并执行一个步骤（视频步骤只提交供应商任务）；
 * - poll-provider-job 消息：轮询一条供应商任务并推进状态；
 * - poller 扫描器：周期认领到期供应商任务投递轮询消息（租约防重复）；
 * - 启动时恢复中断的工作（技术方案 §十四点三）。
 */

async function processExecuteStep(data: any) {
  const { stepRunId, executionId, nodeId } = data;
  if (!stepRunId || !executionId || !nodeId) {
    throw new Error("INVALID_STEP_PAYLOAD");
  }

  // CAS 认领：重复投递时只有一个消费者能 queued → running
  const claimed = await prisma.step_runs.updateMany({
    where: { id: stepRunId, status: "queued" },
    data: { status: "running", updated_at: new Date() },
  });
  if (claimed.count === 0) return; // 已处理 / 已取消 / 重复投递

  const stepRun = await prisma.step_runs.findUnique({
    where: { id: stepRunId },
    include: { execution: true },
  });
  if (!stepRun) return;

  try {
    const result = await executeNodeStep({
      id: stepRun.id,
      node_id: stepRun.node_id,
      execution_id: stepRun.execution_id,
      execution: stepRun.execution,
    });

    if (result.asyncJob) {
      // 供应商任务已提交：步骤保持 running，由 poller 驱动至终态
      return;
    }

    await completeStepRun(stepRunId, result.output, result.cost);
  } catch (error) {
    const code = error instanceof NormalizedStepError ? error.code : "PROVIDER_ERROR";
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`step ${stepRunId} failed:`, code, message);

    await failStepRun(stepRunId, code, message);
    // 只跳过受影响的传递下游，独立分支继续执行
    await skipDownstreamSteps(executionId, nodeId);
  }

  await enqueueReadySteps(executionId);
}

async function processPollJob(data: any) {
  const { providerJobId } = data;
  if (!providerJobId) throw new Error("INVALID_POLL_PAYLOAD");
  await pollProviderJob(Number(providerJobId));
}

const POLLER_INTERVAL_MS = 3000;
let pollerTimer: ReturnType<typeof setInterval> | null = null;

async function pollerTick() {
  try {
    const jobIds = await claimDueProviderJobs(20);
    for (const id of jobIds) {
      await canvasQueue.add("poll-provider-job", { providerJobId: id });
    }
  } catch (e) {
    console.error("poller tick failed:", e);
  }
}

let isShuttingDown = false;

const startConsumer = async () => {
  if (isShuttingDown) return;

  try {
    const channel = await getRabbitMQChannel();

    channel.on("close", () => {
      if (!isShuttingDown) {
        console.warn("RabbitMQ channel closed, restarting canvas consumer in 5s...");
        setTimeout(startConsumer, 5000);
      }
    });
    channel.on("error", (err) => {
      console.error("RabbitMQ channel error:", err);
    });

    await channel.assertQueue(QUEUE_CANVAS_STEP, { durable: true });
    await channel.prefetch(2);
    console.log(`Canvas worker listening on queue: ${QUEUE_CANVAS_STEP}`);

    // 启动恢复：崩溃前中断的步骤与供应商任务
    try {
      await recoverInterruptedWork();
    } catch (e) {
      console.error("canvas recovery failed:", e);
    }

    // poller 扫描器
    if (!pollerTimer) {
      pollerTimer = setInterval(() => void pollerTick(), POLLER_INTERVAL_MS);
    }

    await channel.consume(QUEUE_CANVAS_STEP, async (msg) => {
      if (!msg) return;

      let jobKey: string | undefined;

      try {
        const content = JSON.parse(msg.content.toString());
        let name: string | undefined;
        let data: any;

        if (content.jobId) {
          jobKey = redisKeys.jobData(content.jobId);
          const jobDataRaw = await redis.get(jobKey);
          if (!jobDataRaw) {
            console.error(`Canvas job data not found in Redis for ID: ${content.jobId}`);
            channel.ack(msg);
            return;
          }
          const parsed = JSON.parse(jobDataRaw);
          name = parsed.name;
          data = parsed.data;
        } else {
          name = content.name;
          data = content.data;
        }

        if (!data) {
          console.error("Invalid canvas message: missing data");
          channel.ack(msg);
          return;
        }

        if (name === "poll-provider-job") {
          await processPollJob(data);
        } else {
          await processExecuteStep(data);
        }

        if (jobKey) await redis.del(jobKey);
        channel.ack(msg);
      } catch (error) {
        console.error("Error processing canvas job:", error);

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
                  redisTTL.jobData
                );
                await new Promise((r) => setTimeout(r, 2000));
                channel.nack(msg, false, true);
                return;
              }
            }
          } catch (redisError) {
            console.error("Error updating canvas retry count:", redisError);
          }
        }

        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error("Failed to start canvas consumer:", error);
    if (!isShuttingDown) {
      console.log("Retrying canvas consumer in 5s...");
      setTimeout(startConsumer, 5000);
    }
  }
};

export const canvasWorker = {
  start: () => {
    startConsumer();
  },
  close: async () => {
    isShuttingDown = true;
    if (pollerTimer) {
      clearInterval(pollerTimer);
      pollerTimer = null;
    }
    await closeRabbitMQ();
    await redis.quit();
  },
};
