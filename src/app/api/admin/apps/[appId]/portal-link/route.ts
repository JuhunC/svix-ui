import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/admin";
import { loadServerConfig } from "@/lib/config";
import { encryptLaunchScope } from "@/lib/auth/portal";

const Capability = z.enum([
  "ViewBase",
  "ViewEndpointSecret",
  "ManageEndpointSecret",
  "ManageTransformations",
  "CreateAttempts",
  "ManageEndpoint",
]);

const Body = z
  .object({
    capabilities: z.array(Capability).optional(),
    expiry: z.number().int().positive().max(60 * 60 * 24 * 30).optional(),
    readOnly: z.boolean().optional(),
    // Optional deep-link target within the portal, e.g. an endpoint page.
    to: z.string().optional(),
    // When set, mint an endpoint-SCOPED link: the resulting portal session may
    // only see this endpoint, enforced by the BFF. The token is encrypted into
    // the launch blob so the scope cannot be stripped.
    endpointId: z.string().min(1).optional(),
  })
  .optional();

const DEFAULT_EXPIRY = 60 * 60 * 24 * 7; // 7 days

/** Only allow same-origin portal paths as the launch deep-link target. */
function safePortalTarget(raw: string | undefined): string | undefined {
  return raw && /^\/portal\/[A-Za-z0-9/_%.-]*$/.test(raw) ? raw : undefined;
}

export const POST = withAdmin<{ appId: string }>(async ({ req, client, params }) => {
  const json = await req.json().catch(() => undefined);
  const parsed = Body.safeParse(json);
  const opts = parsed.success && parsed.data ? parsed.data : {};
  const expiry = opts.expiry ?? DEFAULT_EXPIRY;

  // The token is app-scoped and browser-safe. We ignore the upstream `url`
  // (a placeholder in OSS) and let the launch link be assembled on the
  // operator's origin (the client builds it from window.location), which is the
  // only reliable host. We only return a server-built link when the operator
  // has explicitly configured a public URL (e.g. behind a proxy).
  const access = await client.appPortalAccess(params.appId, {
    capabilities: opts.capabilities,
    readOnly: opts.readOnly,
    expiry,
  });

  const publicUrl = loadServerConfig().publicUrl;

  // Endpoint-scoped link: encrypt the token + endpoint into an opaque blob so
  // the consumer cannot read the token, drop the scope, and go app-wide. The
  // client assembles the launch URL as `${origin}/portal/launch?s=${scoped}`.
  if (opts.endpointId) {
    const secret = loadServerConfig().sessionSecret;
    const scoped = encryptLaunchScope(
      {
        token: access.token,
        appId: params.appId,
        endpointId: opts.endpointId,
        exp: Date.now() + expiry * 1000,
      },
      secret,
    );
    return NextResponse.json({
      app: params.appId,
      exp: expiry,
      endpointId: opts.endpointId,
      scoped,
      link: publicUrl ? `${publicUrl}/portal/launch?s=${scoped}` : null,
      expiresInSeconds: expiry,
    });
  }

  const to = safePortalTarget(opts.to);
  const params2 = new URLSearchParams({
    token: access.token,
    app: params.appId,
    exp: String(expiry),
  });
  if (to) params2.set("to", to);
  const query = params2.toString();
  const link = publicUrl ? `${publicUrl}/portal/launch?${query}` : null;

  return NextResponse.json({
    token: access.token,
    app: params.appId,
    exp: expiry,
    to: to ?? null,
    link,
    expiresInSeconds: expiry,
  });
});
