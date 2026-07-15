// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
import {
  ADMIN_ENV,
  applyAdminEnv,
  clearAdminEnv,
  svixServer,
  validOperatorToken,
} from "../../../../../../../../../tests/helpers/admin-route";

const auth = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "svix_ui_session" && auth.token ? { value: auth.token } : undefined,
  }),
}));

import { GET } from "./route";

beforeAll(() => svixServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  svixServer.resetHandlers();
  auth.token = undefined;
  clearAdminEnv();
});
afterAll(() => svixServer.close());

const BASE = ADMIN_ENV.SVIX_SERVER_URL;
const APP = "app_1";
const EP = "ep_1";

function req(path: string) {
  return new NextRequest(`http://localhost${path}`);
}
const P = <T>(v: T) => ({ params: Promise.resolve(v) });

describe("GET /api/admin/apps/[appId]/endpoints/[endpointId]/secret", () => {
  it("returns 401 without a session", async () => {
    applyAdminEnv();
    const res = await GET(
      req(`/api/admin/apps/${APP}/endpoints/${EP}/secret`),
      P({ appId: APP, endpointId: EP }),
    );
    expect(res.status).toBe(401);
  });

  it("returns the signing key for an authenticated operator", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let sentAuth: string | null = null;
    svixServer.use(
      http.get(`${BASE}/api/v1/app/${APP}/endpoint/${EP}/secret`, ({ request }) => {
        sentAuth = request.headers.get("authorization");
        return HttpResponse.json({ key: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw" });
      }),
    );
    const res = await GET(
      req(`/api/admin/apps/${APP}/endpoints/${EP}/secret`),
      P({ appId: APP, endpointId: EP }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBe("whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw");
    expect(sentAuth).toBe(`Bearer ${ADMIN_ENV.SVIX_ADMIN_TOKEN}`);
  });
});
