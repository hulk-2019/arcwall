import { respData, respErr } from "@/lib/resp";
import { requireAuthOrResponse } from "@/lib/auth";
import { permanentlyDeleteWallpaper } from "@/models/wallpaper";
import { findUserByEmail } from "@/models/user";
import { TrashItemSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const auth = await requireAuthOrResponse();
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body = await req.json();
    const parsed = TrashItemSchema.safeParse(body);
    if (!parsed.success) {
      return respErr("invalid.params");
    }
    const { id } = parsed.data;

    const user = await findUserByEmail(auth.email);
    if (!user?.id) {
      return respErr("user.not.found");
    }

    const success = await permanentlyDeleteWallpaper(id, user.id);

    if (!success) {
      return respErr("delete.failed");
    }

    return respData({ success: true });
  } catch (e) {
    console.log("soft delete from trash failed: ", e);
    return respErr("soft.delete.from.trash.failed");
  }
}

