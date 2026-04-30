import { ImageGenerateParams } from "openai/resources/images.mjs";

export type ModelType = "doubao" | "gemini" | "gpt";

export type ImageSize =
  | "3136x1344"
  | "2848x1600"
  | "2496x1664"
  | "2304x1728"
  | "2048x2048"
  | "1728x2304"
  | "1664x2496"
  | "1600x2848"
  | "1792x1024"
  | "1536x1024"
  | "1024x1536"
  | "1024x1024"
  | "1024x1792"
  | "256x256"
  | "512x512"
  | "768x768";

export interface ModelConfig {
  aspectRatioSizeMap: Record<string, ImageSize>;
  responseFormat: "url" | "b64_json";
  watermark?: boolean;
  sequentialImageGeneration?: "disabled" | "auto";
  quality?: "standard" | "hd";
  n?: number;
}


export type ImageGenerateParamsType = ImageGenerateParams & {
  watermark?: boolean;
  sequential_image_generation?: "disabled" | "auto";
  image?: string | string[];
};
