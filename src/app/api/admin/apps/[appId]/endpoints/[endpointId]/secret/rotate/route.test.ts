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
} from "../../../../../../../../../../tests/helpers/admin-route";

const auth = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "svix_ui_session" && auth.token ? { value: auth.token } : undefined,
  }),
}));

import { POST } from "./route";

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
const ROTATE_URL = `${BASE}/api/v1/app/${APP}/endpoint/${EP}/secret/rotate`;

function req(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}
const P = <T>(v: T) => ({ params: Promise.resolve(v) });

describe("POST /api/admin/apps/[appId]/endpoints/[endpointId]/secret/rotate", () => {
  it("returns 401 without a session and does not call upstream", async () => {
    applyAdminEnv();
    const res = await POST(
      req(`/api/admin/apps/${APP}/endpoints/${EP}/secret/rotate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      P({ appId: APP, endpointId: EP }),
    );
    expect(res.status).toBe(401);
  });

  it("rotates to a server-generated secret (null key) and returns 204", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let sentBody: Record<string, unknown> | undefined;
    let idem: string | null = null;
    let sentAuth: string | null = null;
    svixServer.use(
      http.post(ROTATE_URL, async ({ request }) => {
        sentAuth = request.headers.get("authorization");
        idem = request.headers.get("idempotency-key");
        sentBody = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const res = await POST(
      req(`/api/admin/apps/${APP}/endpoints/${EP}/secret/rotate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      P({ appId: APP, endpointId: EP }),
    );
    expect(res.status).toBe(204);
    expect(sentBody).toEqual({ key: null });
    expect(idem).toBeTruthy();
    expect(sentAuth).toBe(`Bearer ${ADMIN_ENV.SVIX_ADMIN_TOKEN}`);
  });

  it("forwards a caller-supplied key to the upstream rotate", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let sentBody: Record<string, unknown> | undefined;
    svixServer.use(
      http.post(ROTATE_URL, async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const res = await POST(
      req(`/api/admin/apps/${APP}/endpoints/${EP}/secret/rotate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "whsec_customKeyValue0000000000000000" }),
      }),
      P({ appId: APP, endpointId: EP }),
    );
    expect(res.status).toBe(204);
    expect(sentBody).toEqual({ key: "whsec_customKeyValue0000000000000000" });
  });

  it("rotates even when the request has no JSON body", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let sentBody: Record<string, unknown> | undefined;
    svixServer.use(
      http.post(ROTATE_URL, async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const res = await POST(
      req(`/api/admin/apps/${APP}/endpoints/${EP}/secret/rotate`, { method: "POST" }),
      P({ appId: APP, endpointId: EP }),
    );
    expect(res.status).toBe(204);
    expect(sentBody).toEqual({ key: null });
  });
});
