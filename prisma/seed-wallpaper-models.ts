import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * 首页/工作台图片模型字典（category = model）。
 * 执行：npx tsx prisma/seed-wallpaper-models.ts
 */
const prisma = new PrismaClient();

const MODELS: { key: string; label_zh: string; label_en: string }[] = [
  { key: "doubao-seedream-4-5-251128", label_zh: "Doubao Seedream 4.5", label_en: "Doubao Seedream 4.5" },
  { key: "gpt-image-2", label_zh: "GPT-Image-2", label_en: "GPT-Image-2" },
  { key: "gemini-3.1-flash-image-preview", label_zh: "Nano Banana 2", label_en: "Nano Banana 2" },
  { key: "gemini-3-pro-image-preview", label_zh: "Nano Banana Pro", label_en: "Nano Banana Pro" },
];

async function main() {
  let sort = 1;
  for (const model of MODELS) {
    await prisma.dictionaries.upsert({
      where: { category_key: { category: "model", key: model.key } },
      update: {
        label_zh: model.label_zh,
        label_en: model.label_en,
        sort_order: sort,
        is_active: true,
        updated_at: new Date(),
      },
      create: {
        category: "model",
        key: model.key,
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
  console.log(`Seeded ${MODELS.length} wallpaper image models.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
