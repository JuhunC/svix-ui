import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api/admin";

type Params = { appId: string; msgId: string };

export const GET = withAdmin<Params>(async ({ client, params }) => {
  const message = await client.getMessage(params.appId, params.msgId);
  return NextResponse.json(message);
});
