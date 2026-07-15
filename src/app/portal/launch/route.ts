import { NextResponse, type NextRequest } from "next/server";
import { loadServerConfig } from "@/lib/config";
import { decryptLaunchScope, sealPortalSession } from "@/lib/auth/portal";
import { isRequestSecure } from "@/lib/auth/server";
import { PORTAL_COOKIE, portalCookieOptions } from "@/lib/api/portal";

const DEFAULT_TTL = 60 * 60 * 24 * 7;
const MAX_TTL = 60 * 60 * 24 * 30; // cap sealed-cookie lifetime at 30 days

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
 * Restricts the post-launch deep-link target to a same-origin path inside the
 * portal (e.g. `/portal/endpoints/ep_123`). Guards against open redirects — a
 * value like `//evil.com` fails the `/portal/` prefix check. Falls back to the
 * portal root when absent or unsafe.
 */
function safePortalTarget(raw: string | null): string {
  if (raw && /^\/portal\/[A-Za-z0-9/_%.-]*$/.test(raw)) return raw;
  return "/portal";
}

/**
 * Consumer magic-link entry point. Moves the app-scoped token out of the URL
 * into a sealed httpOnly cookie, then redirects to the portal (optionally deep
 * linking to a specific endpoint via `to`).
 */
export async function GET(req: NextRequest) {
  let secret: string;
  try {
    secret = loadServerConfig().sessionSecret;
  } catch {
    return redirectTo("/portal/expired");
  }

  // Per-endpoint link: an AES-GCM blob carrying the token + endpoint scope.
  // The token is never exposed in the URL, so it can't be stripped of its
  // endpoint restriction and replayed for app-wide access.
  const scopeBlob = req.nextUrl.searchParams.get("s");
  if (scopeBlob) {
    const scope = decryptLaunchScope(scopeBlob, secret);
    if (!scope) return redirectTo("/portal/expired");
    const ttlMs = Math.min(scope.exp - Date.now(), MAX_TTL * 1000);
    if (ttlMs <= 0) return redirectTo("/portal/expired");
    const sealed = sealPortalSession(
      { token: scope.token, appId: scope.appId, endpointId: scope.endpointId, exp: scope.exp },
      secret,
    );
    const res = redirectTo(`/portal/endpoints/${encodeURIComponent(scope.endpointId)}`);
    res.cookies.set(
      PORTAL_COOKIE,
      sealed,
      portalCookieOptions(Math.floor(ttlMs / 1000), isRequestSecure(req)),
    );
    return res;
  }

  const token = req.nextUrl.searchParams.get("token");
  const appId = req.nextUrl.searchParams.get("app");
  const expParam = Number(req.nextUrl.searchParams.get("exp"));
  const ttl = Math.min(
    Number.isFinite(expParam) && expParam > 0 ? expParam : DEFAULT_TTL,
    MAX_TTL,
  );

  if (!token || !appId) {
    return redirectTo("/portal/expired");
  }

  const sealed = sealPortalSession(
    { token, appId, exp: Date.now() + ttl * 1000 },
    secret,
  );
  const target = safePortalTarget(req.nextUrl.searchParams.get("to"));
  const res = redirectTo(target);
  res.cookies.set(PORTAL_COOKIE, sealed, portalCookieOptions(ttl, isRequestSecure(req)));
  return res;
}
