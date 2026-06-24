import { NextResponse } from "next/server";
import { withPortal } from "@/lib/api/portal";

export const GET = withPortal<{ endpointId: string }>(async ({ client, appId, params }) => {
  const secret = await client.getEndpointSecret(appId, params.endpointId);
  return NextResponse.json(secret);
});
