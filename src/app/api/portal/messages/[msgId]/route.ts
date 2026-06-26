import { NextResponse } from "next/server";
import { withPortal } from "@/lib/api/portal";

export const GET = withPortal<{ msgId: string }>(
  async ({ client, appId, params }) => {
    const message = await client.getMessage(appId, params.msgId);
    return NextResponse.json(message);
  },
);
