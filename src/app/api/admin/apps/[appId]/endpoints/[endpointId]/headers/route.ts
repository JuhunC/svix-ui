import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/admin";

const HeadersBody = z.object({
  headers: z.record(z.string(), z.string()),
});

type Params = { appId: string; endpointId: string };

export const GET = withAdmin<Params>(async ({ client, params }) => {
  const headers = await client.getEndpointHeaders(params.appId, params.endpointId);
  return NextResponse.json(headers);
});

export const PATCH = withAdmin<Params>(async ({ req, client, params }) => {
  const json = await req.json().catch(() => null);
  const parsed = HeadersBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid headers" }, { status: 400 });
  }
  await client.updateEndpointHeaders(
    params.appId,
    params.endpointId,
    parsed.data.headers,
  );
  return new NextResponse(null, { status: 204 });
});
