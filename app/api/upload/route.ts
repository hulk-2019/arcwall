import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { uploadFile, generateOssKey, getSignedUrl } from "@/lib/oss";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { respErr } = createLocaleResp(req);
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return respErr(errMsg("invalid.params.file.missing"));
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ossKey = generateOssKey();

    // We only need the original path since we are not doing watermarking/thumbnail
    const path = ossKey.original;

    const uploadedPath = await uploadFile(buffer, path);
    const signedUrl = await getSignedUrl(uploadedPath);

    return respData({
        url: signedUrl,
        name: uploadedPath
    });

  } catch (e) {
    console.log("upload file failed:", e);
    return respErr(errMsg("upload.failed"));
  }
}
