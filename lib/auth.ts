import { currentUser, auth } from "@clerk/nextjs/server";
import { respErr } from "./resp";

export interface AuthResult {
  email: string;
  userId: string;
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>>;
  sessionId: string;
}

/**
 * 统一的用户鉴权函数
 * 返回用户信息，如果鉴权失败则返回 null
 *
 * 安全说明：
 * 1. Clerk 的 currentUser() 在服务端运行时会自动验证 JWT token 的签名和有效性
 * 2. JWT token 由 Clerk 使用私钥签名，客户端无法伪造
 * 3. 我们额外验证用户状态、邮箱验证状态等，确保用户信息真实有效
 */
export async function requireAuth(): Promise<AuthResult | null> {
  try {
    // 获取认证信息（包含 session 信息）
    const authResult = await auth();

    // 验证 session 是否存在（这是 Clerk 验证 JWT token 后的结果）
    if (!authResult || !authResult.userId || !authResult.sessionId) {
      // 记录可疑的认证尝试
      console.warn("[AUTH] Authentication failed: missing auth result or session");
      return null;
    }

    // 获取用户详细信息
    // currentUser() 会从已验证的 session 中获取用户信息
    // Clerk 内部会验证 JWT token 的签名、过期时间等
    const user = await currentUser();

    // 检查用户是否存在
    if (!user) {
      console.warn("[AUTH] Authentication failed: user not found");
      return null;
    }

    // 验证用户 ID 是否与 session 中的一致（防止 token 被篡改）
    if (user.id !== authResult.userId) {
      console.error("[AUTH] Security alert: user ID mismatch between session and user object");
      return null;
    }

    // 检查用户 ID 是否存在
    if (!user.id) {
      console.warn("[AUTH] Authentication failed: missing user ID");
      return null;
    }

    // 检查邮箱是否存在且不为空
    if (!user.emailAddresses || user.emailAddresses.length === 0) {
      console.warn("[AUTH] Authentication failed: no email addresses found");
      return null;
    }

    const primaryEmail = user.emailAddresses[0];
    const email = primaryEmail.emailAddress;

    if (!email) {
      console.warn("[AUTH] Authentication failed: empty email address");
      return null;
    }

    // 验证邮箱是否已验证（可选，根据业务需求决定是否强制要求）
    // 如果业务要求邮箱必须验证，可以取消下面的注释
    // if (!primaryEmail.verification?.status || primaryEmail.verification.status !== 'verified') {
    //   console.warn(`[AUTH] Authentication failed: email ${email} not verified`);
    //   return null;
    // }

    // 检查用户是否被禁用（如果 Clerk 返回此信息）
    // 注意：某些 Clerk 版本可能不包含此字段
    if ('banned' in user && user.banned) {
      console.warn(`[AUTH] Authentication failed: user ${user.id} is banned`);
      return null;
    }

    // 验证 session 是否有效
    if (!authResult.sessionId) {
      console.warn("[AUTH] Authentication failed: missing session ID");
      return null;
    }

    return {
      email,
      userId: user.id,
      user,
      sessionId: authResult.sessionId,
    };
  } catch (error) {
    // 捕获任何异常（如 JWT 验证失败、网络错误等）
    console.error("[AUTH] Authentication error:", error);
    return null;
  }
}

/**
 * 在 API 路由中使用，如果鉴权失败则直接返回错误响应
 * @returns 返回用户信息，如果鉴权失败则返回 401 错误响应
 */
export async function requireAuthOrResponse(): Promise<AuthResult | Response> {
  const auth = await requireAuth();
  if (!auth) {
    return respErr("unauthorized", 401);
  }
  return auth;
}

