import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { redeemCodeForUser } from "@/models/redeem-code";
import { RedeemCodeSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body = await req.json();
    const parsed = RedeemCodeSchema.safeParse(body);
    if (!parsed.success) {
      return respErr(errMsg("invalid.params"));
    }
    const { code } = parsed.data;

    const email = auth.email;
    const user = await findUserByEmail(email);

    if (!user || !user.id) {
      return respErr(errMsg("user.not.found"));
    }

    try {
      const newBalance = await redeemCodeForUser(
        user.id,
        code.trim().toUpperCase()
      );

      return respData({
        balance: newBalance,
      });
    } catch (e: any) {
      if (e instanceof Error) {
        if (e.message === "redeem.code.invalid") {
          return respErr(errMsg("redeem.code.invalid"));
        }
        if (e.message === "redeem.code.used") {
          return respErr(errMsg("redeem.code.used"));
        }
      }
      console.log("redeem code failed: ", e);
      return respErr(errMsg("redeem.code.failed"));
    }
  } catch (e) {
    console.log("redeem code failed: ", e);
    return respErr(errMsg("redeem.code.failed"));
  }
}
