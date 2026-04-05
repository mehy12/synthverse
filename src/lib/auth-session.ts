import { createHmac, timingSafeEqual } from "crypto";

export type UserRole = "resident";

export interface AuthUser {
  name: string;
  role: UserRole;
  avatar: string;
}

interface TokenPayload {
  role: UserRole;
  iat: number;
  exp: number;
  sid: string;
}

export const SESSION_COOKIE_NAME = "hivemind_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const DEV_FALLBACK_SECRET = "hivemind-dev-secret-change-me";
const DEV_FALLBACK_ACCESS_CODE = "urban-2026";

export const RESIDENT_PROFILE: AuthUser = {
  name: "Urban Resident",
  role: "resident",
  avatar: "UR",
};

function getSessionSecret() {
  if (process.env.AUTH_SESSION_SECRET) {
    return process.env.AUTH_SESSION_SECRET;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SESSION_SECRET must be set in production.");
  }

  return DEV_FALLBACK_SECRET;
}

export function getExpectedAccessCode() {
  if (process.env.URBAN_RESIDENT_ACCESS_CODE) {
    return process.env.URBAN_RESIDENT_ACCESS_CODE;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("URBAN_RESIDENT_ACCESS_CODE must be set in production.");
  }

  return DEV_FALLBACK_ACCESS_CODE;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function safeCompare(a: string, b: string) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  if (first.length !== second.length) {
    return false;
  }
  return timingSafeEqual(first, second);
}

function buildPayload(role: UserRole): TokenPayload {
  const now = Math.floor(Date.now() / 1000);
  const sid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `resident-${now}`;

  return {
    role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    sid,
  };
}

export function createSessionToken(role: UserRole) {
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = buildPayload(role);
  const payloadEncoded = toBase64Url(JSON.stringify(payload));
  const unsigned = `${header}.${payloadEncoded}`;
  const signature = sign(unsigned);

  return {
    token: `${unsigned}.${signature}`,
    expiresAt: payload.exp * 1000,
    payload,
  };
}

export function verifySessionToken(token: string): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header, payloadEncoded, signature] = parts;
  const expectedSignature = sign(`${header}.${payloadEncoded}`);
  if (!safeCompare(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadEncoded)) as Partial<TokenPayload>;
    if (
      payload.role !== "resident" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      typeof payload.sid !== "string"
    ) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return null;
    }

    return payload as TokenPayload;
  } catch {
    return null;
  }
}

export function verifyAccessCode(input: string) {
  const expectedCode = getExpectedAccessCode();
  return safeCompare(input, expectedCode);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
