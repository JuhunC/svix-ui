import { NextResponse } from "next/server";
import { withPortal } from "@/lib/api/portal";
import { RecoverBody } from "@/lib/api/schemas";

export const POST = withPortal<{ endpointId: string }>(async ({ req, client, appId, params }) => {
  const json = await req.json().catch(() => null);
  const parsed = RecoverBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A 'since' ISO timestamp is required" },
      { status: 400 },
    );
  }
  const task = await client.recoverEndpoint(
    appId,
    params.endpointId,
    parsed.data.since,
    parsed.data.until,
  );
  return NextResponse.json(task ?? {}, { status: 202 });
});
