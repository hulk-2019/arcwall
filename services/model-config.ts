import { ImageGenerateParams } from "openai/resources/images.mjs";

/**
 * 支持的模型类型（目前仅支持 doubao-seedream-4-0-250828）
 */
export type ModelType = "doubao-seedream-4-0-250828";

/**
 * 支持的图片尺寸类型
 */
export type ImageSize =
  | "1792x1024"
  | "1024x1024"
  | "1536x1024"
  | "1024x1536"
  | "1024x1792"
  | "256x256"
  | "512x512"
  | "768x768";

/**
 * 模型配置接口
 */
export interface ModelConfig {
  model: string;
  defaultSize: ImageSize;
  supportedSizes: ImageSize[];
  responseFormat: "url" | "b64_json";
  watermark?: boolean;
  sequentialImageGeneration?: "disabled" | "auto";
  quality?: "standard" | "hd";
  n?: number; // 生成图片数量
}

/**
 * 模型配置映射（目前仅支持 doubao-seedream-4-0-250828）
 */
const MODEL_CONFIGS: Record<ModelType, ModelConfig> = {
  "doubao-seedream-4-0-250828": {
    model: "doubao-seedream-4-0-250828",
    defaultSize: "1792x1024",
    supportedSizes: ["1792x1024", "1024x1024", "1536x1024", "1024x1536"],
    responseFormat: "url",
    watermark: false,
    sequentialImageGeneration: "disabled",
  },
};

/**
 * 获取模型配置
 * @param modelType 模型类型（可选，默认使用 doubao-seedream-4-0-250828）
 * @returns 模型配置
 */
export function getModelConfig(modelType: ModelType | string = "doubao-seedream-4-0-250828"): ModelConfig {
  // 目前仅支持 doubao-seedream-4-0-250828，直接返回该配置
  return MODEL_CONFIGS["doubao-seedream-4-0-250828"];
}

/**
 * 根据宽高比和模型配置获取合适的尺寸
 * @param aspectRatio 宽高比，如 "16:9", "4:3", "1:1", "9:16"
 * @param modelConfig 模型配置
 * @returns 图片尺寸
 */
export function getSizeForAspectRatio(
  aspectRatio: string,
  modelConfig: ModelConfig
): ImageSize {
  const ratioMap: Record<string, string> = {
    "16:9": "1792x1024",
    "4:3": "1536x1024",
    "1:1": "1024x1024",
    "9:16": "1024x1536",
  };

  const preferredSize = ratioMap[aspectRatio] || modelConfig.defaultSize;

  // 检查模型是否支持该尺寸，如果不支持则使用默认尺寸
  if (modelConfig.supportedSizes.includes(preferredSize as any)) {
    return preferredSize as any;
  }

  return modelConfig.defaultSize as any;
}

type ImageGenerateParamsType = ImageGenerateParams & { watermark?: boolean; sequential_image_generation?: "disabled" | "auto"; image?: string | string[]; };

/**
 * 构建图片生成参数
 * @param modelType 模型类型
 * @param prompt 提示词
 * @param aspectRatio 宽高比
 * @param options 额外选项
 * @returns 图片生成参数
 */
export function buildImageGenerateParams(
  modelType: ModelType | string,
  prompt: string,
  aspectRatio: string = "16:9",
  options?: {
    quality?: "standard" | "hd";
    size?: string;
    imgUrl?: string;
  }
): ImageGenerateParamsType {
  const modelConfig = getModelConfig(modelType);
  const size = options?.size || getSizeForAspectRatio(aspectRatio, modelConfig);

  // 构建基础参数
  const params: ImageGenerateParamsType = {
    model: modelConfig.model,
    prompt: prompt,
    size: size as any,
    response_format: modelConfig.responseFormat,
    n: modelConfig.n || 1,
  };

  // Add image_url if provided
  if (options?.imgUrl) {
    params.image = options.imgUrl;
  }

  // 添加模型特定的参数
  if (modelConfig.watermark !== undefined) {
    params.watermark = modelConfig.watermark;
  }

  if (modelConfig.sequentialImageGeneration !== undefined) {
    params.sequential_image_generation = modelConfig.sequentialImageGeneration;
  }

  if (modelConfig.quality !== undefined) {
    params.quality = options?.quality || modelConfig.quality;
  }

  return params;
}

/**
 * 获取所有支持的模型列表
 * @returns 模型列表
 */
export function getSupportedModels(): Array<{ type: ModelType; name: string; config: ModelConfig }> {
  return Object.entries(MODEL_CONFIGS).map(([type, config]) => ({
    type: type as ModelType,
    name: config.model,
    config,
  }));
}
