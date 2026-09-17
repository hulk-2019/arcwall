import OpenAI from "openai";
import axios from "axios";

/**
 * 302.ai 代理图片模型接入：
 * - GPT-Image 系列：OpenAI 兼容 /v1/images/generations（尺寸为 16 倍数，支持 1K/2K）
 * - Nano Banana 2：Gemini 原生 contents 格式（aspectRatio 控制画幅，返回图片 URL）
 * - Nano Banana Pro：OpenAI 兼容 chat/completions（图片以 markdown 链接返回，不支持流式）
 * 文档：doc.302.ai/288853804e0（gpt-image-2）、420136727e0（nano-banana-2）、380231548e0（nano-banana-pro）
 */

/** 惰性读取：避免模块加载早于 dotenv 的场景读到空值 */
function proxyKey(): string {
  return (process.env.PROXY_302AI_API_KEY || "").trim();
}

function proxyBase(): string {
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

function requireProxy(): { baseUrl: string; headers: Record<string, string> } {
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

/** gpt-image-2：1K/2K 指长边 1024/2048，宽高须为 16 的倍数 */
export function gptImageSize(aspectRatio: string, resolution: string): string {
  const m = /^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/.exec(aspectRatio || "");
  const w = m ? Number(m[1]) : 16;
  const h = m ? Number(m[2]) : 9;
  const long = resolution === "2k" ? 2048 : 1024;
  const round16 = (v: number) => Math.max(16, Math.round(v / 16) * 16);
  if (w >= h) {
    return `${long}x${round16((long * h) / w)}`;
  }
  return `${round16((long * w) / h)}x${long}`;
}

/** GPT-Image 系列（OpenAI 兼容 images API）；返回原始图片（http url 或 data:base64） */
export async function generateGptImage(params: {
  model: string;
  prompt: string;
  size: string;
  referenceUrls?: string[];
}): Promise<string[]> {
  const client = getProxy302Client();
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    size: params.size,
    n: 1,
  };
  // gpt-image 支持多参考图编辑（image 数组）
  if (params.referenceUrls && params.referenceUrls.length > 0) {
    body.image = params.referenceUrls.length === 1 ? params.referenceUrls[0] : params.referenceUrls;
  }
  const res = await client.images.generate(body as any);
  const urls: string[] = (res?.data || [])
    .map((d: any) => d?.url || (d?.b64_json ? `data:image/png;base64,${d.b64_json}` : null))
    .filter(Boolean);
  if (urls.length === 0) throw new Error("GPT-Image 模型未返回结果");
  return urls;
}

/** Nano Banana 2（Gemini 原生格式）；返回图片 http url */
export async function generateGeminiNativeImage(params: {
  model: string;
  prompt: string;
  aspectRatio: string;
  referenceUrls?: string[];
}): Promise<string[]> {
  const { baseUrl, headers } = requireProxy();

  const parts: Record<string, unknown>[] = [{ text: params.prompt }];
  // 参考图：inline_data（base64）
  for (const url of params.referenceUrls ?? []) {
    const resp = await axios.get(url, { responseType: "arraybuffer", timeout: 60_000 });
    const mime = String(resp.headers["content-type"] || "image/png");
    parts.push({
      inline_data: {
        mime_type: mime,
        data: Buffer.from(resp.data).toString("base64"),
      },
    });
  }

  const resp = await axios.post(
    `${baseUrl}/google/v1/models/${params.model}?response_format=url`,
    {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio: params.aspectRatio },
      },
    },
    { headers, timeout: 180_000 }
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
  for (const url of params.referenceUrls ?? []) {
    content.push({ type: "image_url", image_url: { url } });
  }

  const res = await client.chat.completions.create({
    model: params.model,
    stream: false, // 该模型不支持流式
    messages: [{ role: "user", content }],
  });

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
