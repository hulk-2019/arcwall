import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * 画布模型字典种子（category = canvas_model，type 区分节点类型）。
 * 执行：npx tsx prisma/seed-canvas-models.ts
 */
const prisma = new PrismaClient();

const MODELS: {
  key: string;
  type: "image" | "video" | "audio";
  label_zh: string;
  label_en: string;
}[] = [
  // 图片：Ark Seedream 系列 + 302.ai 代理（GPT-Image / Nano Banana）
  { key: "doubao-seedream-4-5-251128", type: "image", label_zh: "Seedream 4.5", label_en: "Seedream 4.5" },
  { key: "doubao-seedream-4-0-250828", type: "image", label_zh: "Seedream 4.0", label_en: "Seedream 4.0" },
  { key: "doubao-seedream-3-0-t2i-250415", type: "image", label_zh: "Seedream 3.0", label_en: "Seedream 3.0" },
  { key: "gpt-image-2", type: "image", label_zh: "GPT-Image-2", label_en: "GPT-Image-2" },
  { key: "gemini-3.1-flash-image-preview", type: "image", label_zh: "Nano Banana 2", label_en: "Nano Banana 2" },
  { key: "gemini-3-pro-image-preview", type: "image", label_zh: "Nano Banana Pro", label_en: "Nano Banana Pro" },
  // 视频：302.ai 代理 Seedance 系列
  { key: "doubao-seedance-2-0-fast-260128", type: "video", label_zh: "Seedance 2.0 Fast", label_en: "Seedance 2.0 Fast" },
  { key: "doubao-seedance-2-0-260128", type: "video", label_zh: "Seedance 2.0", label_en: "Seedance 2.0" },
  { key: "doubao-seedance-1-0-pro-250528", type: "video", label_zh: "Seedance 1.0 Pro", label_en: "Seedance 1.0 Pro" },
  { key: "doubao-seedance-1-0-lite-t2v-250428", type: "video", label_zh: "Seedance 1.0 Lite", label_en: "Seedance 1.0 Lite" },
  // 音频：Ark TTS 系列
  { key: "doubao-seed-tts-1-0", type: "audio", label_zh: "Doubao TTS 1.0", label_en: "Doubao TTS 1.0" },
  { key: "doubao-seed-tts-1-0-mini", type: "audio", label_zh: "Doubao TTS 1.0 Mini", label_en: "Doubao TTS 1.0 Mini" },
];

async function main() {
  let sort = 1;
  for (const model of MODELS) {
    await prisma.dictionaries.upsert({
      where: { category_key: { category: "canvas_model", key: model.key } },
      update: {
        type: model.type,
        label_zh: model.label_zh,
        label_en: model.label_en,
        sort_order: sort,
        is_active: true,
        updated_at: new Date(),
      },
      create: {
        category: "canvas_model",
        key: model.key,
        type: model.type,
        label_zh: model.label_zh,
        label_en: model.label_en,
        sort_order: sort,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
    sort += 1;
  }
  console.log(`Seeded ${MODELS.length} canvas models.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
