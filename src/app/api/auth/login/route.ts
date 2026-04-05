import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  RESIDENT_PROFILE,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifyAccessCode,
} from "@/lib/auth-session";

type LoginBody = {
  role?: string;
  accessCode?: string;
};

const attemptsByIp = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 10 * 60 * 1000;

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

function isLocked(ip: string) {
  const record = attemptsByIp.get(ip);
  if (!record) {
    return false;
  }
  if (record.lockedUntil > Date.now()) {
    return true;
  }
  attemptsByIp.delete(ip);
  return false;
}

function markFailedAttempt(ip: string) {
  const record = attemptsByIp.get(ip) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCK_DURATION_MS;
    record.count = 0;
  }
  attemptsByIp.set(ip, record);
}

function clearAttempts(ip: string) {
  attemptsByIp.delete(ip);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (isLocked(ip)) {
    return NextResponse.json(
      { error: "Too many failed attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const role = body.role;
  const accessCode = typeof body.accessCode === "string" ? body.accessCode.trim() : "";

  if (role !== "resident") {
    markFailedAttempt(ip);
    return NextResponse.json({ error: "Only Urban Resident sign-in is allowed." }, { status: 403 });
  }

  if (!accessCode || !verifyAccessCode(accessCode)) {
    markFailedAttempt(ip);
    return NextResponse.json({ error: "Invalid access code." }, { status: 401 });
  }

  clearAttempts(ip);

  const session = createSessionToken("resident");
  const response = NextResponse.json({
    user: RESIDENT_PROFILE,
    expiresAt: session.expiresAt,
  });

  response.cookies.set(SESSION_COOKIE_NAME, session.token, {
    ...sessionCookieOptions,
    expires: new Date(session.expiresAt),
  });

  return response;
}
