import { respData, respErr } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { prisma } from "@/lib/prisma";
import { PublishWallpaperSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const auth = await requireAuthOrResponse();
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body = await req.json();
    const parsed = PublishWallpaperSchema.safeParse(body);
    if (!parsed.success) {
      return respErr(errMsg("invalid.params"));
    }
    const { wallpaperId, wallpaperIds } = parsed.data;

    let ids: number[] = [];
    if (wallpaperId) {
      ids.push(wallpaperId);
    }
    if (wallpaperIds && wallpaperIds.length > 0) {
      ids = [...ids, ...wallpaperIds];
    }
    ids = Array.from(new Set(ids));

    const email = auth.email;
    const user = await findUserByEmail(email);

    if (!user) {
      return respErr(errMsg("user.not.found"));
    }

    const wallpapers = await prisma.wallpapers.findMany({
      where: {
        id: { in: ids },
        user_id: user.id,
        is_public: false,
      }
    });

    if (wallpapers.length === 0) {
      return respData({ success: true, count: 0 });
    }

    const createdAt = new Date().toISOString();
    
    // Prepare system wallpapers data
    const systemWallpapersData = wallpapers.map((w) => ({
      img_description: w.img_description,
      img_size: w.img_size,
      model_key: w.model_key,
      aspect_ratio_key: w.aspect_ratio_key,
      img_path: w.img_path,
      img_thumbnail_path: w.img_thumbnail_path,
      img_watermark_path: w.img_watermark_path,
      llm_params: w.llm_params ? JSON.parse(JSON.stringify(w.llm_params)) : {},
      created_at: createdAt,
      updated_at: createdAt,
      is_active: true,
      creator_id: user.id,
      wallpaper_id: w.id,
    }));

    // Use a transaction for atomic operation
    await prisma.$transaction([
      prisma.system_wallpapers.createMany({
        data: systemWallpapersData as any
      }),
      prisma.wallpapers.updateMany({
        where: { id: { in: wallpapers.map(w => w.id) } },
        data: { is_public: true }
      })
    ]);

    return respData({ success: true, count: wallpapers.length });
  } catch (e) {
    console.log("publish wallpaper failed: ", e);
    return respErr(errMsg("publish.failed"));
  }
}
