import { NextResponse } from "next/server";
import { listQueryFromRequest, withAdmin } from "@/lib/api/admin";

type Params = { appId: string; msgId: string };

export const GET = withAdmin<Params>(async ({ req, client, params }) => {
  const page = await client.listAttemptsByMessage(
    params.appId,
    params.msgId,
    listQueryFromRequest(req),
  );
  return NextResponse.json(page);
});
