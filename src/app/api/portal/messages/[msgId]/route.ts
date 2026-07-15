import { NextResponse } from "next/server";
import { messageReachedEndpoint, withPortal } from "@/lib/api/portal";

// A single message payload is used to show the "sent payload" for a delivery.
// For an endpoint-scoped link it is only returned when the message was actually
// delivered to that endpoint — so a scoped consumer can inspect their own
// deliveries but can't fetch arbitrary messages meant for other endpoints.
export const GET = withPortal<{ msgId: string }>(
  async ({ client, appId, params, scopedEndpointId }) => {
    if (
      scopedEndpointId &&
      !(await messageReachedEndpoint(client, appId, params.msgId, scopedEndpointId))
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const message = await client.getMessage(appId, params.msgId);
    return NextResponse.json(message);
  },
);
