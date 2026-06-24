import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/admin";

const RotateBody = z.object({ key: z.string().min(1).optional() }).optional();

type Params = { appId: string; endpointId: string };

export const POST = withAdmin<Params>(async ({ req, client, params }) => {
  const json = await req.json().catch(() => undefined);
  const parsed = RotateBody.safeParse(json);
  const key = parsed.success ? parsed.data?.key : undefined;
  await client.rotateEndpointSecret(params.appId, params.endpointId, key);
  return new NextResponse(null, { status: 204 });
});
