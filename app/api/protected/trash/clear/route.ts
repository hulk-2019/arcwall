import { respData, respErr } from "@/lib/resp";
import { requireAuthOrResponse } from "@/lib/auth";
import { clearAllTrash } from "@/models/wallpaper";
import { findUserByEmail } from "@/models/user";

export async function POST(req: Request) {
  const auth = await requireAuthOrResponse();
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const user = await findUserByEmail(auth.email);
    if (!user?.id) {
      return respErr("user.not.found");
    }

    const count = await clearAllTrash(user.id);

    return respData({ count });
  } catch (e) {
    console.log("clear trash failed: ", e);
    return respErr("clear.trash.failed");
  }
}

