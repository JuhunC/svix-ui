import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api/admin";
import { SendExample } from "@/lib/api/schemas";

type Params = { appId: string; endpointId: string };

export const POST = withAdmin<Params>(async ({ req, client, params }) => {
  const json = await req.json().catch(() => null);
  const parsed = SendExample.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "An event type is required" }, { status: 400 });
  }
  const attempt = await client.sendExample(
    params.appId,
    params.endpointId,
    parsed.data.eventType,
  );
  return NextResponse.json(attempt, { status: 202 });
});
