import OpenAI, { toFile } from "openai";
import axios from "axios";
import sharp from "sharp";
import { internalDownloadHeaders } from "@/lib/oss";

/**
 * 302.ai 代理图片模型接入：
 * - GPT-Image 系列：OpenAI 兼容 /v1/images/generations（尺寸为 16 倍数，支持 1K/2K）
 * - Nano Banana 2：Gemini 原生 contents 格式（aspectRatio 控制画幅，返回图片 URL）
 * - Nano Banana Pro：OpenAI 兼容 chat/completions（图片以 markdown 链接返回，不支持流式）
 * 文档：doc.302.ai/288853804e0（gpt-image-2）、420136727e0（nano-banana-2）、380231548e0（nano-banana-pro）
 */

/** 惰性读取：避免模块加载早于 dotenv 的场景读到空值 */

/** 下载 OSS 参考图（带桶 Referer 白名单所需的请求头） */
async function downloadReference(url: string): Promise<{ buffer: Buffer; mime: string }> {
  if (url.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(url);
    if (!match) throw new Error("invalid data url");
    return { buffer: Buffer.from(match[2], "base64"), mime: match[1] };
  }
  const resp = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 120_000,
    headers: internalDownloadHeaders(),
  });
  return {
    buffer: Buffer.from(resp.data),
    mime: String(resp.headers["content-type"] || "image/png"),
  };
}

/**
 * 参考图归一化：长边压到 1536（编辑端点输出上限），过大的输入只会
 * 增加上传体积、输入 token 与网关超时风险（曾触发 499）。
 */
async function normalizeReference(buffer: Buffer, mime: string): Promise<{ buffer: Buffer; mime: string }> {
  try {
    const img = sharp(buffer, { failOn: "none" });
    const meta = await img.metadata();
    const longest = Math.max(meta.width || 0, meta.height || 0);
    const hasAlpha = !!meta.hasAlpha;
    // 无透明通道一律 JPEG 重编码：编辑端点输出上限 1536，PNG 数 MB 级体积
    // 只会推高上传耗时与输入 token，且易触发网关超时。
    const resized = longest > 1536;
    const pipeline = resized
      ? img.resize({
          width: meta.width! >= meta.height! ? 1536 : undefined,
          height: meta.height! > meta.width! ? 1536 : undefined,
        })
      : img;
    if (!hasAlpha && (resized || buffer.length > 1024 * 1024)) {
      const out = await pipeline.jpeg({ quality: 88 }).toBuffer();
      return { buffer: out, mime: "image/jpeg" };
    }
    if (resized) {
      const out = await pipeline.png().toBuffer();
      return { buffer: out, mime: "image/png" };
    }
    return { buffer, mime };
  } catch {
    return { buffer, mime };
  }
}

/** 供应商瞬时故障（499/5xx）单次重试 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    if (e?.status === 499 || (typeof e?.status === "number" && e.status >= 500)) {
      return await fn();
    }
    throw e;
  }
}

function proxyKey(): string {
  return (process.env.PROXY_302AI_API_KEY || "").trim();
}

export function proxyBase(): string {
  return (process.env.PROXY_302AI_BASE_URL || "https://api.302.ai")
    .trim()
    // 容错：剥离误写的包裹引号与行尾分号（.env 常见笔误）
    .replace(/^["']+/, "")
    .replace(/["';\s]+$/, "")
    .replace(/\/+$/, "");
}

export function isProxyConfigured(): boolean {
  return proxyKey().length > 0;
}

export function requireProxy(): { baseUrl: string; headers: Record<string, string> } {
  const key = proxyKey();
  if (!key) {
    throw new Error("未配置 302.ai 代理（PROXY_302AI_API_KEY）");
  }
  return {
    baseUrl: proxyBase(),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  };
}

export function getProxy302Client(): OpenAI {
  const { baseUrl } = requireProxy();
  return new OpenAI({ baseURL: `${baseUrl}/v1`, apiKey: proxyKey() });
}

export { gptImageSize } from "@/lib/image-size";

/**
 * GPT-Image 系列；返回原始图片（http url 或 data:base64）。
 * - 无参考图：/v1/images/generations（size 支持 16 倍数，1K/2K）；
 * - 有参考图（局部调整/图生图）：/v1/images/edits（multipart）。
 *   generations 端点的 schema 不含 image 字段，参考图会被静默忽略（曾导致
 *   “局部调整变成重新生成”）；edits 端点 size 仅支持 1024/1536 系与 auto，
 *   用 auto 最贴近原图构图，配合 input_fidelity=high 保留原图细节。
 */
