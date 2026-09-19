import OSS from "ali-oss";
import axios from "axios";
import fs from "fs";
import sharp from "sharp";
import { randomUUID } from "crypto";

const client = new OSS({
  region: process.env.OSS_REGION || 'oss-cn-shenzhen',
  accessKeyId: process.env.OSS_AK || "",
  accessKeySecret: process.env.OSS_SK || "",
  bucket: process.env.OSS_BUCKET || "",
});

/**
 * Generate OSS key with format: wallpapers + YYYYMMDDHHmmss + uuid + .png
 * @returns OSS key object
 */
export function generateOssKey(): Record<string, string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  return {
    original: `wallpapers/${dateStr}/${randomUUID().replace(/-/g, '')}.jpg`,
    watermark: `wallpapers/${dateStr}/${randomUUID().replace(/-/g, '')}.jpg`,
    thumbnail: `wallpapers/${dateStr}/${randomUUID().replace(/-/g, '')}.jpg`,
  };
}

function wallpaperDatePrefix(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/** Copy canvas media into the workbench `wallpapers/` prefix, keeping the source extension. */
export function generateWorkbenchMediaKeys(extension: string): {
  original: string;
  thumbnail: string;
} {
  const ext = extension.startsWith(".") ? extension : `.${extension || "bin"}`;
  const dateStr = wallpaperDatePrefix();
  return {
    original: `wallpapers/${dateStr}/${randomUUID().replace(/-/g, "")}${ext}`,
    thumbnail: `wallpapers/${dateStr}/${randomUUID().replace(/-/g, "")}.jpg`,
  };
}

export async function copyOssObject(sourceKey: string, destKey: string): Promise<string> {
  const result = await client.copy(destKey, sourceKey);
  return (result as { name?: string }).name || destKey;
}

export async function getOssObjectBuffer(key: string): Promise<Buffer> {
  const result = await client.get(key, { headers: internalDownloadHeaders() });
  return Buffer.from(result.content as Buffer);
}

export async function uploadJpegThumbnail(buffer: Buffer, destKey: string): Promise<string> {
  const thumbnailBuffer = await sharp(buffer)
    .resize(300, 300, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 30 })
    .toBuffer();
  return uploadFile(thumbnailBuffer, destKey);
}

export async function downloadImage(imageUrl: string, outputPath: string) {
  try {
    const response = await axios({
      method: "GET",
      url: imageUrl,
      responseType: "stream",
    });

    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      let error: Error | null = null;
      writer.on("error", (err) => {
        error = err;
        writer.close();
        reject(err);
      });

      writer.on("close", () => {
        if (!error) {
          resolve(null);
        }
      });
    });
  } catch (e) {
    console.log("download failed:", e);
    throw e;
  }
}

/**
 * Generate watermark SVG with text 'ARCWALL'
 */
