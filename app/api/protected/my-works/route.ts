import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { getUserWallpapers } from "@/models/wallpaper";
import { addThumbnailUrlsToWallpapers } from "@/lib/wallpaper-utils";
import { findUserByEmail } from "@/models/user";
import { MyWorksSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body = await req.json();
    const parsed = MyWorksSchema.safeParse(body);
    if (!parsed.success) {
      return respErr(errMsg("invalid.params"));
    }
    const { page, limit, type, keyword, startDate, endDate, sortByLikes } = parsed.data;

    const filters = { keyword, startDate, endDate };

    const user = await findUserByEmail(auth.email);
    if (!user?.id) {
      return respErr(errMsg("user.not.found"));
    }

    if (type === 'favorites') {
      const { prisma } = await import('@/lib/prisma');
      const { formatSystemWallpaper } = await import('@/models/system-wallpaper');

      const p = page || 1;
      const l = limit || 12;
      const offset = (p - 1) * l;

      const systemWallpaperFilter: any = { is_active: true };

      if (filters.keyword) {
        systemWallpaperFilter.img_description = {
          contains: filters.keyword,
          mode: 'insensitive',
        };
      }

      if (filters.startDate || filters.endDate) {
        systemWallpaperFilter.created_at = {};
        if (filters.startDate) {
          systemWallpaperFilter.created_at.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          systemWallpaperFilter.created_at.lte = end;
        }
      }

      const favoriteWhere = {
        user_id: user.id,
        system_wallpaper: systemWallpaperFilter,
      };

      const [total, favoriteRecords] = await Promise.all([
        prisma.favorites.count({ where: favoriteWhere }),
        prisma.favorites.findMany({
          where: favoriteWhere,
          orderBy: { created_at: "desc" },
          take: l,
          skip: offset,
          include: { system_wallpaper: { include: { user: true } } },
        }),
      ]);

      const wallpapers = favoriteRecords
        .map(f => f.system_wallpaper ? formatSystemWallpaper(f.system_wallpaper) : null)
        .filter(Boolean);
      const wallpapersWithUrls = await addThumbnailUrlsToWallpapers(wallpapers as any[]);

      return respData({
        wallpapers: wallpapersWithUrls,
        total,
      });
    }

    if (type === 'published') {
      const { prisma } = await import('@/lib/prisma');
      const { formatSystemWallpaper } = await import('@/models/system-wallpaper');

      const p = page || 1;
      const l = limit || 12;
      const offset = (p - 1) * l;

      const isSuperAdmin = user?.roles?.includes('superadmin');

      const publishedWhere: any = { is_active: true };

      if (!isSuperAdmin) {
        publishedWhere.creator_id = user?.id ?? -1;
      }

      if (filters.keyword) {
        publishedWhere.img_description = {
          contains: filters.keyword,
          mode: 'insensitive',
        };
      }

      if (filters.startDate || filters.endDate) {
        publishedWhere.created_at = {};
        if (filters.startDate) {
          publishedWhere.created_at.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          publishedWhere.created_at.lte = end;
        }
      }

      let orderBy: any = { created_at: "desc" };
      if (sortByLikes === "asc") {
        orderBy = { favorites: { _count: "asc" } };
      } else if (sortByLikes === "desc") {
        orderBy = { favorites: { _count: "desc" } };
      }

      const [total, items] = await Promise.all([
        prisma.system_wallpapers.count({ where: publishedWhere }),
        prisma.system_wallpapers.findMany({
          where: publishedWhere,
          orderBy: orderBy,
          take: l,
          skip: offset,
          include: {
            user: true,
            _count: {
              select: { favorites: true }
            }
          }
        }),
      ]);

      const mappedItems = items.map(item => {
        const formatted = formatSystemWallpaper(item);
        return {
          ...formatted,
          likes_count: item._count.favorites
        };
      });

      const wallpapersWithUrls = await addThumbnailUrlsToWallpapers(mappedItems as any[]);

      return respData({
        wallpapers: wallpapersWithUrls,
        total: total,
      });
    }

    const result = await getUserWallpapers(
      user.id,
      page || 1,
      limit || 12,
      filters
    );

    // Only generate thumbnail URLs for list view
    const wallpapersWithUrls = await addThumbnailUrlsToWallpapers(result.wallpapers);

    return respData({
      wallpapers: wallpapersWithUrls,
      total: result.total,
    });
  } catch (e) {
    console.log("get my works failed: ", e);
    return respErr(errMsg("get.my.works.failed"));
  }
}

