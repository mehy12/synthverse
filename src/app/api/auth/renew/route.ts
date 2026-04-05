import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  RESIDENT_PROFILE,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth-session";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = verifySessionToken(token);
  if (!payload || payload.role !== "resident") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nextSession = createSessionToken("resident");
  const response = NextResponse.json({
    user: RESIDENT_PROFILE,
    expiresAt: nextSession.expiresAt,
  });

  response.cookies.set(SESSION_COOKIE_NAME, nextSession.token, {
    ...sessionCookieOptions,
    expires: new Date(nextSession.expiresAt),
  });

  return response;
}
