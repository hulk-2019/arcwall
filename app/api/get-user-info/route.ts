import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";

import { User } from "@/types/user";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail, insertUser } from "@/models/user";

export async function POST(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) {
    return auth;
  }
  try {
    const email = auth.email;
    const userInfo: User = {
      email: email,
      nickname: "",
      avatar_url: "",
    };

    let dbUser = await findUserByEmail(email);
    if (!dbUser) {
      await insertUser(userInfo);
      dbUser = await findUserByEmail(email);
    }

    if (!dbUser?.id) {
      return respErr(errMsg("user.not.found"));
    }

    userInfo.id = dbUser.id;
    userInfo.nickname = dbUser.nickname || "";
    userInfo.avatar_url = dbUser.avatar_url || "";
    userInfo.roles = dbUser.roles;

    return respData(userInfo);
  } catch (e) {
    console.log("get user info failed");
    return respErr(errMsg("get.user.info.failed"));
  }
}
