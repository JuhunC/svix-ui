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
  /**
   * Set when the session came from a per-endpoint portal link. The route must
   * expose only this endpoint's data (most routes are already restricted by the
   * central guard below, which 403s any mismatched `params.endpointId`).
   */
  scopedEndpointId?: string;
}

interface PortalOptions {
  /**
   * The route exposes application-wide data (e.g. the full message list). It is
   * refused for endpoint-scoped sessions, which may only see their endpoint.
   */
  appWide?: boolean;
}

type RouteSegment<P> = { params: Promise<P> };

const scopeDenied = () =>
  NextResponse.json(
    { error: "This portal link is limited to a single endpoint." },
    { status: 403 },
  );

/**
 * Wraps a consumer-portal BFF route. The upstream client is built with the
 * app-scoped portal token (never the admin token), so every call is restricted
 * to one application and the capabilities embedded in that token.
 *
 * When the session is endpoint-scoped (a per-endpoint portal link), a central
 * guard enforces the boundary: any route whose `endpointId` path param doesn't
 * match the scoped endpoint is refused, and `appWide` routes are refused
 * outright. Individual routes without an `endpointId` param (the endpoints list,
 * a single message) narrow their own results using `ctx.scopedEndpointId`.
 */
export function withPortal<P extends Record<string, string> = Record<string, never>>(
  handler: (ctx: PortalContext<P>) => Promise<Response> | Response,
  options: PortalOptions = {},
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

    const scopedEndpointId = session.endpointId;
    if (scopedEndpointId) {
      const paramEndpointId = (params as Record<string, string | undefined>).endpointId;
      if (typeof paramEndpointId === "string" && paramEndpointId !== scopedEndpointId) {
        return scopeDenied();
      }
      if (options.appWide) return scopeDenied();
    }

    try {
      const client = new SvixClient({ serverUrl, token: session.token });
      return await handler({ req, client, appId: session.appId, params, scopedEndpointId });
    } catch (err) {
      return apiError(err);
    }
  };
}

/**
 * True if `msgId` was delivered to `endpointId`. Used to gate an endpoint-scoped
 * consumer's access to a single message's payload / resend so they can act on
 * their own deliveries but not a foreign endpoint's. Pages through the message's
 * attempts (bounded) so it stays correct for high-fanout messages.
 */
export async function messageReachedEndpoint(
  client: SvixClient,
  appId: string,
  msgId: string,
  endpointId: string,
): Promise<boolean> {
  let iterator: string | undefined;
  for (let page = 0; page < 20; page++) {
    const res = await client.listAttemptsByMessage(appId, msgId, { limit: 250, iterator });
    if (res.data.some((a) => a.endpointId === endpointId)) return true;
    if (res.done || !res.iterator) return false;
    iterator = res.iterator;
  }
  return false;
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
