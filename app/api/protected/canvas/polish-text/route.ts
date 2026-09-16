import { NextRequest } from "next/server";
import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { getUserBalance, adjustUserCreditsInTx } from "@/services/credit";
import { getOwnedCanvas } from "@/models/canvas";
import { STORYBOARD_MODEL, POLISH_TEXT_COST } from "@/lib/canvas/registry";
import { getDoubaoAIClient } from "@/services/openai";
import { prisma } from "@/lib/prisma";
import { TransactionType } from "@prisma/client";

/**
 * 文本节点 AI 润色（PRD-NOD-003）：对用户手写文案做不改写语义的润色扩写。
 * 独立小额计费（POLISH_TEXT_COST 积分），余额不足时拒绝。
 */
export async function POST(req: NextRequest) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  try {
    const user = await findUserByEmail(auth.email);
    if (!user?.id) return respErr(errMsg("user.not.found"));
    const userId = user.id;

    const body = await req.json();
    const canvasId = Number(body?.canvasId);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!canvasId || Number.isNaN(canvasId)) return respErr(errMsg("invalid.params"));
    if (!text) return respErr(errMsg("invalid.params"));
    if (text.length > 5000) return respErr(errMsg("canvas.polish.too.long"));

    const canvas = await getOwnedCanvas(userId, canvasId);
    if (!canvas) return respErr(errMsg("canvas.permission.denied"));

    const balance = await getUserBalance(userId);
    if (balance < POLISH_TEXT_COST) {
      return respErr(errMsg("credits.not.enough"));
    }

    const client = getDoubaoAIClient();
    const response = await client.chat.completions.create({
      model: STORYBOARD_MODEL,
      messages: [
        {
          role: "system",
          content:
            "你是专业的创意文案编辑。对用户提供的文案进行润色：修正错别字与语病，提升表达的流畅度与画面感，保持原意、原语言与大致篇幅不变。直接输出润色后的正文，不要任何解释、前后缀或引号。",
        },
        { role: "user", content: text },
      ],
      temperature: 0.5,
      max_tokens: 4000,
    });

    const polished = response.choices?.[0]?.message?.content?.trim();
    if (!polished) return respErr(errMsg("canvas.polish.failed"));

    await prisma.$transaction((tx) =>
      adjustUserCreditsInTx(tx, userId, -POLISH_TEXT_COST, TransactionType.consume, "画布文本AI润色")
    );

    return respData({ text: polished, cost: POLISH_TEXT_COST });
  } catch (e) {
    if (e instanceof Error && e.message === "insufficient.credits") {
      return respErr(errMsg("credits.not.enough"));
    }
    console.error("polish canvas text failed:", e);
    return respErr(errMsg("canvas.polish.failed"));
  }
}
