import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api/admin";

type Params = { appId: string; endpointId: string };

export const GET = withAdmin<Params>(async ({ client, params }) => {
  const secret = await client.getEndpointSecret(params.appId, params.endpointId);
  return NextResponse.json(secret);
});
