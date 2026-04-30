import { User } from "@/types/user";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { redisKeys, redisTTL } from "@/lib/constants";
import { updateUserCredits } from "@/services/credit";
import { TransactionType } from "@prisma/client";

export async function insertUser(user: User): Promise<{ id: number; email: string }> {
  const createdAt: string = new Date().toISOString();

  // Find the default 'user' role
  const defaultRole = await prisma.roles.findUnique({
    where: { code: 'user' },
  });

  const res = await prisma.users.create({
    data: {
      email: user.email!,
      nickname: user.nickname || 'momo',
      avatar_url: user.avatar_url,
      created_at: createdAt,
    },
  });

  // Assign default role
  if (defaultRole) {
    await prisma.user_roles.create({
      data: {
        user_id: res.id,
        role_id: defaultRole.id,
      },
    });
  }

  // 用户首次注册，赠送3个credit
  try {
    await updateUserCredits(
      res.id,
      3,
      TransactionType.gift,
      "新用户注册赠送"
    );
  } catch (e) {
    console.log("give welcome credits failed: ", e);
    // 即使赠送失败也不影响用户注册
  }

  return res;
}

export async function findUserByEmail(
  email: string
): Promise<User | undefined> {
  const cacheKey = redisKeys.userByEmail(email);
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as User;
  }

  const user = await prisma.users.findUnique({
    where: { email },
    include: {
      user_roles: {
        include: { role: true },
      },
    },
  });

  if (!user) {
    return undefined;
  }

  const result: User = {
    id: user.id,
    email: user.email,
    nickname: user.nickname || "",
    avatar_url: user.avatar_url || "",
    created_at: user.created_at ? user.created_at.toISOString() : undefined,
    roles: user.user_roles.map((ur: { role: { code: string } }) => ur.role.code),
  };

  await redis.set(cacheKey, JSON.stringify(result), "EX", redisTTL.userCache);
  return result;
}

export async function invalidateUserCache(email: string): Promise<void> {
  await redis.del(redisKeys.userByEmail(email));
}
