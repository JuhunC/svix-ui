import { NextResponse } from "next/server";
import { listOptionsFromRequest } from "@/lib/api/admin";
import { withPortal } from "@/lib/api/portal";
import { CreateEndpoint } from "@/lib/api/schemas";

export const GET = withPortal(async ({ req, client, appId }) => {
  const page = await client.listEndpoints(appId, listOptionsFromRequest(req));
  return NextResponse.json(page);
});

export const POST = withPortal(async ({ req, client, appId }) => {
  const json = await req.json().catch(() => null);
  const parsed = CreateEndpoint.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const endpoint = await client.createEndpoint(appId, parsed.data);
  return NextResponse.json(endpoint, { status: 201 });
});
