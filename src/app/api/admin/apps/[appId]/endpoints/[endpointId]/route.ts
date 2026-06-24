import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/admin";

const UpdateEndpoint = z.object({
  url: z.string().url().optional(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
  filterTypes: z.array(z.string().min(1)).nullable().optional(),
  channels: z.array(z.string().min(1)).nullable().optional(),
  rateLimit: z.number().int().positive().nullable().optional(),
});

type Params = { appId: string; endpointId: string };

export const GET = withAdmin<Params>(async ({ client, params }) => {
  const endpoint = await client.getEndpoint(params.appId, params.endpointId);
  return NextResponse.json(endpoint);
});

export const PATCH = withAdmin<Params>(async ({ req, client, params }) => {
  const json = await req.json().catch(() => null);
  const parsed = UpdateEndpoint.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const endpoint = await client.updateEndpoint(
    params.appId,
    params.endpointId,
    parsed.data,
  );
  return NextResponse.json(endpoint);
});

export const DELETE = withAdmin<Params>(async ({ client, params }) => {
  await client.deleteEndpoint(params.appId, params.endpointId);
  return new NextResponse(null, { status: 204 });
});
