import { NextResponse } from "next/server";
import { withPortal } from "@/lib/api/portal";
import { TransformationBody } from "@/lib/api/schemas";

type Params = { endpointId: string };

export const GET = withPortal<Params>(async ({ client, appId, params }) => {
  const t = await client.getEndpointTransformation(appId, params.endpointId);
  return NextResponse.json(t);
});

export const PATCH = withPortal<Params>(async ({ req, client, appId, params }) => {
  const json = await req.json().catch(() => null);
  const parsed = TransformationBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transformation" }, { status: 400 });
  }
  await client.setEndpointTransformation(appId, params.endpointId, parsed.data);
  return new NextResponse(null, { status: 204 });
});
