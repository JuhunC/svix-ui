import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isRequestSecure, sessionCookieOptions } from "@/lib/auth/server";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(isRequestSecure(req)),
    maxAge: 0,
  });
  return res;
}
