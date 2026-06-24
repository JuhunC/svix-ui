import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api/admin";

export const GET = withAdmin<{ appId: string }>(async ({ client, params }) => {
  const app = await client.getApplication(params.appId);
  return NextResponse.json(app);
});

export const DELETE = withAdmin<{ appId: string }>(async ({ client, params }) => {
  await client.deleteApplication(params.appId);
  return new NextResponse(null, { status: 204 });
});
