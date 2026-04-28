import { respData } from "@/lib/resp";
import { getSupportedModels } from "@/services/model-config";

/**
 * 获取支持的模型列表
 */
export async function GET() {
  try {
    const models = getSupportedModels();
    return respData(models);
  } catch (e) {
    console.log("get models failed: ", e);
    return respData([]);
  }
}

