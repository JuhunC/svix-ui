import { NextResponse } from "next/server";
import { messageReachedEndpoint, withPortal } from "@/lib/api/portal";

type Params = { endpointId: string; msgId: string };

// The central guard already ensures params.endpointId === the scoped endpoint.
// But msgId is unguarded, so for a scoped session also verify the message was
// actually delivered here — otherwise a scoped consumer could resend a foreign
// message to their own (consumer-controlled) URL and read its payload.
export const POST = withPortal<Params>(async ({ client, appId, params, scopedEndpointId }) => {
  if (
    scopedEndpointId &&
    !(await messageReachedEndpoint(client, appId, params.msgId, scopedEndpointId))
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await client.resendMessage(appId, params.msgId, params.endpointId);
  return new NextResponse(null, { status: 202 });
});
