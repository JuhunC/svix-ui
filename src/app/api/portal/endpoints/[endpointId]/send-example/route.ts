import { NextResponse } from "next/server";
import { withPortal } from "@/lib/api/portal";
import { SendExample } from "@/lib/api/schemas";

export const POST = withPortal<{ endpointId: string }>(
  async ({ req, client, appId, params }) => {
    const json = await req.json().catch(() => null);
    const parsed = SendExample.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "An event type is required" }, { status: 400 });
    }
    const attempt = await client.sendExample(
      appId,
      params.endpointId,
      parsed.data.eventType,
    );
    return NextResponse.json(attempt, { status: 202 });
  },
);
