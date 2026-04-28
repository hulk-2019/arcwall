import { Wallpaper } from "@/types/wallpaper";
import { prisma } from "@/lib/prisma";

async function getDictionaryLabelMaps() {
  const dicts = await prisma.dictionaries.findMany({
    where: {
      category: {
        in: ['model', 'aspect_ratio'],
      },
      is_active: true,
    },
  });

  const modelLabels: Record<string, string> = {};
  const aspectRatioLabels: Record<string, string> = {};

  for (const d of dicts) {
    const label = d.label_en || d.label_zh || d.key;
    if (d.category === 'model') {
      modelLabels[d.key] = label;
    } else if (d.category === 'aspect_ratio') {
      aspectRatioLabels[d.key] = label;
    }
  }

  return { modelLabels, aspectRatioLabels };
}

export async function insertWallpaper(wallpaper: Wallpaper) {
  const res = await prisma.wallpapers.create({
    data: {
      user_id: wallpaper.user_id!,
      img_description: wallpaper.img_description,
      img_size: wallpaper.img_size,
      model_key: wallpaper.model_key,
      aspect_ratio_key: wallpaper.aspect_ratio_key,
      img_path: wallpaper.img_path,
      img_thumbnail_path: wallpaper.img_thumbnail_path,
      img_watermark_path: wallpaper.img_watermark_path,
      llm_params: wallpaper.llm_params,
      created_at: wallpaper.created_at,
    },
  });

  return res;
}

export async function getWallpapersCount(): Promise<number> {
  const count = await prisma.wallpapers.count();
  return count;
}

export async function getUserWallpapersCount(
  user_id: number
): Promise<number> {
  const count = await prisma.wallpapers.count({
    where: {
      user_id: user_id,
      is_permanently_delete: false,
      is_delete: false,
    },
  });
  return count;
}

export async function getUserWallpapers(
  user_id: number,
  page: number,
  limit: number,
  filters?: { keyword?: string; startDate?: string; endDate?: string }
): Promise<{ wallpapers: Wallpaper[]; total: number }> {
  if (page < 1) {
    page = 1;
  }
  if (limit <= 0) {
    limit = 12;
  }
  const offset = (page - 1) * limit;

  const whereClause: any = {
    user_id: user_id,
    is_permanently_delete: false,
    is_delete: false,
  };

  if (filters?.keyword) {
    whereClause.img_description = {
      contains: filters.keyword,
      mode: 'insensitive',
    };
  }

  if (filters?.startDate || filters?.endDate) {
    whereClause.created_at = {};
    if (filters?.startDate) {
      whereClause.created_at.gte = new Date(filters.startDate);
    }
    if (filters?.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      whereClause.created_at.lte = end;
    }
  }

  const [rows, total] = await Promise.all([
    prisma.wallpapers.findMany({
      where: whereClause,
      include: {
        user: true,
      },
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
      skip: offset,
    }),
    prisma.wallpapers.count({
      where: whereClause,
    }),
  ]);

  if (rows.length === 0) {
    return {
      wallpapers: [],
      total,
    };
  }

  const { modelLabels, aspectRatioLabels } = await getDictionaryLabelMaps();

  const wallpapers = rows.map((row: any) => {
    const modelName =
      row.model_key && modelLabels[row.model_key]
        ? modelLabels[row.model_key]
        : "";
    const aspectRatioName =
      row.aspect_ratio_key && aspectRatioLabels[row.aspect_ratio_key]
        ? aspectRatioLabels[row.aspect_ratio_key]
        : undefined;

    return formatWallpaper({
      ...row,
      model_name: modelName,
      aspect_ratio_name: aspectRatioName,
    });
  });

  return {
    wallpapers,
    total,
  };
}

export async function getUserTrash(
  user_id: number
): Promise<Wallpaper[]> {
  const rows = await prisma.wallpapers.findMany({
    where: {
      user_id: user_id,
      is_permanently_delete: false,
      is_delete: true,
    },
    include: {
      user: true,
    },
    orderBy: {
      deleted_at: 'desc',
    },
  });

  if (rows.length === 0) {
    return [];
  }

  const { modelLabels, aspectRatioLabels } = await getDictionaryLabelMaps();

  const wallpapers = rows.map((row: any) => {
    const modelName =
      row.model_key && modelLabels[row.model_key]
        ? modelLabels[row.model_key]
        : "";
    const aspectRatioName =
      row.aspect_ratio_key && aspectRatioLabels[row.aspect_ratio_key]
        ? aspectRatioLabels[row.aspect_ratio_key]
        : undefined;

    return formatWallpaper({
      ...row,
      model_name: modelName,
      aspect_ratio_name: aspectRatioName,
    });
  });

  return wallpapers;
}

