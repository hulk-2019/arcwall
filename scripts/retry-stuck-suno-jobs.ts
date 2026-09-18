import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import { randomUUID } from "crypto";
import { fetchSunoTask } from "../services/suno-proxy";
import { uploadFile } from "../lib/oss";
import { completeStepRun, finalizeExecutionIfDone } from "../models/canvas";
import { estimateNodeCost } from "../lib/canvas/registry";
import type { CanvasNodeConfig } from "../types/canvas";

const prisma = new PrismaClient();

/**
 * 恢复因响应解析 bug 被误判 PROVIDER_TIMEOUT 的 Suno 任务：
 * 供应商侧实际已 SUCCESS 的，翻回活跃态 → 转存 OSS → 完成步骤 → 结算。
 * 用法：npx tsx scripts/retry-stuck-suno-jobs.ts            # 预览（dry-run）
 *       npx tsx scripts/retry-stuck-suno-jobs.ts --apply   # 实际执行
 */
async function main() {
  const apply = process.argv.includes("--apply");

  const jobs = await prisma.provider_jobs.findMany({
    where: {
      provider: "suno_302",
      status: "failed",
      raw_status: "platform_timeout",
      external_id: { not: null },
    },
    include: {
      step_run: {
        select: {
          id: true,
          node_id: true,
          execution_id: true,
          status: true,
          node_revision: { select: { config_json: true } },
        },
      },
    },
  });

  if (jobs.length === 0) {
    console.log("No stuck suno jobs to recover.");
    return;
  }

  for (const job of jobs) {
    const stepRun = job.step_run;
    if (!stepRun || stepRun.status !== "failed") {
      console.log(`[skip] job ${job.id}: step run not in failed state (${stepRun?.status ?? "missing"})`);
      continue;
    }

    let result;
    try {
      result = await fetchSunoTask(job.external_id!);
    } catch (e) {
      console.log(`[skip] job ${job.id}: fetch failed: ${(e as Error).message}`);
      continue;
    }

    if (result.status !== "succeeded" || !result.audioUrl) {
      console.log(`[skip] job ${job.id}: provider status=${result.status}/${result.rawStatus ?? "-"}`);
      continue;
    }

    console.log(`[recover] job ${job.id} step ${stepRun.id}: "${result.title}" → ${result.audioUrl}`);
    if (!apply) {
      console.log("         (dry-run, add --apply to transfer & complete)");
      continue;
    }

    // 1. 下载并转存 OSS（失败即中止，不改变状态）
    const resp = await axios.get(result.audioUrl, { responseType: "arraybuffer", timeout: 300_000 });
    const key = `canvas/${Date.now()}-${randomUUID().slice(0, 8)}.mp3`;
    await uploadFile(Buffer.from(resp.data), key);

    // 2. 执行与步骤翻回活跃/running 态（completeStepRun 的 CAS 只认 running，执行必须活跃）
    const reopened = await prisma.executions.updateMany({
      where: { id: stepRun.execution_id, status: "failed" },
      data: { status: "running", updated_at: new Date() },
    });
    if (reopened.count === 0) {
      // 执行已是活跃态或已被用户操作，检查当前状态
      const exec = await prisma.executions.findUnique({
        where: { id: stepRun.execution_id },
        select: { status: true },
      });
      if (!exec || !["queued", "running", "cancel_requested"].includes(exec.status)) {
        console.log(`[skip] job ${job.id}: execution ${stepRun.execution_id} in terminal state (${exec?.status})`);
        continue;
      }
    }
    const requeued = await prisma.step_runs.updateMany({
      where: { id: stepRun.id, status: "failed" },
      data: { status: "running", error_code: null, error_message: null, updated_at: new Date() },
    });
    if (requeued.count === 0) {
      console.log(`[skip] job ${job.id}: step ${stepRun.id} no longer failed`);
      continue;
    }

    // 3. 标记任务成功、完成步骤、结算执行
    await prisma.provider_jobs.update({
      where: { id: job.id },
      data: { status: "succeeded", next_poll_at: null, updated_at: new Date() },
    });
    const config = (stepRun.node_revision?.config_json ?? {}) as CanvasNodeConfig;
    await completeStepRun(
      stepRun.id,
      {
        kind: "audio",
        storageKeys: [key],
        meta: {
          title: result.title,
          clipCount: result.clips.length,
          providerTaskId: job.external_id,
        },
      },
      estimateNodeCost("audio", config)
    );
    await finalizeExecutionIfDone(stepRun.execution_id);
    console.log(`[done] job ${job.id}: oss key=${key}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
