import { NextResponse } from "next/server";
import { withPortal } from "@/lib/api/portal";
import { HeadersBody } from "@/lib/api/schemas";

type Params = { endpointId: string };

export const GET = withPortal<Params>(async ({ client, appId, params }) => {
  const headers = await client.getEndpointHeaders(appId, params.endpointId);
  return NextResponse.json(headers);
});

export const PATCH = withPortal<Params>(async ({ req, client, appId, params }) => {
  const json = await req.json().catch(() => null);
  const parsed = HeadersBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid headers" }, { status: 400 });
  }
  await client.updateEndpointHeaders(appId, params.endpointId, parsed.data.headers);
  return new NextResponse(null, { status: 204 });
});
