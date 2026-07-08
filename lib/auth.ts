import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { createLocaleResp } from "./resp";
import { errMsg } from "@/messages/errors";

export interface AuthResult {
  email: string;
  userId: number;
  roles: string[];
}

interface JwtPayload {
  sub?: number;
  email?: string;
  roles?: string[];
  exp?: number;
}

function base64UrlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getTokenFromRequest(req?: Request): string | undefined {
  if (req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice("Bearer ".length);
    }

    const url = new URL(req.url);
    const queryToken = url.searchParams.get("token");
    if (queryToken) {
      return queryToken;
    }

    const cookieHeader = req.headers.get("cookie");
    const cookieToken = cookieHeader
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("arcwall-access-token=") || part.startsWith("arcwall-token="))
      ?.split("=")[1];
    return cookieToken ? decodeURIComponent(cookieToken) : undefined;
  }

  const authHeader = headers().get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length);
  }

  return cookies().get("arcwall-access-token")?.value || cookies().get("arcwall-token")?.value;
}

function verifyJwt(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  let header: { alg?: string };
  let payload: JwtPayload;

  try {
    header = JSON.parse(base64UrlDecode(encodedHeader).toString("utf8"));
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8"));
  } catch {
    return null;
  }

  if (header.alg !== "HS256") {
    return null;
  }

  const secret = process.env.JWT_SECRET || "arcwall-dev-secret";
  const expected = base64UrlEncode(
    createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest(),
  );
  const actual = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) {
    return null;
  }

  if (payload.exp && payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  if (!payload.sub || !payload.email) {
    return null;
  }

  return payload;
}

/**
 * 统一的用户鉴权函数。
 * 验证 arcwall-service 签发的 HS256 JWT，返回最小用户信息。
 */
export async function requireAuth(req?: Request): Promise<AuthResult | null> {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return null;
    }

    const payload = verifyJwt(token);
    if (!payload?.sub || !payload.email) {
      return null;
    }

    return {
      email: payload.email,
      userId: payload.sub,
      roles: payload.roles ?? [],
    };
  } catch (error) {
    console.error("[AUTH] Authentication error:", error);
    return null;
  }
}

/**
 * 在 API 路由中使用，如果鉴权失败则直接返回错误响应。
 */
export async function requireAuthOrResponse(req?: Request): Promise<AuthResult | Response> {
  const auth = await requireAuth(req);
  if (!auth) {
    const { respErr } = createLocaleResp(req ?? new Request("http://localhost"));
    return respErr(errMsg("unauthorized"), 401);
  }
  return auth;
}
