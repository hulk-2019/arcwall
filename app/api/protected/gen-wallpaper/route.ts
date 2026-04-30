import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";

import { Wallpaper } from "@/types/wallpaper";
import { requireAuthOrResponse } from "@/lib/auth";
import { getUserBalanceByEmail, consumeCreditsAndSaveWallpaper } from "@/services/credit";
import { findUserByEmail } from "@/models/user";
import { addSignedUrlsToWallpaper } from "@/lib/wallpaper-utils";
import { getSignedUrl, fetchImageAsBase64 } from "@/lib/oss";
import { buildImageGenerateParams } from "@/services/model-config";
import type { ModelType } from "@/types/model-config";
import { buildPrompt } from "@/lib/prompt-builder";
import { redis } from "@/lib/redis";
import { GenWallpaperSchema } from "@/lib/schemas";
import { redisKeys, redisTTL } from "@/lib/constants";

export async function POST(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body = await req.json();
    const parsed = GenWallpaperSchema.safeParse(body);
    if (!parsed.success) {
      return respErr(errMsg("invalid.params"));
    }
    const { description, aspectRatio, model, language, imgPath } = parsed.data;

    const ratio = aspectRatio || "16:9";
    const modelType: ModelType | string = model;
    const lang = language === "zh" ? "zh" : "EN";

    const user_email = auth.email;

    // 并行获取用户信息和余额
    const [user, user_balance] = await Promise.all([
      findUserByEmail(user_email),
      getUserBalanceByEmail(user_email),
    ]);

    if (!user || !user.id) {
      return respErr(errMsg("user.not.found"));
    }

    // Rate Limiting: Limit 10 requests per minute per user
    const rateLimitKey = redisKeys.genWallpaperRateLimit(user.id);
    const currentRequests = await redis.incr(rateLimitKey);
    if (currentRequests === 1) {
      await redis.expire(rateLimitKey, redisTTL.rateLimitWindow);
    }
    if (currentRequests > 10) {
      return respErr(errMsg("too.many.requests"));
    }

    const concurrencyKey = redisKeys.genWallpaperConcurrencyLock(user.id);
    const acquired = await redis.set(concurrencyKey, "1", "EX", redisTTL.concurrencyLock, "NX");
    if (!acquired) {
      return respErr(errMsg("request.pending"));
    }

    if (user_balance < 1) {
      return respErr(errMsg("credits.not.enough"));
    }

    // 构建提示词（支持中英文切换）
    const prompt = buildPrompt(description, lang);

    // 如果有参考图，下载后转 base64 传给模型，绕过 OSS 防盗链
    let resolvedImgUrl: string | string[] | undefined;
    if (imgPath && imgPath.length > 0) {
      const base64List = await Promise.all(
        imgPath.map(async (p) => {
          const signedUrl = await getSignedUrl(p, 3600);
          return fetchImageAsBase64(signedUrl);
        })
      );
      resolvedImgUrl = base64List.length === 1 ? base64List[0] : base64List;
    }

    // 使用模型配置服务构建参数，从参数中动态获取模型名称
    const llm_params = buildImageGenerateParams(modelType, prompt, ratio, { imgUrl: resolvedImgUrl });

    if (!llm_params) {
      return respErr(errMsg("invalid.params"));

    }
    const llm_name = llm_params.model as string;

    // 从参数中获取图片尺寸（用于保存到数据库）
    const img_size = llm_params.size as string;

    const created_at = new Date().toISOString();

    // 准备wallpaper数据 (初始状态)
    const wallpaper: Wallpaper = {
      user_id: user.id,
      img_description: description,
      img_size: img_size,
      aspect_ratio_name: ratio,
      model_key: modelType as string,
      aspect_ratio_key: ratio,
      img_path: "", // 初始为空
      img_thumbnail_path: "", // 初始为空
      img_watermark_path: "", // 初始为空
      model_name: llm_name,
      llm_params: JSON.stringify({ ...llm_params, image: undefined, imgPath }),
      created_at: created_at,
      status: 0, // Generating
    };

    // 在事务中同时扣减credit和保存wallpaper，确保原子性
    let savedWallpaperId: number;
    try {
      const result = await consumeCreditsAndSaveWallpaper(user.id, wallpaper);
      savedWallpaperId = result.wallpaperId;
      wallpaper.id = savedWallpaperId;
    } catch (e) {
      console.log("consume credits and save wallpaper failed: ", e);
      if (e instanceof Error && e.message === "insufficient.credits") {
        return respErr(errMsg("credits.not.enough"));
      }
      return respErr(errMsg("consume.credits.failed"));
    }

    // Add job to queue
    try {
      const { wallpaperQueue } = await import("@/lib/queue");
      await wallpaperQueue.add('generate', {
        wallpaperId: savedWallpaperId,
        llm_params: llm_params,
      });
    } catch (e) {
      console.error("Failed to add job to queue:", e);
      // Optional: revert credit deduction or mark as failed immediately
      // For now, we'll just log it. The user will see it stuck in "Generating" or we can add a cleanup task later.
      // Ideally, we should update status to Failed here.
       await import("@/lib/prisma").then(m => m.prisma.wallpapers.update({
          where: { id: savedWallpaperId },
          data: { status: 2, failure_reason: "Failed to enqueue job" }
       }));
       return respErr(errMsg("generate.wallpaper.failed"));
    }

    // Generate signed URLs for client (even if empty, to match type)
    const wallpaperWithUrls = await addSignedUrlsToWallpaper(wallpaper);

    return respData(wallpaperWithUrls);
  } catch (e) {
    console.log("generate wallpaper failed: ", e);
    return respErr(errMsg("generate.wallpaper.failed"));
  }
}
