import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api/admin";

type Params = { appId: string; msgId: string; endpointId: string };

export const POST = withAdmin<Params>(async ({ client, params }) => {
  await client.resendMessage(params.appId, params.msgId, params.endpointId);
  return new NextResponse(null, { status: 202 });
});