function generateWatermarkSVG(width: number, height: number): string {
  const fontSize = Math.min(width, height) * 0.1; // 10% of smaller dimension
  const text = 'ARCWALL'; // Watermark text

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="50%"
        y="50%"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="rgba(255, 255, 255, 0.5)"
        text-anchor="middle"
        dominant-baseline="middle"
        transform="rotate(-45 ${width / 2} ${height / 2})"
      >${text}</text>
    </svg>
  `;
}

export async function downloadAndUploadImageWithThumbnail(
  imageUrl: string,
  ossKeyMap: Record<string, string>
): Promise<{ img_path: string | null; img_thumbnail_path: string | null; img_watermark_path: string | null }> {
  try {
    let imageBuffer: Buffer;
    if (imageUrl.startsWith("data:")) {
      const [, b64] = imageUrl.split(",");
      imageBuffer = Buffer.from(b64, "base64");
    } else {
      const response = await axios({
        method: "GET",
        url: imageUrl,
        responseType: "arraybuffer",
      });
      imageBuffer = Buffer.from(response.data);
    }
    const { original, watermark, thumbnail } = ossKeyMap;

    // Get image metadata to determine dimensions
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 1920;
    const height = metadata.height || 1080;

    // Generate watermark SVG
    const watermarkSVG = Buffer.from(generateWatermarkSVG(width, height));

    // Parallel processing: generate thumbnail and watermark
    const [thumbnailBuffer, watermarkBuffer] = await Promise.all([
      // Generate thumbnail
      image
        .clone()
        .resize(300, 300, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 30 })
        .toBuffer(),
      // Generate watermark image
      image
        .clone()
        .composite([
          {
            input: watermarkSVG,
            blend: 'over'
          }
        ])
        .jpeg({ quality: 85 })
        .toBuffer()
    ]);

    // Parallel upload: original, thumbnail, and watermark
    const [originalResult, thumbnailResult, watermarkResult] = await Promise.all([
      client.put(original, imageBuffer),
      client.put(thumbnail, thumbnailBuffer),
      client.put(watermark, watermarkBuffer)
    ]);

    return {
      img_path: (originalResult as any)?.name || null,
      img_thumbnail_path: (thumbnailResult as any)?.name || null,
      img_watermark_path: (watermarkResult as any)?.name || null,
    };
  } catch (e) {
    console.log("upload with thumbnail and watermark failed:", e);
    throw e;
  }
}

/**
 * Download media and return it as a base64 data URL so downstream services
 * receive the file inline without hitting OSS anti-hotlinking.
 */
export async function fetchMediaAsBase64(
  mediaUrl: string,
  fallbackType = "application/octet-stream"
): Promise<string> {
  const response = await axios({
    method: "GET",
    url: mediaUrl,
    responseType: "arraybuffer",
    headers: {
      Referer: process.env.NEXT_PUBLIC_APP_URL,
    },
  });

  const buffer = Buffer.from(response.data);
  const headerType = (response.headers["content-type"] as string | undefined)
    ?.split(";")[0]
    ?.trim();
  const contentType = sniffMediaType(buffer, headerType, fallbackType);
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

/**
 * Download an image and return it as a base64 data URL so downstream services
 * (e.g. Doubao) receive the image inline without hitting OSS anti-hotlinking.
 */
export async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  return fetchMediaAsBase64(imageUrl, "image/jpeg");
}

function sniffMediaType(
  buffer: Buffer,
  headerType: string | undefined,
  fallbackType: string
): string {
  if (headerType && headerType !== "application/octet-stream") return headerType;
  if (buffer.toString("ascii", 0, 4) === "RIFF") return "audio/wav";
  if (buffer.toString("ascii", 0, 3) === "ID3") return "audio/mpeg";
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer.toString("ascii", 1, 4) === "PNG") return "image/png";
  return headerType || fallbackType;
}

export async function uploadFile(buffer: Buffer, path: string): Promise<string> {
  try {
    const result = await client.put(path, buffer);
    return (result as any).name;
  } catch (e) {
    console.log("upload file failed:", e);
    throw e;
  }
}

export async function objectExists(path: string): Promise<boolean> {
  try {
    await client.head(path, { headers: internalDownloadHeaders() });
    return true;
  } catch (error: any) {
    if (error?.status === 404 || error?.code === "NoSuchKey") return false;
    throw error;
  }
}

/**
 * Generate a signed URL for OSS object
 * @param path OSS object path
 * @param expires Expiration time in seconds (default: 24 hours = 86400)
 * @returns Signed URL
 */
/**
 * 服务端内部下载专用签名 URL：使用 OSS 原生 endpoint 域名，
 * 不改写为 OSS_HOST 自定义域名——自定义域名证书过期/配置异常时，
 * worker 内部下载（参考图转 http、Gemini inline_data 等）不受影响。
 */
/**
 * 服务端内部下载 OSS 对象所需的请求头：桶开启了 Referer 白名单，
 * 无 Referer 的服务端/供应商回源请求会被拒（403 denied by referer policy）。
 * 以自定义域名自身作为 Referer 可通过校验。
 */
export function internalDownloadHeaders(): Record<string, string> {
  const host = (process.env.OSS_HOST || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return host ? { Referer: `https://${host}/` } : {};
}

export function getSignedInternalUrl(path: string, expires: number = 3600): string {
  return client.signatureUrl(path, { expires });
}

function rewriteSignedUrlHost(url: string): string {
  const ossHost = process.env.OSS_HOST;
  if (!ossHost) return url;
  const parsed = new URL(url);
  parsed.protocol = "https:";
  parsed.host = ossHost.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return parsed.toString();
}

/** 生成仅用于下载的短时签名地址，不改变对象本身用于预览的元数据。 */
export function getSignedDownloadUrl(
  path: string,
  fileName: string,
  expires: number = 600
): string {
  const extension = fileName.match(/(\.[A-Za-z0-9]{1,10})$/)?.[1] ?? "";
  const encodedName = encodeURIComponent(fileName);
  const url = client.signatureUrl(path, {
    expires,
    response: {
      "content-disposition":
        `attachment; filename="download${extension}"; filename*=UTF-8''${encodedName}`,
    },
  });
  return rewriteSignedUrlHost(url);
}

export async function getSignedUrl(path: string, expires: number = 86400): Promise<string> {
  try {
    const url = client.signatureUrl(path, {
      expires: expires,
    });
    return rewriteSignedUrlHost(url);
  } catch (e) {
    console.log("generate signed url failed:", e);
    throw e;
  }
}
