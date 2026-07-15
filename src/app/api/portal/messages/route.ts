import { NextResponse } from "next/server";
import { listQueryFromRequest } from "@/lib/api/admin";
import { withPortal } from "@/lib/api/portal";

// App-wide message feed — refused for endpoint-scoped links (they would leak
// other endpoints' events). Scoped consumers see their endpoint's deliveries
// via /api/portal/endpoints/[endpointId]/attempts instead.
export const GET = withPortal(
  async ({ req, client, appId }) => {
    const page = await client.listMessages(appId, listQueryFromRequest(req));
    return NextResponse.json(page);
  },
  { appWide: true },
);
