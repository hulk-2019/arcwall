import { Wallpaper } from "@/types/wallpaper";
import { prisma } from "@/lib/prisma";

export async function getSystemWallpapers(
  tab: string = "latest"
): Promise<{ items: Wallpaper[] }> {
  const limit = 40;

  let orderBy: any = { created_at: "desc" };
  if (tab === "trending") {
    orderBy = {
      favorites: {
        _count: "desc",
      },
    };
  }

  const [wallpapers, dicts] = await Promise.all([
    prisma.system_wallpapers.findMany({
      where: {
        is_active: true,
      },
      orderBy,
      take: limit,
      include: { user: true },
    }),
    prisma.dictionaries.findMany({
      where: {
        category: {
          in: ["model", "aspect_ratio"],
        },
        is_active: true,
      },
    }),
  ]);

  if (wallpapers.length === 0) {
    return { items: [] };
  }

  const modelLabels: Record<string, string> = {};
  const aspectRatioLabels: Record<string, string> = {};

  for (const d of dicts) {
    const label = d.label_en || d.label_zh || d.key;
    if (d.category === "model") {
      modelLabels[d.key] = label;
    } else if (d.category === "aspect_ratio") {
      aspectRatioLabels[d.key] = label;
    }
  }

  const items = wallpapers.map((row: any) => {
    const modelName =
      row.model_key && modelLabels[row.model_key]
        ? modelLabels[row.model_key]
        : "";
    const aspectRatioName =
      row.aspect_ratio_key && aspectRatioLabels[row.aspect_ratio_key]
        ? aspectRatioLabels[row.aspect_ratio_key]
        : undefined;

    return formatSystemWallpaper({
      ...row,
      model_name: modelName,
      aspect_ratio_name: aspectRatioName,
    });
  });

  return { items };
}

export function formatSystemWallpaper(row: any): Wallpaper {
  let wallpaper: Wallpaper = {
    id: row.id,
    user_id: row.creator_id || undefined,
    img_description: row.img_description || "",
    img_size: row.img_size || "",
    aspect_ratio_name: row.aspect_ratio_name || undefined,
    model_key: row.model_key || undefined,
    aspect_ratio_key: row.aspect_ratio_key || undefined,
    img_path: row.img_path || undefined,
    img_thumbnail_path: row.img_thumbnail_path || undefined,
    img_watermark_path: row.img_watermark_path || undefined,
    model_name: row.model_name || "",
    llm_params: row.llm_params,
    created_at: row.created_at ? row.created_at.toISOString() : "",
  };

  // Set default user info for system preset wallpapers or map from relation
  wallpaper.created_user = {
    // id: row.creator_id || 0,
    // email: row.user?.email,
    nickname: row.user?.nickname,
    avatar_url: row.user?.avatar_url || '',
  };

  try {
    if (typeof row.llm_params === 'string') {
      wallpaper.llm_params = JSON.parse(row.llm_params);
    }
  } catch (e) {
    console.log("parse system wallpaper llm_params failed: ", e);
  }

  return wallpaper;
}


export async function insertSystemWallpaper(wallpaper: Wallpaper, creatorId?: number) {
  const createdAt: string = new Date().toISOString();

  const res = await prisma.system_wallpapers.create({
    data: {
      img_description: wallpaper.img_description,
      img_size: wallpaper.img_size,
      model_key: wallpaper.model_key,
      aspect_ratio_key: wallpaper.aspect_ratio_key,
      img_path: wallpaper.img_path,
      img_thumbnail_path: wallpaper.img_thumbnail_path,
      img_watermark_path: wallpaper.img_watermark_path,
      llm_params: wallpaper.llm_params || {},
      created_at: createdAt,
      updated_at: createdAt,
      is_active: true,
      creator_id: creatorId,
    },
  });

  return res;
}
