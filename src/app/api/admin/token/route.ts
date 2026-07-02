import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/api/admin";
import { loadServerConfig } from "@/lib/config";

// Returns the configured Svix admin token to an authenticated operator so they
// can copy it for API calls / SDK configuration. Guarded by withAdmin (operator
// session required, else 401); the token is fetched on demand and never
// embedded in server-rendered HTML.
export const GET = withAdmin(() => {
  const cfg = loadServerConfig();
  return NextResponse.json({
    token: cfg.svixAdminToken,
    serverUrl: cfg.svixServerUrl,
  });
});
