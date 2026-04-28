import { getSystemWallpapers } from "@/models/system-wallpaper";
import { addSignedUrlsToWallpapers } from "@/lib/wallpaper-utils";
import { requireAuth } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { GetWallpapersSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = GetWallpapersSchema.safeParse(body);
    const tab = parsed.success ? parsed.data.tab : undefined;
    const result = await getSystemWallpapers(tab || "latest");

    if (!result || result.items.length === 0) {
      return Response.json({
        code: 0,
        message: "",
        result: { items: [] }
      });
    }

    const auth = await requireAuth();

    let dbUserId: number | null = null;
    if (auth) {
      const dbUser = await findUserByEmail(auth.email);
      dbUserId = dbUser?.id ?? null;
    }

    const [wallpapersWithUrls, favoriteIds] = await Promise.all([
      addSignedUrlsToWallpapers(result.items),
      dbUserId
        ? import('@/lib/prisma').then(({ prisma }) =>
            prisma.favorites.findMany({
              where: { user_id: dbUserId!, system_wallpaper_id: { not: null } },
              select: { system_wallpaper_id: true }
            })
          )
        : Promise.resolve(null),
    ]);

    if (auth && favoriteIds) {
      const favoriteIdSet = new Set(favoriteIds.map((f: any) => f.system_wallpaper_id));
      return Response.json({
        code: 0,
        message: "",
        result: {
          items: wallpapersWithUrls.map((w) => ({ ...w, is_favorite: favoriteIdSet.has(w.id as number) }))
        }
      });
    }

    return Response.json({
      code: 0,
      message: "",
      result: {
        items: wallpapersWithUrls
      }
    });
  } catch (e) {
    console.log("get wallpapers failed: ", e);
    return Response.json({
      code: -1,
      message: "get.wallpapers.failed"
    });
  }
}
