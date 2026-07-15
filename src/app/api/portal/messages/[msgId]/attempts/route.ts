import { NextResponse } from "next/server";
import { listQueryFromRequest } from "@/lib/api/admin";
import { withPortal } from "@/lib/api/portal";

// Attempts for a message span every endpoint it fanned out to, so this is
// app-wide — refused for endpoint-scoped links.
export const GET = withPortal<{ msgId: string }>(
  async ({ req, client, appId, params }) => {
    const page = await client.listAttemptsByMessage(
      appId,
      params.msgId,
      listQueryFromRequest(req),
    );
    return NextResponse.json(page);
  },
  { appWide: true },
);
