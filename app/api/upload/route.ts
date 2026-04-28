import { respData, respErr } from "@/lib/resp";
import { uploadFile, generateOssKey, getSignedUrl } from "@/lib/oss";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return respErr("invalid.params.file.missing");
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
    return respErr("upload.failed");
  }
}
