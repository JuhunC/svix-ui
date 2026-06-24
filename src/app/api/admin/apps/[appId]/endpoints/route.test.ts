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
} from "../../../../../../../tests/helpers/admin-route";

const auth = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "svix_ui_session" && auth.token ? { value: auth.token } : undefined,
  }),
}));

import { GET, POST } from "./route";
import { PATCH, DELETE } from "./[endpointId]/route";
import { GET as GET_SECRET } from "./[endpointId]/secret/route";
import { POST as ROTATE } from "./[endpointId]/secret/rotate/route";

const BASE = ADMIN_ENV.SVIX_SERVER_URL;
const params = Promise.resolve({ appId: "app_1", endpointId: "ep_1" });
const appParams = Promise.resolve({ appId: "app_1" });

function req(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}

beforeAll(() => svixServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  svixServer.resetHandlers();
  auth.token = undefined;
  clearAdminEnv();
});
afterAll(() => svixServer.close());

describe("endpoints collection", () => {
  it("lists endpoints", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_1/endpoint`, () =>
        HttpResponse.json({
          data: [{ id: "ep_1", url: "https://x", createdAt: "", updatedAt: "" }],
          iterator: null,
          done: true,
        }),
      ),
    );
    const res = await GET(req("/api/admin/apps/app_1/endpoints"), { params: appParams });
    expect(res.status).toBe(200);
    expect((await res.json()).data[0].id).toBe("ep_1");
  });

  it("creates an endpoint", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    svixServer.use(
      http.post(`${BASE}/api/v1/app/app_1/endpoint`, async ({ request }) => {
        const body = (await request.json()) as { url: string };
        return HttpResponse.json(
          { id: "ep_new", url: body.url, createdAt: "", updatedAt: "" },
          { status: 201 },
        );
      }),
    );
    const res = await POST(
      req("/api/admin/apps/app_1/endpoints", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/hook" }),
      }),
      { params: appParams },
    );
    expect(res.status).toBe(201);
  });

  it("rejects a non-url endpoint with 400", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    const res = await POST(
      req("/api/admin/apps/app_1/endpoints", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "not-a-url" }),
      }),
      { params: appParams },
    );
    expect(res.status).toBe(400);
  });
});

describe("endpoint secret", () => {
  it("returns the signing secret", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_1/endpoint/ep_1/secret`, () =>
        HttpResponse.json({ key: "whsec_abc" }),
      ),
    );
    const res = await GET_SECRET(req("/x"), { params });
    expect((await res.json()).key).toBe("whsec_abc");
  });

  it("rotates the secret", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let hit = false;
    svixServer.use(
      http.post(`${BASE}/api/v1/app/app_1/endpoint/ep_1/secret/rotate`, () => {
        hit = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const res = await ROTATE(req("/x", { method: "POST" }), { params });
    expect(res.status).toBe(204);
    expect(hit).toBe(true);
  });
});

describe("endpoint item", () => {
  it("clears filterTypes by forwarding null", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let received: unknown;
    svixServer.use(
      http.patch(`${BASE}/api/v1/app/app_1/endpoint/ep_1`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ id: "ep_1", url: "https://x", createdAt: "", updatedAt: "" });
      }),
    );
    const res = await PATCH(
      req("/x", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filterTypes: null }),
      }),
      { params },
    );
    expect(res.status).toBe(200);
    expect(received).toEqual({ filterTypes: null });
  });

  it("deletes an endpoint", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    svixServer.use(
      http.delete(`${BASE}/api/v1/app/app_1/endpoint/ep_1`, () => new HttpResponse(null, { status: 204 })),
    );
    const res = await DELETE(req("/x", { method: "DELETE" }), { params });
    expect(res.status).toBe(204);
  });
});
