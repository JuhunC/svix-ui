import { NextResponse } from "next/server";
import { listQueryFromRequest } from "@/lib/api/admin";
import { withPortal } from "@/lib/api/portal";

export const GET = withPortal(async ({ req, client, appId }) => {
  const page = await client.listMessages(appId, listQueryFromRequest(req));
  return NextResponse.json(page);
});
