import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findUserByEmail } from "@/models/user";
import { BatchUnfavoriteSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body = await req.json();
    const parsed = BatchUnfavoriteSchema.safeParse(body);
    if (!parsed.success) {
      return respErr(errMsg("invalid.params.wallpaper.ids.required"));
    }
    const { wallpaperIds } = parsed.data;

    const user = await findUserByEmail(auth.email);
    if (!user?.id) {
      return respErr(errMsg("user.not.found"));
    }

    const { count } = await prisma.favorites.deleteMany({
      where: {
        user_id: user.id,
        system_wallpaper_id: { in: wallpaperIds },
      },
    });

    return respData({ deleted: count });
  } catch (e) {
    console.log("batch unfavorite failed: ", e);
    return respErr(errMsg("batch.unfavorite.failed"));
  }
}
