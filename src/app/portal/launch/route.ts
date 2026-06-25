import { NextResponse, type NextRequest } from "next/server";
import { loadServerConfig } from "@/lib/config";
import { sealPortalSession } from "@/lib/auth/portal";
import { isRequestSecure } from "@/lib/auth/server";
import { PORTAL_COOKIE, portalCookieOptions } from "@/lib/api/portal";

const DEFAULT_TTL = 60 * 60 * 24 * 7;

/**
 * Relative redirect. The browser resolves the Location against the address-bar
 * origin, so the customer stays on whatever host they actually opened — the
 * Next.js standalone server cannot reliably report that host (it reports its
 * internal bind address), and absolute redirects get rewritten to it.
 */
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { location: path } });
}

/**
 * Consumer magic-link entry point. Moves the app-scoped token out of the URL
 * into a sealed httpOnly cookie, then redirects to the portal.
 */
export async function GET(req: NextRequest) {
  let secret: string;
  try {
    secret = loadServerConfig().sessionSecret;
  } catch {
    return redirectTo("/portal/expired");
  }

  const token = req.nextUrl.searchParams.get("token");
  const appId = req.nextUrl.searchParams.get("app");
  const expParam = Number(req.nextUrl.searchParams.get("exp"));
  const ttl = Number.isFinite(expParam) && expParam > 0 ? expParam : DEFAULT_TTL;

  if (!token || !appId) {
    return redirectTo("/portal/expired");
  }

  const sealed = sealPortalSession(
    { token, appId, exp: Date.now() + ttl * 1000 },
    secret,
  );
  const res = redirectTo("/portal");
  res.cookies.set(PORTAL_COOKIE, sealed, portalCookieOptions(ttl, isRequestSecure(req)));
  return res;
}
