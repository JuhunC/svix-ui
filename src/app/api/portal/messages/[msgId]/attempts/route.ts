import { NextResponse } from "next/server";
import { listOptionsFromRequest } from "@/lib/api/admin";
import { withPortal } from "@/lib/api/portal";

export const GET = withPortal<{ msgId: string }>(
  async ({ req, client, appId, params }) => {
    const page = await client.listAttemptsByMessage(
      appId,
      params.msgId,
      listOptionsFromRequest(req),
    );
    return NextResponse.json(page);
  },
);
