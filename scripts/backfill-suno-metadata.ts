import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { fetchSunoTask } from "../services/suno-proxy";
import type { CanvasNodeConfig, CanvasNodeOutput } from "../types/canvas";

const prisma = new PrismaClient();

/**
 * 从 302.ai 重新读取已完成 Suno 任务，补全已有音频的标题、歌词和风格数据。
 *
 * npx tsx scripts/backfill-suno-metadata.ts          # 预览
 * npx tsx scripts/backfill-suno-metadata.ts --apply  # 写入数据库
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const jobs = await prisma.provider_jobs.findMany({
    where: {
      provider: "suno_302",
      status: "succeeded",
      external_id: { not: null },
    },
    include: {
      step_run: {
        select: {
          id: true,
          output_json: true,
          node_revision: { select: { config_json: true } },
        },
      },
    },
    orderBy: { id: "asc" },
  });

  for (const job of jobs) {
    const output = job.step_run?.output_json as CanvasNodeOutput | null;
    if (!output || output.kind !== "audio") continue;

    const result = await fetchSunoTask(job.external_id!);
    if (result.status !== "succeeded") {
      console.log(`[skip] job ${job.id}: ${result.status}/${result.rawStatus ?? "-"}`);
      continue;
    }

    const selected = result.clips.find((clip) => clip.audioUrl);
    const config = (job.step_run.node_revision?.config_json ?? {}) as CanvasNodeConfig;
    const isInstrumental =
      config.mode === "instrumental" || (config.mode as string | undefined) === "music";
    const meta = {
      ...(output.meta ?? {}),
      ...(result.title ? { title: result.title } : {}),
      ...(!isInstrumental && result.lyrics ? { lyrics: result.lyrics } : {}),
      ...(selected?.tags ? { tags: selected.tags } : {}),
      ...(selected?.id ? { clipId: selected.id } : {}),
      clipCount: result.clips.length,
      providerTaskId: job.external_id,
      model: config.model,
      mode: isInstrumental ? "instrumental" : config.mode || "auto",
    };

    console.log(
      `[${apply ? "apply" : "dry-run"}] job ${job.id}, step ${job.step_run.id}: ` +
        `title=${JSON.stringify(meta.title)}, lyrics=${typeof meta.lyrics === "string" ? meta.lyrics.length : 0} chars, ` +
        `tags=${JSON.stringify(meta.tags)}`
    );
    if (!apply) continue;

    await prisma.$transaction([
      prisma.step_runs.update({
        where: { id: job.step_run.id },
        data: {
          output_json: { ...output, meta } as any,
          updated_at: new Date(),
        },
      }),
      prisma.provider_jobs.update({
        where: { id: job.id },
        data: {
          raw_status: result.rawStatus?.slice(0, 100),
          updated_at: new Date(),
        },
      }),
    ]);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