export async function softDeleteWallpaper(
  id: number,
  user_id: number
): Promise<boolean> {
  const result = await prisma.wallpapers.updateMany({
    where: {
      id: id,
      user_id: user_id,
    },
    data: {
      deleted_at: new Date(),
      is_delete: true,
      is_public: false,
    },
  });

  if (result.count > 0) {
    const wp = await prisma.wallpapers.findUnique({ where: { id } });
    if (wp && wp.img_path) {
      await prisma.system_wallpapers.updateMany({
        where: { img_path: wp.img_path },
        data: { is_active: false },
      });
    }
  }

  return result.count > 0;
}

export async function restoreWallpaper(
  id: number,
  user_id: number
): Promise<boolean> {
  const result = await prisma.wallpapers.updateMany({
    where: {
      id: id,
      user_id: user_id,
    },
    data: {
      deleted_at: null,
      is_delete: false,
      is_public: false,
    },
  });

  return result.count > 0;
}

export async function permanentlyDeleteWallpaper(
  id: number,
  user_id: number
): Promise<boolean> {
  const result = await prisma.wallpapers.updateMany({
    where: {
      id: id,
      user_id: user_id,
      is_delete: true,
      is_permanently_delete: false,
    },
    data: {
      is_permanently_delete: true,
      permanently_deleted_at: new Date(),
    },
  });

  return result.count > 0;
}

export async function batchSoftDeleteWallpapers(
  ids: number[],
  user_id: number
): Promise<number> {
  const result = await prisma.wallpapers.updateMany({
    where: {
      id: { in: ids },
      user_id: user_id,
      is_delete: false,
    },
    data: {
      deleted_at: new Date(),
      is_delete: true,
      is_public: false,
    },
  });

  if (result.count > 0) {
    const wps = await prisma.wallpapers.findMany({
      where: { id: { in: ids } },
      select: { img_path: true },
    });
    
    const imgPaths = wps.map(w => w.img_path).filter(Boolean) as string[];
    
    if (imgPaths.length > 0) {
      await prisma.system_wallpapers.updateMany({
        where: { img_path: { in: imgPaths } },
        data: { is_active: false },
      });
    }
  }

  return result.count;
}

export async function clearAllTrash(user_id: number): Promise<number> {
  const result = await prisma.wallpapers.updateMany({
    where: {
      user_id: user_id,
      is_delete: true,
      is_permanently_delete: false,
    },
    data: {
      is_permanently_delete: true,
      permanently_deleted_at: new Date(),
    },
  });

  return result.count;
}

export async function getWallpapers(
  page: number,
  limit: number
): Promise<Wallpaper[] | undefined> {
  if (page < 1) {
    page = 1;
  }
  if (limit <= 0) {
    limit = 50;
  }
  const offset = (page - 1) * limit;

  const rows = await prisma.wallpapers.findMany({
    include: {
      user: true,
    },
    orderBy: {
      created_at: 'desc',
    },
    take: limit,
    skip: offset,
  });

  if (rows.length === 0) {
    return undefined;
  }

  const { modelLabels, aspectRatioLabels } = await getDictionaryLabelMaps();

  const wallpapers = rows.map((row: any) => {
    const modelName =
      row.model_key && modelLabels[row.model_key]
        ? modelLabels[row.model_key]
        : "";
    const aspectRatioName =
      row.aspect_ratio_key && aspectRatioLabels[row.aspect_ratio_key]
        ? aspectRatioLabels[row.aspect_ratio_key]
        : undefined;

    return formatWallpaper({
      ...row,
      model_name: modelName,
      aspect_ratio_name: aspectRatioName,
    });
  });

  return wallpapers;
}

export function formatWallpaper(row: any): Wallpaper {
  let wallpaper: Wallpaper = {
    id: row.id,
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
    deleted_at: row.deleted_at ? row.deleted_at.toISOString() : undefined,
    status: row.status ?? 0,
    failure_reason: row.failure_reason || undefined,
    is_public: row.is_public ?? false,
  };

  if (row.user) {
    wallpaper.created_user = {
      // id: row.user_id,
      // email: row.user.email,
      nickname: row.user.nickname || "",
      avatar_url: row.user.avatar_url || "",
    };
  }

  try {
    if (typeof row.llm_params === 'string') {
      wallpaper.llm_params = JSON.parse(row.llm_params);
    }
  } catch (e) {
    console.log("parse wallpaper llm_params failed: ", e);
  }

  return wallpaper;
}

export async function findWallpaperById(id: number): Promise<Wallpaper | null> {
  const row = await prisma.wallpapers.findUnique({
    where: {
      id: id,
    },
    include: {
      user: true,
    },
  });

  if (!row) {
    return null;
  }

  const { modelLabels, aspectRatioLabels } = await getDictionaryLabelMaps();

  const modelName =
    row.model_key && modelLabels[row.model_key]
      ? modelLabels[row.model_key]
      : "";
  const aspectRatioName =
    row.aspect_ratio_key && aspectRatioLabels[row.aspect_ratio_key]
      ? aspectRatioLabels[row.aspect_ratio_key]
      : undefined;

  return formatWallpaper({
    ...row,
    model_name: modelName,
    aspect_ratio_name: aspectRatioName,
  });
}
