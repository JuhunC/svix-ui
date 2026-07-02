import { NextResponse } from "next/server";
import { listOptionsFromRequest } from "@/lib/api/admin";
import { withPortal } from "@/lib/api/portal";

// The App Portal is read/modify-only for endpoints: consumers may list and
// edit endpoint settings, but creating endpoints is intentionally not exposed
// here — only the operator console (admin API) can. POST returns 405.
export const GET = withPortal(async ({ req, client, appId }) => {
  const page = await client.listEndpoints(appId, listOptionsFromRequest(req));
  return NextResponse.json(page);
});
