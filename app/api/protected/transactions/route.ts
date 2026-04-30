import { respData, respErr } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findUserByEmail } from "@/models/user";
import { TransactionType } from "@prisma/client";
import { TransactionsQuerySchema } from "@/lib/schemas";

export async function GET(req: Request) {
  const auth = await requireAuthOrResponse();
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const { searchParams } = new URL(req.url);
    const parsed = TransactionsQuerySchema.safeParse({
      type: searchParams.get("type") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      return respErr(errMsg("invalid.params"));
    }
    const { type, page = 1, limit = 20 } = parsed.data;

    const user = await findUserByEmail(auth.email);
    if (!user) {
      return respErr(errMsg("user.not.found"));
    }

    let whereCondition: any = {
      user_id: user.id,
    };

    if (type === "consume") {
      whereCondition.type = TransactionType.consume;
    } else if (type === "recharge") {
      whereCondition.type = {
        in: [TransactionType.purchase, TransactionType.gift],
      };
    }

    const [totalCount, transactions] = await Promise.all([
      prisma.credit_transactions.count({ where: whereCondition }),
      prisma.credit_transactions.findMany({
        where: whereCondition,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return respData({
      items: transactions,
      total: totalCount,
      page,
      limit,
    });
  } catch (error) {
    console.error("fetch transactions failed:", error);
    return respErr(errMsg("fetch.transactions.failed"));
  }
}
