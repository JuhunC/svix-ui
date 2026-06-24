import { NextResponse } from "next/server";
import { withPortal } from "@/lib/api/portal";
import { UpdateEndpoint } from "@/lib/api/schemas";

type Params = { endpointId: string };

export const GET = withPortal<Params>(async ({ client, appId, params }) => {
  const endpoint = await client.getEndpoint(appId, params.endpointId);
  return NextResponse.json(endpoint);
});

export const PATCH = withPortal<Params>(async ({ req, client, appId, params }) => {
  const json = await req.json().catch(() => null);
  const parsed = UpdateEndpoint.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const endpoint = await client.updateEndpoint(appId, params.endpointId, parsed.data);
  return NextResponse.json(endpoint);
});

export const DELETE = withPortal<Params>(async ({ client, appId, params }) => {
  await client.deleteEndpoint(appId, params.endpointId);
  return new NextResponse(null, { status: 204 });
});
