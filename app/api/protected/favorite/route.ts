import { respData, respErr } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findUserByEmail } from "@/models/user";
import { FavoriteSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const auth = await requireAuthOrResponse();
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body = await req.json();
    const parsed = FavoriteSchema.safeParse(body);
    if (!parsed.success) {
      return respErr(errMsg("wallpaperId is required"));
    }
    const { wallpaperId } = parsed.data;

    const user = await findUserByEmail(auth.email);
    if (!user?.id) {
      return respErr(errMsg("user.not.found"));
    }

    // Find if already favorited
    const existing = await prisma.favorites.findFirst({
      where: {
        user_id: user.id,
        system_wallpaper_id: Number(wallpaperId),
      },
    });

    if (existing) {
      await prisma.favorites.delete({
        where: {
          id: existing.id,
        },
      });
      return respData({ is_favorite: false });
    } else {
      const data: any = {
        user_id: user.id,
        system_wallpaper_id: Number(wallpaperId),
      };

      await prisma.favorites.create({
        data,
      });
      return respData({ is_favorite: true });
    }
  } catch (e) {
    console.log("toggle favorite failed: ", e);
    return respErr(errMsg("toggle.favorite.failed"));
  }
}
