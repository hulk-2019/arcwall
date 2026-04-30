import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { clearAllTrash } from "@/models/wallpaper";
import { findUserByEmail } from "@/models/user";

export async function POST(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const user = await findUserByEmail(auth.email);
    if (!user?.id) {
      return respErr(errMsg("user.not.found"));
    }

    const count = await clearAllTrash(user.id);

    return respData({ count });
  } catch (e) {
    console.log("clear trash failed: ", e);
    return respErr(errMsg("clear.trash.failed"));
  }
}

