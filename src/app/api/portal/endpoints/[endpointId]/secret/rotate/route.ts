import { NextResponse } from "next/server";
import { withPortal } from "@/lib/api/portal";

export const POST = withPortal<{ endpointId: string }>(async ({ client, appId, params }) => {
  await client.rotateEndpointSecret(appId, params.endpointId);
  return new NextResponse(null, { status: 204 });
});
