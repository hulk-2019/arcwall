import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { softDeleteWallpaper } from "@/models/wallpaper";
import { findUserByEmail } from "@/models/user";
import { DeleteWorkSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body = await req.json();
    const parsed = DeleteWorkSchema.safeParse(body);
    if (!parsed.success) {
      return respErr(errMsg("invalid.params"));
    }
    const { id } = parsed.data;

    const user = await findUserByEmail(auth.email);
    if (!user?.id) {
      return respErr(errMsg("user.not.found"));
    }

    const success = await softDeleteWallpaper(id, user.id);

    if (!success) {
      return respErr(errMsg("delete.failed"));
    }

    return respData({ success: true });
  } catch (e) {
    console.log("delete wallpaper failed: ", e);
    return respErr(errMsg("delete.wallpaper.failed"));
  }
}

