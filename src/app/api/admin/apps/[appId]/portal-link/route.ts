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
  // (a placeholder in OSS) and build a link to our own portal launcher.
  const access = await client.appPortalAccess(params.appId, {
    capabilities: opts.capabilities,
    readOnly: opts.readOnly,
    expiry,
  });

  const origin = loadServerConfig().publicUrl ?? req.nextUrl.origin;
  const link = new URL("/portal/launch", origin);
  link.searchParams.set("token", access.token);
  link.searchParams.set("app", params.appId);
  link.searchParams.set("exp", String(expiry));

  return NextResponse.json({ link: link.toString(), expiresInSeconds: expiry });
});
