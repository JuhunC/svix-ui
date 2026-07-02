// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  ADMIN_ENV,
  applyAdminEnv,
  clearAdminEnv,
  validOperatorToken,
} from "../../../../../tests/helpers/admin-route";

const auth = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "svix_ui_session" && auth.token ? { value: auth.token } : undefined,
  }),
}));

import { GET } from "./route";

afterEach(() => {
  auth.token = undefined;
  clearAdminEnv();
});

function req(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe("GET /api/admin/token", () => {
  it("returns 401 without an operator session", async () => {
    applyAdminEnv();
    const res = await GET(req("/api/admin/token"));
    expect(res.status).toBe(401);
  });

  it("returns the admin token + server URL for an authenticated operator", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    const res = await GET(req("/api/admin/token"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe(ADMIN_ENV.SVIX_ADMIN_TOKEN);
    expect(body.serverUrl).toBe(ADMIN_ENV.SVIX_SERVER_URL);
  });
});
