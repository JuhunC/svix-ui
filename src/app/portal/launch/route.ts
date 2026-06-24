import { NextResponse, type NextRequest } from "next/server";
import { loadServerConfig } from "@/lib/config";
import { sealPortalSession } from "@/lib/auth/portal";
import { PORTAL_COOKIE, portalCookieOptions } from "@/lib/api/portal";

const DEFAULT_TTL = 60 * 60 * 24 * 7;

/**
 * Consumer magic-link entry point. Moves the app-scoped token out of the URL
 * into a sealed httpOnly cookie, then redirects to the portal.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const appId = req.nextUrl.searchParams.get("app");
  const expParam = Number(req.nextUrl.searchParams.get("exp"));
  const ttl = Number.isFinite(expParam) && expParam > 0 ? expParam : DEFAULT_TTL;

  if (!token || !appId) {
    return NextResponse.redirect(new URL("/portal/expired", req.nextUrl.origin));
  }

  let secret: string;
  try {
    secret = loadServerConfig().sessionSecret;
  } catch {
    return NextResponse.redirect(new URL("/portal/expired", req.nextUrl.origin));
  }

  const sealed = sealPortalSession(
    { token, appId, exp: Date.now() + ttl * 1000 },
    secret,
  );
  const res = NextResponse.redirect(new URL("/portal", req.nextUrl.origin));
  res.cookies.set(PORTAL_COOKIE, sealed, portalCookieOptions(ttl));
  return res;
}
