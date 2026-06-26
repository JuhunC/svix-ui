import { NextResponse } from "next/server";
import { listQueryFromRequest } from "@/lib/api/admin";
import { withPortal } from "@/lib/api/portal";

export const GET = withPortal<{ endpointId: string }>(async ({ req, client, appId, params }) => {
  const page = await client.listAttemptsByEndpoint(
    appId,
    params.endpointId,
    listQueryFromRequest(req),
  );
  return NextResponse.json(page);
});
