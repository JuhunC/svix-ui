import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api/admin";
import { RecoverBody } from "@/lib/api/schemas";

type Params = { appId: string; endpointId: string };

export const POST = withAdmin<Params>(async ({ req, client, params }) => {
  const json = await req.json().catch(() => null);
  const parsed = RecoverBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A 'since' ISO timestamp is required" },
      { status: 400 },
    );
  }
  const task = await client.recoverEndpoint(
    params.appId,
    params.endpointId,
    parsed.data.since,
    parsed.data.until,
  );
  return NextResponse.json(task ?? {}, { status: 202 });
});
