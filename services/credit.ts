import { prisma } from "@/lib/prisma";
import { TransactionType } from "@prisma/client";
import { Wallpaper } from "@/types/wallpaper";
import { UserCredits } from "@/types/user";
import { getUserWallpapersCount } from "@/models/wallpaper";

/**
 * 使用事务更新用户余额和记录交易流水
 * @param user_id 用户ID (users表的id，需要转换为BigInt)
 * @param amount 变动数量（正数=增加，负数=扣减）
 * @param type 交易类型
 * @param remark 备注
 * @returns 更新后的余额
 */
export async function updateUserCredits(
  user_id: number,
  amount: number,
  type: TransactionType,
  remark?: string
): Promise<number> {
  const userId = Number(user_id);
  const now = new Date();

  // 增加事务超时时间到 30 秒
  return await prisma.$transaction(
    async (tx) => {
      // 先获取当前余额（使用 select 只查询需要的字段，提高性能）
      const balance = await tx.user_balance.findUnique({
        where: { user_id: userId },
        select: { total_credits: true },
      });

      const currentBalance = balance?.total_credits ?? 0;

      // 计算新余额
      const newBalance = currentBalance + amount;

      // 如果余额不足（扣减时），抛出错误
      if (newBalance < 0) {
        throw new Error("insufficient.credits");
      }

      // 并发执行两个操作，提高性能
      // 这两个操作之间没有数据依赖关系，可以并发执行
      await Promise.all([
        // 使用 upsert 来更新或创建余额记录
        tx.user_balance.upsert({
          where: { user_id: userId },
          update: {
            total_credits: newBalance,
            updated_at: now,
          },
          create: {
            user_id: userId,
            total_credits: newBalance,
            updated_at: now,
          },
        }),
        // 记录交易流水
        tx.credit_transactions.create({
          data: {
            user_id: userId,
            amount: amount,
            type: type,
            remark: remark || null,
            balance_after: newBalance,
            created_at: now,
          },
        }),
      ]);

      return newBalance;
    },
    {
      maxWait: 10000, // 等待锁的最大时间：10秒
      timeout: 30000, // 事务超时时间：30秒
    }
  );
}

/**
 * 在事务中同时扣减credit和保存提示词优化记录，确保原子性
 * @param user_id 用户ID
 * @param user_email 用户邮箱
 * @param original_prompt 原始提示词
 * @param optimized_prompt 优化后的提示词
 * @returns 更新后的余额和保存的记录ID
 */
export async function consumeCreditsAndSavePromptOptimization(
  user_id: number,
  original_prompt: string,
  optimized_prompt: string
): Promise<{ balance: number; id: number }> {
  const userId = Number(user_id);
  const now = new Date();

  return await prisma.$transaction(
    async (tx) => {
      // 1. 获取当前余额
      const balance = await tx.user_balance.findUnique({
        where: { user_id: userId },
        select: { total_credits: true },
      });

      const currentBalance = balance?.total_credits ?? 0;

      // 2. 计算新余额（扣减1个credit）
      const newBalance = currentBalance - 1;

      // 3. 如果余额不足，抛出错误
      if (newBalance < 0) {
        throw new Error("insufficient.credits");
      }

      // 4. 并发执行三个操作，提高性能
      const [, , savedOptimization] = await Promise.all([
        // 更新或创建余额记录
        tx.user_balance.upsert({
          where: { user_id: userId },
          update: {
            total_credits: newBalance,
            updated_at: now,
          },
          create: {
            user_id: userId,
            total_credits: newBalance,
            updated_at: now,
          },
        }),
        // 记录交易流水
        tx.credit_transactions.create({
          data: {
            user_id: userId,
            amount: -1,
            type: TransactionType.consume,
            remark: "提示词优化消耗",
            balance_after: newBalance,
            created_at: now,
          },
        }),
        // 保存 prompt_optimizations
        tx.prompt_optimizations.create({
          data: {
            user_id: userId,
            original_prompt: original_prompt,
            optimized_prompt: optimized_prompt,
          },
        }),
      ]);

      return {
        balance: newBalance,
        id: savedOptimization.id,
      };
    },
    {
      maxWait: 10000, // 等待锁的最大时间：10秒
      timeout: 30000, // 事务超时时间：30秒
    }
  );
}

