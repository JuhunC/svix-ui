import { NextResponse } from "next/server";
import { withPortal } from "@/lib/api/portal";

type Params = { endpointId: string; msgId: string };

export const POST = withPortal<Params>(async ({ client, appId, params }) => {
  await client.resendMessage(appId, params.msgId, params.endpointId);
  return new NextResponse(null, { status: 202 });
});
