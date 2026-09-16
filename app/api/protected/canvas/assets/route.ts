import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { createCanvasAsset } from "@/models/canvas";
import { uploadFile, getSignedUrl } from "@/lib/oss";
import { createHash, randomUUID } from "crypto";
import { NextRequest } from "next/server";

/**
 * 上传画布素材（PRD-AST-001）：MVP 仅支持图片。
 * 上传 → OSS 存储 → 登记 canvas_assets（含 sha256）→ 返回 storageKey 与展示用签名 URL。
 */

const MAX_ASSET_SIZE = 20 * 1024 * 1024; // 20MB

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: NextRequest) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  try {
    const user = await findUserByEmail(auth.email);
    if (!user?.id) return respErr(errMsg("user.not.found"));

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return respErr(errMsg("invalid.params.file.missing"));

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) return respErr(errMsg("canvas.asset.type.unsupported"));
    if (file.size > MAX_ASSET_SIZE) return respErr(errMsg("canvas.asset.too.large"));

    const buffer = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const storageKey = `canvas/uploads/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

    await uploadFile(buffer, storageKey);

    await createCanvasAsset({
      userId: user.id,
      mediaType: "image",
      storageKey,
      sha256,
    });

    return respData({
      storageKey,
      url: await getSignedUrl(storageKey),
      mediaType: "image",
      fileName: file.name,
    });
  } catch (e) {
    console.error("upload canvas asset failed:", e);
    return respErr(errMsg("canvas.asset.upload.failed"));
  }
}
