import { NextResponse } from "next/server";
import { z } from "zod";
import { listOptionsFromRequest, withAdmin } from "@/lib/api/admin";

const CreateMessage = z.object({
  eventType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  eventId: z.string().min(1).optional(),
  channels: z.array(z.string().min(1)).optional(),
});

export const GET = withAdmin<{ appId: string }>(async ({ req, client, params }) => {
  const page = await client.listMessages(params.appId, listOptionsFromRequest(req));
  return NextResponse.json(page);
});

export const POST = withAdmin<{ appId: string }>(async ({ req, client, params }) => {
  const json = await req.json().catch(() => null);
  const parsed = CreateMessage.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const message = await client.createMessage(params.appId, parsed.data);
  return NextResponse.json(message, { status: 202 });
});
