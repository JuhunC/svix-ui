import { NextResponse } from "next/server";
import { z } from "zod";
import { listOptionsFromRequest, withAdmin } from "@/lib/api/admin";

const CreateEndpoint = z.object({
  url: z.string().url(),
  description: z.string().optional(),
  filterTypes: z.array(z.string().min(1)).optional(),
  channels: z.array(z.string().min(1)).optional(),
  disabled: z.boolean().optional(),
  rateLimit: z.number().int().positive().optional(),
  secret: z.string().optional(),
});

export const GET = withAdmin<{ appId: string }>(async ({ req, client, params }) => {
  const page = await client.listEndpoints(params.appId, listOptionsFromRequest(req));
  return NextResponse.json(page);
});

export const POST = withAdmin<{ appId: string }>(async ({ req, client, params }) => {
  const json = await req.json().catch(() => null);
  const parsed = CreateEndpoint.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const endpoint = await client.createEndpoint(params.appId, parsed.data);
  return NextResponse.json(endpoint, { status: 201 });
});
