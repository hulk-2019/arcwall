import { respData, respErr } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { restoreWallpaper } from "@/models/wallpaper";
import { findUserByEmail } from "@/models/user";
import { TrashItemSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const auth = await requireAuthOrResponse();
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body = await req.json();
    const parsed = TrashItemSchema.safeParse(body);
    if (!parsed.success) {
      return respErr(errMsg("invalid.params"));
    }
    const { id } = parsed.data;

    const user = await findUserByEmail(auth.email);
    if (!user?.id) {
      return respErr(errMsg("user.not.found"));
    }

    const success = await restoreWallpaper(id, user.id);

    if (!success) {
      return respErr(errMsg("restore.failed"));
    }

    return respData({ success: true });
  } catch (e) {
    console.log("restore wallpaper failed: ", e);
    return respErr(errMsg("restore.wallpaper.failed"));
  }
}

