import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { createCanvasAsset } from "@/models/canvas";
import { uploadFile, getSignedUrl } from "@/lib/oss";
import {
  UPLOAD_MIME_TYPES,
  UPLOAD_SIZE_LIMITS,
  type UploadMediaKind,
} from "@/lib/canvas/registry";
import { createHash, randomUUID } from "crypto";
import { NextRequest } from "next/server";

/**
 * 上传画布素材（PRD-AST-001）：支持图片 / 视频 / 音频。
 * 双重校验（技术方案 §十三点一：MIME 与魔数双检）：
 * 1. MIME 类型白名单 + 分类型大小限制（与客户端共用 registry 中的同一份定义）；
 * 2. 文件头魔数嗅探，防止伪造 Content-Type。
 * 上传成功后登记 canvas_assets（含 sha256）并返回展示用签名 URL。
 */

/**
 * 魔数嗅探：返回检测到的媒体类型，检测失败返回 null。
 * 覆盖白名单内全部容器/编码格式的文件头签名。
 */
function sniffMediaKind(buf: Buffer): UploadMediaKind | null {
  if (buf.length < 16) return null;
  const ascii = (start: number, length: number) =>
    buf.subarray(start, start + length).toString("latin1");

  // 图片
  if (buf[0] === 0x89 && ascii(1, 3) === "PNG") return "image"; // PNG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image"; // JPEG
  if (ascii(0, 3) === "GIF") return "image"; // GIF
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image"; // WebP

  // 音频
  if (ascii(0, 3) === "ID3") return "audio"; // MP3 (ID3 标签)
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return "audio"; // MP3 (帧同步)
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return "audio"; // WAV
  if (ascii(0, 4) === "OggS") return "audio"; // OGG
  if (ascii(0, 4) === "fLaC") return "audio"; // FLAC

  // ISO BMFF 容器（mp4 / mov / m4a），按 major brand 区分
  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    if (brand.startsWith("M4A") || brand.startsWith("m4a")) return "audio";
    if (brand.startsWith("qt")) return "video"; // QuickTime mov
    return "video"; // isom / mp42 等
  }

  // WebM / Matroska
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return "video";
  }

  // AAC 裸流：ADTS 同步字
  if (buf[0] === 0xff && (buf[1] & 0xf6) === 0xf0) return "audio";

  return null;
}

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

    // 校验一：MIME 白名单（与客户端共用 UPLOAD_MIME_TYPES）
    const allowed = UPLOAD_MIME_TYPES[file.type];
    if (!allowed) return respErr(errMsg("canvas.asset.type.unsupported"));

    // 校验二：分类型大小限制
    if (file.size > UPLOAD_SIZE_LIMITS[allowed.kind]) {
      return respErr(errMsg("canvas.asset.too.large"));
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 校验三：魔数嗅探，防止伪造 Content-Type
    const sniffed = sniffMediaKind(buffer);
    if (sniffed !== allowed.kind) {
      return respErr(errMsg("canvas.asset.type.unsupported"));
    }

    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const storageKey = `canvas/uploads/${Date.now()}-${randomUUID().slice(0, 8)}.${allowed.ext}`;

    await uploadFile(buffer, storageKey);

    await createCanvasAsset({
      userId: user.id,
      mediaType: allowed.kind,
      storageKey,
      sha256,
    });

    return respData({
      storageKey,
      url: await getSignedUrl(storageKey),
      mediaType: allowed.kind,
      fileName: file.name,
    });
  } catch (e) {
    console.error("upload canvas asset failed:", e);
    return respErr(errMsg("canvas.asset.upload.failed"));
  }
}
