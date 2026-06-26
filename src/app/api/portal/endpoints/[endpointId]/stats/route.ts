import { NextResponse } from "next/server";
import { withPortal } from "@/lib/api/portal";

export const GET = withPortal<{ endpointId: string }>(
  async ({ client, appId, params }) => {
    const stats = await client.getEndpointStats(appId, params.endpointId);
    return NextResponse.json(stats);
  },
);
