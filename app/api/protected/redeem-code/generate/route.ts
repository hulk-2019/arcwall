import { respData, respErr } from "@/lib/resp";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { generateRedeemCodeForUser } from "@/models/redeem-code";

export async function POST(req: Request) {
  const auth = await requireAuthOrResponse();
  if (auth instanceof Response) {
    return auth; // 未登录，直接返回 401
  }

  try {
    const email = auth.email;
    const user = await findUserByEmail(email);

    // 仅 superadmin 可以生成兑换码
    if (!user || !user.roles || !user.roles.includes("superadmin")) {
      return respErr("permission.denied");
    }

    if (!user.id) {
      return respErr("user.not.found");
    }

    const redeemCode = await generateRedeemCodeForUser(user.id);

    return respData({
      code: redeemCode.code,
    });
  } catch (e) {
    console.log("generate redeem code failed: ", e);
    return respErr("generate.redeem.code.failed");
  }
}
