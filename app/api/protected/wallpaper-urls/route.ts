import { respData, respErr } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { getSignedUrl } from "@/lib/oss";
import { prisma } from "@/lib/prisma";
import { findUserByEmail } from "@/models/user";
import { WallpaperUrlsSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const auth = await requireAuthOrResponse();
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body = await req.json();
    const parsed = WallpaperUrlsSchema.safeParse(body);
    if (!parsed.success) {
      return respErr(errMsg("invalid.params.wallpaperId.required"));
    }
    const { wallpaperId, systemWallpaperId, type } = parsed.data;

    const user = await findUserByEmail(auth.email);
    if (!user?.id) {
      return respErr(errMsg("user.not.found"));
    }

    let wallpaper = null;

    if (systemWallpaperId) {
      const systemWallpaper = await prisma.system_wallpapers.findFirst({
        where: {
          id: systemWallpaperId,
          is_active: true,
        },
      });
      if (systemWallpaper) {
        wallpaper = {
          id: systemWallpaper.id,
          img_path: systemWallpaper.img_path,
          img_watermark_path: systemWallpaper.img_watermark_path,
        } as any;
      }
    }

    if (!wallpaper && wallpaperId) {
      wallpaper = await prisma.wallpapers.findFirst({
        where: {
          id: wallpaperId,
          user_id: user.id,
          is_delete: false,
          is_permanently_delete: false,
        },
      });
    }

    // Fallback: If not found, try system wallpapers with wallpaperId (legacy format)
    if (!wallpaper && wallpaperId) {
      const systemWallpaper = await prisma.system_wallpapers.findFirst({
        where: {
          id: wallpaperId,
          is_active: true,
        },
      });
      if (systemWallpaper) {
        // Convert system wallpaper format to match wallpaper format
        wallpaper = {
          id: systemWallpaper.id,
          img_path: systemWallpaper.img_path,
          img_watermark_path: systemWallpaper.img_watermark_path,
        } as any;
      }
    }

    if (!wallpaper) {
      return respErr(errMsg("wallpaper.not.found"));
    }

    let path: string | null = null;
    if (type === "download") {
      path = wallpaper.img_path;
    } else if (type === "preview") {
      path = wallpaper.img_watermark_path;
    }

    if (!path) {
      return respErr(errMsg("path.not.available"));
    }

    // Generate signed URL
    const signedUrl = await getSignedUrl(path, 86400); // 24 hours

    return respData({ url: signedUrl });
  } catch (e) {
    console.log("generate wallpaper URL failed: ", e);
    return respErr(errMsg("generate.wallpaper.url.failed"));
  }
}

