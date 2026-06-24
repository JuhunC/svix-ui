import { NextResponse } from "next/server";
import { listOptionsFromRequest, withAdmin } from "@/lib/api/admin";

type Params = { appId: string; endpointId: string };

export const GET = withAdmin<Params>(async ({ req, client, params }) => {
  const page = await client.listAttemptsByEndpoint(
    params.appId,
    params.endpointId,
    listOptionsFromRequest(req),
  );
  return NextResponse.json(page);
});
