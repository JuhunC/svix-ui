import { NextResponse } from "next/server";
import { z } from "zod";
import { listOptionsFromRequest, withAdmin } from "@/lib/api/admin";

const CreateApp = z.object({
  name: z.string().min(1),
  uid: z.string().min(1).optional(),
  rateLimit: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const GET = withAdmin(async ({ req, client }) => {
  const page = await client.listApplications(listOptionsFromRequest(req));
  return NextResponse.json(page);
});

export const POST = withAdmin(async ({ req, client }) => {
  const json = await req.json().catch(() => null);
  const parsed = CreateApp.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const app = await client.createApplication(parsed.data);
  return NextResponse.json(app, { status: 201 });
});
