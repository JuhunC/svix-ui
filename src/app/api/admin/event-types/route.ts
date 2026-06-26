import { NextResponse } from "next/server";
import { z } from "zod";
import { listOptionsFromRequest, withAdmin } from "@/lib/api/admin";

const EVENT_TYPE_NAME = /^[a-zA-Z0-9\-_.]+$/;

const CreateEventType = z.object({
  name: z
    .string()
    .min(1)
    .regex(EVENT_TYPE_NAME, "name may only contain letters, numbers, . _ -"),
  description: z.string().min(1),
  schemas: z.record(z.string(), z.unknown()).optional(),
  archived: z.boolean().optional(),
  deprecated: z.boolean().optional(),
  groupName: z.string().optional(),
});

export const GET = withAdmin(async ({ req, client }) => {
  const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "true";
  const withContent = req.nextUrl.searchParams.get("with_content") === "true";
  const page = await client.listEventTypes({
    ...listOptionsFromRequest(req),
    includeArchived,
    withContent,
  });
  return NextResponse.json(page);
});

export const POST = withAdmin(async ({ req, client }) => {
  const json = await req.json().catch(() => null);
  const parsed = CreateEventType.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const eventType = await client.createEventType(parsed.data);
  return NextResponse.json(eventType, { status: 201 });
});
