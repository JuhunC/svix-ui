import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/admin";

const UpdateEventType = z.object({
  description: z.string().min(1),
  schemas: z.record(z.string(), z.unknown()).optional(),
  archived: z.boolean().optional(),
  deprecated: z.boolean().optional(),
  groupName: z.string().optional(),
});

type Params = { name: string };

export const GET = withAdmin<Params>(async ({ client, params }) => {
  const eventType = await client.getEventType(params.name);
  return NextResponse.json(eventType);
});

export const PUT = withAdmin<Params>(async ({ req, client, params }) => {
  const json = await req.json().catch(() => null);
  const parsed = UpdateEventType.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const eventType = await client.updateEventType(params.name, parsed.data);
  return NextResponse.json(eventType);
});

export const DELETE = withAdmin<Params>(async ({ req, client, params }) => {
  const expunge = req.nextUrl.searchParams.get("expunge") === "true";
  await client.deleteEventType(params.name, expunge);
  return new NextResponse(null, { status: 204 });
});
