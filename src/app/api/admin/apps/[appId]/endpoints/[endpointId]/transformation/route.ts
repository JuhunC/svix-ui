import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api/admin";
import { TransformationBody } from "@/lib/api/schemas";

type Params = { appId: string; endpointId: string };

export const GET = withAdmin<Params>(async ({ client, params }) => {
  const t = await client.getEndpointTransformation(params.appId, params.endpointId);
  return NextResponse.json(t);
});

export const PATCH = withAdmin<Params>(async ({ req, client, params }) => {
  const json = await req.json().catch(() => null);
  const parsed = TransformationBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transformation" }, { status: 400 });
  }
  await client.setEndpointTransformation(params.appId, params.endpointId, parsed.data);
  return new NextResponse(null, { status: 204 });
});
