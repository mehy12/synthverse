import { NextRequest, NextResponse } from "next/server";
import {
  RESIDENT_PROFILE,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth-session";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      ...sessionCookieOptions,
      expires: new Date(0),
    });
    return response;
  }

  return NextResponse.json({
    user: RESIDENT_PROFILE,
    expiresAt: payload.exp * 1000,
  });
}
