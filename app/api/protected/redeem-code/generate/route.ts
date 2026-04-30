import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { generateRedeemCodeForUser } from "@/models/redeem-code";

export async function POST(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) {
    return auth; // 未登录，直接返回 401
  }

  try {
    const email = auth.email;
    const user = await findUserByEmail(email);

    // 仅 superadmin 可以生成兑换码
    if (!user || !user.roles || !user.roles.includes("superadmin")) {
      return respErr(errMsg("permission.denied"));
    }

    if (!user.id) {
      return respErr(errMsg("user.not.found"));
    }

    const redeemCode = await generateRedeemCodeForUser(user.id);

    return respData({
      code: redeemCode.code,
    });
  } catch (e) {
    console.log("generate redeem code failed: ", e);
    return respErr(errMsg("generate.redeem.code.failed"));
  }
}
