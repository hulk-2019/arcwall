import { respData, respErr } from "@/lib/resp";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { redeemCodeForUser } from "@/models/redeem-code";
import { RedeemCodeSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const auth = await requireAuthOrResponse();
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body = await req.json();
    const parsed = RedeemCodeSchema.safeParse(body);
    if (!parsed.success) {
      return respErr("invalid.params");
    }
    const { code } = parsed.data;

    const email = auth.email;
    const user = await findUserByEmail(email);

    if (!user || !user.id) {
      return respErr("user.not.found");
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
          return respErr("redeem.code.invalid");
        }
        if (e.message === "redeem.code.used") {
          return respErr("redeem.code.used");
        }
      }
      console.log("redeem code failed: ", e);
      return respErr("redeem.code.failed");
    }
  } catch (e) {
    console.log("redeem code failed: ", e);
    return respErr("redeem.code.failed");
  }
}