/**
 * 获取用户当前余额
 * @param user_id 用户ID
 * @returns 当前余额，如果不存在则返回0
 */
export async function getUserBalance(user_id: number): Promise<number> {
  const userId = Number(user_id);
  const balance = await prisma.user_balance.findUnique({
    where: { user_id: userId },
  });

  return balance ? balance.total_credits : 0;
}

/**
 * 根据用户邮箱获取用户余额
 * @param user_email 用户邮箱
 * @returns 当前余额，如果不存在则返回0
 */
export async function getUserBalanceByEmail(
  user_email: string
): Promise<number> {
  const user = await prisma.users.findUnique({
    where: { email: user_email },
    select: { id: true },
  });

  if (!user) {
    return 0;
  }

  return getUserBalance(user.id);
}

/**
 * 在事务中同时扣减credit和保存wallpaper，确保原子性
 * @param user_id 用户ID
 * @param wallpaper wallpaper数据
 * @returns 更新后的余额和保存的wallpaper
 */
export async function consumeCreditsAndSaveWallpaper(
  user_id: number,
  wallpaper: Wallpaper
): Promise<{ balance: number; wallpaperId: number }> {
  const userId = Number(user_id);
  const now = new Date();

  return await prisma.$transaction(
    async (tx) => {
      // 1. 获取当前余额
      const balance = await tx.user_balance.findUnique({
        where: { user_id: userId },
        select: { total_credits: true },
      });

      const currentBalance = balance?.total_credits ?? 0;

      // 2. 计算新余额（扣减1个credit）
      const newBalance = currentBalance - 1;

      // 3. 如果余额不足，抛出错误
      if (newBalance < 0) {
        throw new Error("insufficient.credits");
      }

      // 4. 并发执行三个操作，提高性能
      // 这三个操作之间没有数据依赖关系，可以并发执行
      const [, , savedWallpaper] = await Promise.all([
        // 更新或创建余额记录
        tx.user_balance.upsert({
          where: { user_id: userId },
          update: {
            total_credits: newBalance,
            updated_at: now,
          },
          create: {
            user_id: userId,
            total_credits: newBalance,
            updated_at: now,
          },
        }),
        // 记录交易流水
        tx.credit_transactions.create({
          data: {
            user_id: userId,
            amount: -1,
            type: TransactionType.consume,
            remark: "生成图片消耗",
            balance_after: newBalance,
            created_at: now,
          },
        }),
        // 保存wallpaper
        tx.wallpapers.create({
          data: {
            user_id: userId,
            img_description: wallpaper.img_description,
            img_size: wallpaper.img_size,
            model_key: wallpaper.model_key,
            aspect_ratio_key: wallpaper.aspect_ratio_key,
            img_path: wallpaper.img_path,
            img_thumbnail_path: wallpaper.img_thumbnail_path,
            img_watermark_path: wallpaper.img_watermark_path,
            llm_params: wallpaper.llm_params,
            created_at: wallpaper.created_at,
          },
        }),
      ]);

      return {
        balance: newBalance,
        wallpaperId: savedWallpaper.id,
      };
    },
    {
      maxWait: 10000, // 等待锁的最大时间：10秒
      timeout: 30000, // 事务超时时间：30秒
    }
  );
}


/**
 * 获取用户积分
 * @param user_id 
 * @returns 
 */
export async function getUserCredits(user_id: number): Promise<UserCredits> {
  let user_credits: UserCredits = {
    total_credits: 0,
    used_credits: 0,
    left_credits: 0,
  };

  try {
    const [balance, used_credits] = await Promise.all([
      getUserBalance(user_id),
      getUserWallpapersCount(user_id)
    ]);

    user_credits.left_credits = balance;
    user_credits.total_credits = balance;
    user_credits.used_credits = used_credits;

    return user_credits;
  } catch (e) {
    console.log("get user credits failed: ", e);
    return user_credits;
  }
}