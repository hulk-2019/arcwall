import { getDoubaoAIClient } from "@/services/openai";
import { respData, respErr } from "@/lib/resp";
import { requireAuthOrResponse } from "@/lib/auth";
import { getUserBalanceByEmail, consumeCreditsAndSavePromptOptimization } from "@/services/credit";
import { findUserByEmail } from "@/models/user";
import { OptimizePromptSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const auth = await requireAuthOrResponse();
    if (auth instanceof Response) {
      return auth;
    }

    const user_email = auth.email;

    const body = await req.json();
    const parsed = OptimizePromptSchema.safeParse(body);
    if (!parsed.success) {
      return respErr("prompt is required");
    }
    const { prompt, language } = parsed.data;

    const openai = getDoubaoAIClient();

    let systemContent =
      "You are an expert AI image generation prompt engineer. Your task is to take a short, basic user prompt and expand it into a detailed, highly descriptive prompt optimized for AI image generators (like Doubao、Nano Banana or Midjourney). Add descriptive keywords about lighting, composition, mood, medium, and style to make the image visually stunning. Keep the final prompt under 500 characters. Return ONLY the optimized prompt, without any conversational text, explanations, or quotes.";
    if (language === "zh") {
      systemContent =
        "你是一个专业的AI图像生成提示词工程师。你的任务是获取一个简短的、基本的用户提示，并将其扩展为一个详细的、高度描述性的提示，该提示专门针对AI图像生成器（如豆包、Nano Banana或Midjourney）进行了优化。添加关于光线、构图、情绪、媒介和风格的描述性关键词，使图像在视觉上令人惊叹。最终的提示词必须是中文。请保持最终提示词在500个字符以内。只返回优化后的提示词，不要包含任何对话文本、解释或引号。";
    }

    // 获取用户信息以获取用户ID
    const user = await findUserByEmail(user_email);
    if (!user || !user.id) {
      return respErr("user.not.found");
    }

    // 从 user_balance 表查询余额
    const user_balance = await getUserBalanceByEmail(user_email);
    if (user_balance < 1) {
      return respErr("credits.not.enough");
    }

    const response = await openai.chat.completions.create({
      model: "doubao-seed-2-0-lite-260215",
      messages: [
        {
          role: "system",
          content: systemContent,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    const optimizedPrompt = response.choices[0]?.message?.content?.trim();
    if (!optimizedPrompt) {
      return respErr("failed to optimize prompt");
    }

    // 在事务中同时扣减credit和保存提示词优化记录，确保原子性
    try {
      await consumeCreditsAndSavePromptOptimization(
        user.id,
        prompt,
        optimizedPrompt
      );
    } catch (e) {
      console.error("consume credits and save prompt optimization failed: ", e);
      if (e instanceof Error && e.message === "insufficient.credits") {
        return respErr("credits.not.enough");
      }
      return respErr("consume.credits.failed");
    }

    return respData(optimizedPrompt);
  } catch (error) {
    console.error("Optimize prompt failed:", error);
    return respErr("failed to optimize prompt");
  }
}
