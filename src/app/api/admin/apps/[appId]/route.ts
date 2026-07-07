import { NextResponse } from "next/server";
import { z } from "zod";
import { withAdmin } from "@/lib/api/admin";

const UpdateApplication = z.object({
  name: z.string().min(1),
});

export const GET = withAdmin<{ appId: string }>(async ({ client, params }) => {
  const app = await client.getApplication(params.appId);
  return NextResponse.json(app);
});

export const PATCH = withAdmin<{ appId: string }>(async ({ req, client, params }) => {
  const json = await req.json().catch(() => null);
  const parsed = UpdateApplication.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  // Svix's application update is a full replace (PUT), so merge the new name
  // onto the current app to preserve its uid, rate limit, and metadata.
  const current = await client.getApplication(params.appId);
  const app = await client.updateApplication(params.appId, {
    name: parsed.data.name,
    uid: current.uid ?? undefined,
    rateLimit: current.rateLimit ?? undefined,
    metadata: current.metadata,
  });
  return NextResponse.json(app);
});

export const DELETE = withAdmin<{ appId: string }>(async ({ client, params }) => {
  await client.deleteApplication(params.appId);
  return new NextResponse(null, { status: 204 });
});
