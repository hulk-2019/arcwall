import OSS from "ali-oss";
import { Readable } from "stream";
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
    // Download image to buffer
    const response = await axios({
      method: "GET",
      url: imageUrl,
      responseType: "arraybuffer",
    });

    const imageBuffer = Buffer.from(response.data);
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

export async function uploadFile(buffer: Buffer, path: string): Promise<string> {
  try {
    const result = await client.put(path, buffer);
    return (result as any).name;
  } catch (e) {
    console.log("upload file failed:", e);
    throw e;
  }
}

/**
 * Generate a signed URL for OSS object
 * @param path OSS object path
 * @param expires Expiration time in seconds (default: 24 hours = 86400)
 * @returns Signed URL
 */
export async function getSignedUrl(path: string, expires: number = 86400): Promise<string> {
  try {
    const url = client.signatureUrl(path, {
      expires: expires,
    });
    const ossHost = process.env.OSS_HOST;
    if (ossHost) {
      const parsed = new URL(url);
      parsed.protocol = 'https';
      parsed.host = ossHost;
      return parsed.toString();
    }
    return url;
  } catch (e) {
    console.log("generate signed url failed:", e);
    throw e;
  }
}