export async function generateGptImage(params: {
  model: string;
  prompt: string;
  size: string;
  referenceUrls?: string[];
}): Promise<string[]> {
  const client = getProxy302Client();
  const pickUrls = (res: any): string[] =>
    (res?.data || [])
      .map((d: any) => d?.url || (d?.b64_json ? `data:image/png;base64,${d.b64_json}` : null))
      .filter(Boolean);

  if (params.referenceUrls && params.referenceUrls.length > 0) {
    const files = await Promise.all(
      params.referenceUrls.slice(0, 16).map(async (url, index) => {
        const raw = await downloadReference(url);
        const norm = await normalizeReference(raw.buffer, raw.mime);
        return toFile(norm.buffer, `ref-${index}.png`, { type: norm.mime });
      })
    );
    // 注意：不带 input_fidelity——实测该参数（未入 302 schema）会使请求
    // 在其网关侧超时（499/504，360s 无返回）；去掉后 56s 内正常出图。
    const res = await withRetry(() =>
      client.images.edit({
        model: params.model,
        prompt: params.prompt,
        // 302 单图编辑要求字段名为 `image`；数组会被 SDK 编码为
        // `image[]`，其网关会以 403 Parameter error 拒绝。
        image: files.length === 1 ? files[0] : files,
        size: "auto",
        n: 1,
      } as any)
    );
    const urls = pickUrls(res);
    if (urls.length === 0) throw new Error("GPT-Image 编辑未返回结果");
    return urls;
  }

  const res = await client.images.generate({
    model: params.model,
    prompt: params.prompt,
    size: params.size,
    n: 1,
  } as any);
  const urls = pickUrls(res);
  if (urls.length === 0) throw new Error("GPT-Image 模型未返回结果");
  return urls;
}

/** Nano Banana 2（Gemini 原生格式）；返回图片 http url */
export async function generateGeminiNativeImage(params: {
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize?: "1K" | "2K";
  referenceUrls?: string[];
}): Promise<string[]> {
  const { baseUrl, headers } = requireProxy();

  const parts: Record<string, unknown>[] = [{ text: params.prompt }];
  // 参考图：inline_data（base64，经归一化控制体积）
  for (const url of params.referenceUrls ?? []) {
    const raw = await downloadReference(url);
    const norm = await normalizeReference(raw.buffer, raw.mime);
    parts.push({
      inline_data: {
        mime_type: norm.mime,
        data: norm.buffer.toString("base64"),
      },
    });
  }

  const resp = await withRetry(() =>
    axios.post(
      `${baseUrl}/google/v1/models/${params.model}?response_format=url`,
      {
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio: params.aspectRatio,
            ...(params.imageSize ? { imageSize: params.imageSize } : {}),
          },
        },
      },
      { headers, timeout: 180_000 }
    )
  );

  const partsOut = resp.data?.candidates?.[0]?.content?.parts ?? [];
  const urls: string[] = partsOut
    .map((p: any) => p?.url || (p?.inlineData?.data ? `data:image/png;base64,${p.inlineData.data}` : null))
    .filter(Boolean);
  if (urls.length === 0) throw new Error("Nano Banana 2 模型未返回结果");
  return urls;
}

/** Nano Banana Pro（OpenAI 兼容 chat/completions）；图片以 markdown 链接返回 */
export async function generateGeminiChatImage(params: {
  model: string;
  prompt: string;
  referenceUrls?: string[];
}): Promise<string[]> {
  const client = getProxy302Client();
  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: params.prompt },
  ];
  // 参考图以 data URL 内联（经归一化）：302.ai 回源拉取 OSS 会被桶的 Referer 策略拒绝
  for (const url of params.referenceUrls ?? []) {
    const raw = await downloadReference(url);
    const norm = await normalizeReference(raw.buffer, raw.mime);
    content.push({
      type: "image_url",
      image_url: { url: `data:${norm.mime};base64,${norm.buffer.toString("base64")}` },
    });
  }

  const res = await withRetry(() =>
    client.chat.completions.create({
      model: params.model,
      stream: false, // 该模型不支持流式
      messages: [{ role: "user", content }],
    })
  );

  const text = res.choices?.[0]?.message?.content || "";
  const urls: string[] = [];
  const mdRegex = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = mdRegex.exec(text)) !== null) {
    urls.push(match[1]);
  }
  // 兼容裸链接输出
  if (urls.length === 0) {
    const bare = text.match(/https?:\/\/[^\s)"']+\.(?:png|jpe?g|webp)[^\s)"']*/gi);
    if (bare) urls.push(...bare);
  }
  if (urls.length === 0) throw new Error("Nano Banana Pro 模型未返回结果");
  return urls;
}
