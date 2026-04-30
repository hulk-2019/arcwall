import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { permanentlyDeleteWallpaper } from "@/models/wallpaper";
import { findUserByEmail } from "@/models/user";
import { TrashItemSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
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

    const success = await permanentlyDeleteWallpaper(id, user.id);

    if (!success) {
      return respErr(errMsg("delete.failed"));
    }

    return respData({ success: true });
  } catch (e) {
    console.log("soft delete from trash failed: ", e);
    return respErr(errMsg("soft.delete.from.trash.failed"));
  }
}

