import { respData, respErr } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { batchSoftDeleteWallpapers } from "@/models/wallpaper";
import { findUserByEmail } from "@/models/user";
import { BatchDeleteWorksSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const auth = await requireAuthOrResponse();
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body = await req.json();
    const parsed = BatchDeleteWorksSchema.safeParse(body);
    if (!parsed.success) {
      return respErr(errMsg("invalid.params"));
    }
    const { ids } = parsed.data;

    const user = await findUserByEmail(auth.email);
    if (!user?.id) {
      return respErr(errMsg("user.not.found"));
    }

    const count = await batchSoftDeleteWallpapers(ids, user.id);

    return respData({ count });
  } catch (e) {
    console.log("batch delete wallpapers failed: ", e);
    return respErr(errMsg("batch.delete.failed"));
  }
}

