import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { getUserCredits } from "@/services/credit";
import { findUserByEmail } from "@/models/user";

export async function POST(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const dbUser = await findUserByEmail(auth.email);
    if (!dbUser?.id) {
      return respErr(errMsg("user.not.found"));
    }

    const credits = await getUserCredits(dbUser.id);
    return respData(credits);
  } catch (e) {
    console.log("get user credits failed");
    return respErr(errMsg("get.user.info.failed"));
  }
}
