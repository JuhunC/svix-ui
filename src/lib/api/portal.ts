import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { loadServerConfig } from "@/lib/config";
import { SvixClient } from "@/lib/svix/client";
import { openPortalSession } from "@/lib/auth/portal";
import { apiError } from "./admin";

export const PORTAL_COOKIE = "svix_ui_portal";

export interface PortalContext<P extends Record<string, string>> {
  req: NextRequest;
  client: SvixClient;
  appId: string;
  params: P;
}

type RouteSegment<P> = { params: Promise<P> };

/**
 * Wraps a consumer-portal BFF route. The upstream client is built with the
 * app-scoped portal token (never the admin token), so every call is restricted
 * to one application and the capabilities embedded in that token.
 */
export function withPortal<P extends Record<string, string> = Record<string, never>>(
  handler: (ctx: PortalContext<P>) => Promise<Response> | Response,
) {
  return async (req: NextRequest, segment?: RouteSegment<P>): Promise<Response> => {
    let secret: string;
    let serverUrl: string;
    try {
      const cfg = loadServerConfig();
      secret = cfg.sessionSecret;
      serverUrl = cfg.svixServerUrl;
    } catch (err) {
      return apiError(err);
    }

    const store = await cookies();
    const session = openPortalSession(store.get(PORTAL_COOKIE)?.value, secret);
    if (!session) {
      return NextResponse.json({ error: "Portal session expired" }, { status: 401 });
    }

    let params = {} as P;
    if (segment?.params) params = await segment.params;

    try {
      const client = new SvixClient({ serverUrl, token: session.token });
      return await handler({ req, client, appId: session.appId, params });
    } catch (err) {
      return apiError(err);
    }
  };
}

export function portalCookieOptions(maxAgeSeconds: number, secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
