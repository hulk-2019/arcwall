import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { UnpublishWallpaperSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body = await req.json();
    const parsed = UnpublishWallpaperSchema.safeParse(body);
    if (!parsed.success) {
      return respErr(errMsg("invalid.params"));
    }
    const { wallpaperId, systemWallpaperId, wallpaperIds = [], systemWallpaperIds = [] } = parsed.data;

    // Normalize to arrays
    const wpIds = wallpaperId ? [wallpaperId] : wallpaperIds;
    const sysWpIds = systemWallpaperId ? [systemWallpaperId] : systemWallpaperIds;

    const email = auth.email;
    const user = await findUserByEmail(email);

    if (!user) {
      return respErr(errMsg("user.not.found"));
    }

    const isSuperAdmin = user.roles?.includes("superadmin") || user.roles?.includes("admin");

    const { prisma } = await import("@/lib/prisma");

    let validImgPaths: string[] = [];
    let validWpIds: number[] = [];

    const [sysWps, wps] = await Promise.all([
      sysWpIds.length > 0
        ? prisma.system_wallpapers.findMany({ where: { id: { in: sysWpIds } } })
        : Promise.resolve([]),
      wpIds.length > 0
        ? prisma.wallpapers.findMany({ where: { id: { in: wpIds } } })
        : Promise.resolve([]),
    ]);

    // Process systemWallpaperIds
    if (sysWpIds.length > 0) {
      const sysImgPaths = sysWps.map(w => w.img_path).filter((p): p is string => !!p);

      const relatedWps = await prisma.wallpapers.findMany({
        where: { img_path: { in: sysImgPaths } }
      });

      for (const sysWp of sysWps) {
        if (!sysWp.img_path) continue;

        const wp = relatedWps.find(w => w.img_path === sysWp.img_path);

        if (wp) {
          if (isSuperAdmin || wp.user_id === user.id) {
            validImgPaths.push(sysWp.img_path);
            validWpIds.push(wp.id);
          } else if (sysWp.creator_id === user.id) {
            validImgPaths.push(sysWp.img_path);
          }
        } else if (isSuperAdmin || sysWp.creator_id === user.id) {
          validImgPaths.push(sysWp.img_path);
        }
      }
    }

    if (wpIds.length > 0) {
      for (const wp of wps) {
        if (isSuperAdmin || wp.user_id === user.id) {
          if (wp.img_path) {
            validImgPaths.push(wp.img_path);
          }
          validWpIds.push(wp.id);
        }
      }
    }

    // Deduplicate
    validImgPaths = Array.from(new Set(validImgPaths));
    validWpIds = Array.from(new Set(validWpIds));

    if (validImgPaths.length === 0 && validWpIds.length === 0) {
      return respErr(errMsg("permission.denied"));
    }

    const actions = [];
    if (validImgPaths.length > 0) {
      actions.push(
        prisma.system_wallpapers.updateMany({
          where: { img_path: { in: validImgPaths } },
          data: { is_active: false }
        })
      );
    }

    if (validWpIds.length > 0) {
      actions.push(
        prisma.wallpapers.updateMany({
          where: { id: { in: validWpIds } },
          data: { is_public: false }
        })
      );
    }

    if (actions.length > 0) {
      await prisma.$transaction(actions);
    }

    return respData({ success: true, count: validImgPaths.length || validWpIds.length });
  } catch (e) {
    console.log("unpublish wallpaper failed: ", e);
    return respErr(errMsg("unpublish.failed"));
  }
}
