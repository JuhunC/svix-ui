import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/admin";

const RecoverBody = z.object({ since: z.string().min(1) });

type Params = { appId: string; endpointId: string };

export const POST = withAdmin<Params>(async ({ req, client, params }) => {
  const json = await req.json().catch(() => null);
  const parsed = RecoverBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A 'since' ISO timestamp is required" },
      { status: 400 },
    );
  }
  await client.recoverEndpoint(params.appId, params.endpointId, parsed.data.since);
  return new NextResponse(null, { status: 202 });
});
