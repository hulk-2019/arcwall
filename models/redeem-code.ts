import { prisma } from "@/lib/prisma";
import { TransactionType } from "@prisma/client";

const REDEEM_CODE_CREDITS = 10;

/**
 * 生成一个随机兑换码
 */
function generateRandomCode(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 超管：生成兑换码
 */
export async function generateRedeemCodeForUser(creatorUserId: number) {
  const now = new Date();

  // 防止随机冲突，简单重试几次
  for (let i = 0; i < 5; i++) {
    const code = generateRandomCode();

    try {
      const redeemCode = await prisma.redeem_codes.create({
        data: {
          code,
          creator_id: creatorUserId,
          created_at: now,
        },
      });

      return redeemCode;
    } catch (e: any) {
      // 唯一键冲突时重试
      if (e?.code === "P2002") {
        continue;
      }
      throw e;
    }
  }

  throw new Error("generate.redeem.code.failed");
}

/**
 * 使用兑换码：
 * - 校验兑换码有效且未被使用
 * - 事务内同时更新 redeem_codes、user_balance、credit_transactions
 */
export async function redeemCodeForUser(
  userId: number,
  code: string
): Promise<number> {
  const now = new Date();

  const newBalance = await prisma.$transaction(
    async (tx) => {
      // 1. 查找兑换码并校验是否可用
      const redeemCode = await tx.redeem_codes.findUnique({
        where: { code },
      });

      if (!redeemCode) {
        throw new Error("redeem.code.invalid"); // 不存在
      }

      if (redeemCode.is_used) {
        throw new Error("redeem.code.used"); // 已使用
      }

      // 2. 获取当前余额
      const balance = await tx.user_balance.findUnique({
        where: { user_id: userId },
        select: { total_credits: true },
      });

      const currentBalance = balance?.total_credits ?? 0;
      const updatedBalance = currentBalance + REDEEM_CODE_CREDITS;

      // 3. 并发更新余额 & 交易记录 & 兑换码状态
      await Promise.all([
        // 更新或创建余额记录
        tx.user_balance.upsert({
          where: { user_id: userId },
          update: {
            total_credits: updatedBalance,
            updated_at: now,
          },
          create: {
            user_id: userId,
            total_credits: updatedBalance,
            updated_at: now,
          },
        }),
        // 记录交易流水
        tx.credit_transactions.create({
          data: {
            user_id: userId,
            amount: REDEEM_CODE_CREDITS,
            type: TransactionType.gift,
            remark: `Redeem code: ${code}`,
            balance_after: updatedBalance,
            created_at: now,
          },
        }),
        // 标记兑换码已使用
        tx.redeem_codes.update({
          where: { id: redeemCode.id },
          data: {
            is_used: true,
            used_by: userId,
            used_at: now,
          },
        }),
      ]);

      return updatedBalance;
    },
    {
      maxWait: 10000,
      timeout: 30000,
    }
  );

  return newBalance;
}
