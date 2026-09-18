import { imageModelProvider } from "@/lib/canvas/registry";
import { gptImageSize, normalizeImageResolution } from "@/lib/image-size";
import {
  generateGeminiChatImage,
  generateGeminiNativeImage,
  generateGptImage,
  isProxyConfigured,
} from "@/services/image-proxy";
import { getDoubaoAIClient } from "@/services/openai";

function toReferenceList(image?: string | string[]): string[] {
  if (!image) return [];
  return Array.isArray(image) ? image : [image];
}

function firstImageUrl(payload: { data?: Array<{ url?: string; b64_json?: string }> } | undefined): string | null {
  const item = payload?.data?.[0];
  if (!item) return null;
  if (item.url) return item.url;
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
  return null;
}

export async function generateWallpaperRawImage(llm_params: {
  model: string;
  prompt: string;
  size?: string;
  aspectRatio?: string;
  image?: string | string[];
  [key: string]: unknown;
}): Promise<string> {
  const model = llm_params.model;
  const prompt = llm_params.prompt;
  const aspectRatio = llm_params.aspectRatio || "16:9";
  const resolution = normalizeImageResolution(llm_params.resolution);
  const imageSize = resolution.toUpperCase() as "1K" | "2K";
  const references = toReferenceList(llm_params.image);
  const provider = imageModelProvider(model);

  if (provider === "ark") {
    const client = getDoubaoAIClient();
    const { aspectRatio: _aspectRatio, resolution: _resolution, ...arkParams } = llm_params;
    const res = await client.images.generate(arkParams as any);
    const url = firstImageUrl(res);
    if (!url) throw new Error("Failed to generate image from Doubao");
    return url;
  }

  if (!isProxyConfigured()) {
    throw new Error("未配置 302.ai 代理（PROXY_302AI_API_KEY），无法使用该模型");
  }

  let urls: string[] = [];
  if (provider === "gpt-image") {
    urls = await generateGptImage({
      model,
      prompt,
      size: llm_params.size || gptImageSize(aspectRatio, resolution),
      referenceUrls: references,
    });
  } else if (provider === "gemini-native") {
    urls = await generateGeminiNativeImage({
      model,
      prompt,
      aspectRatio,
      imageSize,
      referenceUrls: references,
    });
  } else {
    urls = await generateGeminiChatImage({
      model,
      prompt: `${prompt}\n\n（请生成 ${aspectRatio}、${imageSize} 画幅的图片）`,
      referenceUrls: references,
    });
  }

  if (!urls[0]) throw new Error("Failed to generate image");
  return urls[0];
}
