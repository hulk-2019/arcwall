import type { ModelConfig, ModelType, ImageSize, ImageGenerateParamsType } from "@/types/model-config";

/**
 * 模型配置映射（目前仅支持 doubao-seedream-4-0-250828）
 */
const MODEL_CONFIGS: Record<ModelType, ModelConfig> = {
  doubao: {
    aspectRatioSizeMap: {
      "1:1": "2048x2048",
      "4:3": "2304x1728",
      "3:4": "1728x2304",
      "16:9": "2848x1600",
      "9:16": "1600x2848",
      "3:2": "2496x1664",
      "2:3": "1664x2496",
      "21:9": "3136x1344",
    },
    responseFormat: "url",
    watermark: false,
    sequentialImageGeneration: "disabled",
  },
  gemini: {
    aspectRatioSizeMap: {
      "1:1": "1024x1024",
    },
    responseFormat: "url",
    watermark: false,
    sequentialImageGeneration: "disabled",
  },
  gpt: {
    aspectRatioSizeMap: {
      "1:1": "1024x1024",
    },
    responseFormat: "url",
    watermark: false,
    sequentialImageGeneration: "disabled",
  },
};

/**
 * 根据宽高比和模型配置获取合适的尺寸
 * @param aspectRatio 宽高比，如 "16:9", "4:3", "1:1", "9:16"
 * @param modelConfig 模型配置
 * @param modelType 模型类型
 * @returns 图片尺寸
 */
export function getSizeForAspectRatio(
  aspectRatio: string,
  modelConfig: ModelConfig
): ImageSize {
  const fallbackRatioMap = MODEL_CONFIGS.doubao?.aspectRatioSizeMap || {};
  const ratioMap = modelConfig.aspectRatioSizeMap || fallbackRatioMap;

  return ratioMap[aspectRatio] || fallbackRatioMap["1:1"] || "1024x1024";
}

/**
 * 匹配模型
 * @param modelType 
 * @returns 
 */
function matchModelType(modelType: string): ModelType | null {
  const normalized = modelType.toLowerCase();

  if (normalized.startsWith("gemini")) {
    return "gemini";
  }

  if (normalized.startsWith("gpt")) {
    return "gpt";
  }

  if (normalized.startsWith("doubao")) {
    return "doubao";
  }

  return null;
}

const MODEL_PARAM_RULES: Record<
  ModelType,
  {
    withSize: boolean;
    withResponseFormat: boolean;
    withN: boolean;
    withImage: boolean;
    withWatermark: boolean;
    withSequentialImageGeneration: boolean;
    withQuality: boolean;
  }
> = {
  doubao: {
    withSize: true,
    withResponseFormat: true,
    withN: true,
    withImage: true,
    withWatermark: true,
    withSequentialImageGeneration: true,
    withQuality: true,
  },
  gemini: {
    withSize: true,
    withResponseFormat: false,
    withN: true,
    withImage: true,
    withWatermark: false,
    withSequentialImageGeneration: false,
    withQuality: true,
  },
  gpt: {
    withSize: true,
    withResponseFormat: true,
    withN: true,
    withImage: true,
    withWatermark: false,
    withSequentialImageGeneration: false,
    withQuality: true,
  },
};

function isValidSizeForDoubao(size: string): boolean {
  const [widthStr, heightStr] = size.split("x");
  const width = Number(widthStr);
  const height = Number(heightStr);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return false;
  }

  return width * height >= 3686400;
}

/**
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
    imgUrl?: string | string[];
  }
): ImageGenerateParamsType | null  { 
  const matchedModelType = matchModelType(modelType);

  if (!matchedModelType) {
    return null;
  }
  const modelConfig = MODEL_CONFIGS[matchedModelType];
  
  const size = modelConfig.aspectRatioSizeMap[aspectRatio];

  const rules = MODEL_PARAM_RULES[matchedModelType];

  const params: ImageGenerateParamsType = {
    model: modelType,
    prompt,
  };

  if (rules.withSize) {
    params.size = size as any;
  }

  if (rules.withResponseFormat) {
    params.response_format = modelConfig.responseFormat;
  }

  if (rules.withN) {
    params.n = modelConfig.n || 1;
  }

  if (rules.withImage && options?.imgUrl) {
    params.image = options.imgUrl;
  }

  if (rules.withWatermark && modelConfig.watermark !== undefined) {
    params.watermark = modelConfig.watermark;
  }

  if (rules.withSequentialImageGeneration && modelConfig.sequentialImageGeneration !== undefined) {
    params.sequential_image_generation = modelConfig.sequentialImageGeneration;
  }

  if (rules.withQuality) {
    if (options?.quality) {
      params.quality = options.quality;
    } else if (modelConfig.quality !== undefined) {
      params.quality = modelConfig.quality;
    }
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
    name: type,
    config,
  }));
}
