import { respData, respErr } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { getUserTrash } from "@/models/wallpaper";
import { addThumbnailUrlsToWallpapers } from "@/lib/wallpaper-utils";
import { findUserByEmail } from "@/models/user";

export async function POST(req: Request) {
  const auth = await requireAuthOrResponse();
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const user = await findUserByEmail(auth.email);
    if (!user?.id) {
      return respErr(errMsg("user.not.found"));
    }

    const trash = await getUserTrash(user.id);
    const trashWithUrls = await addThumbnailUrlsToWallpapers(trash);

    return respData(trashWithUrls);
  } catch (e) {
    console.log("get trash failed: ", e);
    return respErr(errMsg("get.trash.failed"));
  }
}

