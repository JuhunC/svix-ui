import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/admin";
import { loadServerConfig } from "@/lib/config";

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
  })
  .optional();

const DEFAULT_EXPIRY = 60 * 60 * 24 * 7; // 7 days

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
  const query = new URLSearchParams({
    token: access.token,
    app: params.appId,
    exp: String(expiry),
  }).toString();
  const link = publicUrl ? `${publicUrl}/portal/launch?${query}` : null;

  return NextResponse.json({
    token: access.token,
    app: params.appId,
    exp: expiry,
    link,
    expiresInSeconds: expiry,
  });
});
