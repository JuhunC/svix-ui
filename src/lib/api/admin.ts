import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/config";
import { getOperatorSession } from "@/lib/auth/server";
import type { SessionPayload } from "@/lib/auth/session";
import type { SvixClient } from "@/lib/svix/client";
import type { ListOptions, ListQuery, Ordering } from "@/lib/svix/types";
import { SvixApiError, SvixConfigError } from "@/lib/svix/errors";

export interface AdminContext<P extends Record<string, string>> {
  req: NextRequest;
  client: SvixClient;
  session: SessionPayload;
  params: P;
}

type RouteSegment<P> = { params: Promise<P> };

/** Maps domain errors to consistent JSON responses. */
export function apiError(err: unknown): NextResponse {
  if (err instanceof SvixApiError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      {
        status: err.status,
        headers: err.retryAfter
          ? { "retry-after": String(err.retryAfter) }
          : undefined,
      },
    );
  }
  if (err instanceof SvixConfigError) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/**
 * Wraps an admin BFF route: enforces the operator session, builds the admin
 * SvixClient (holding the privileged token server-side), resolves dynamic
 * params, and funnels errors through `apiError`.
 */
export function withAdmin<P extends Record<string, string> = Record<string, never>>(
  handler: (ctx: AdminContext<P>) => Promise<Response> | Response,
) {
  return async (req: NextRequest, segment?: RouteSegment<P>): Promise<Response> => {
    const session = await getOperatorSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let params = {} as P;
    if (segment?.params) params = await segment.params;
    try {
      const client = getAdminClient();
      return await handler({ req, client, session, params });
    } catch (err) {
      return apiError(err);
    }
  };
}

/** Parses limit/iterator/order from the request query string. */
export function listOptionsFromRequest(req: NextRequest): ListOptions {
  const sp = req.nextUrl.searchParams;
  const limit = sp.get("limit");
  const orderRaw = sp.get("order");
  const order: Ordering | undefined =
    orderRaw === "ascending" || orderRaw === "descending" ? orderRaw : undefined;
  return {
    limit: limit ? Number(limit) : undefined,
    iterator: sp.get("iterator") ?? undefined,
    order,
  };
}

/** Parses the full message/attempt filter set from the request query string. */
export function listQueryFromRequest(req: NextRequest): ListQuery {
  const sp = req.nextUrl.searchParams;
  const num = (k: string) => {
    const v = sp.get(k);
    return v !== null && v !== "" && Number.isFinite(Number(v))
      ? Number(v)
      : undefined;
  };
  const str = (k: string) => sp.get(k) || undefined;
  const eventTypes = sp.get("event_types");
  return {
    ...listOptionsFromRequest(req),
    eventTypes: eventTypes ? eventTypes.split(",").filter(Boolean) : undefined,
    channel: str("channel"),
    before: str("before"),
    after: str("after"),
    status: num("status"),
    statusCodeClass: num("status_code_class"),
    tag: str("tag"),
    withContent: sp.get("with_content") === "true",
  };
}
