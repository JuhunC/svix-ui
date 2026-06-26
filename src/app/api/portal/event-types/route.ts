import { NextResponse } from "next/server";
import { listOptionsFromRequest } from "@/lib/api/admin";
import { withPortal } from "@/lib/api/portal";

export const GET = withPortal(async ({ req, client }) => {
  const withContent = req.nextUrl.searchParams.get("with_content") === "true";
  const page = await client.listEventTypes({
    ...listOptionsFromRequest(req),
    withContent,
  });
  return NextResponse.json(page);
});
