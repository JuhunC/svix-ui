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
} from "../../../../../tests/helpers/admin-route";

const auth = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "svix_ui_session" && auth.token ? { value: auth.token } : undefined,
  }),
}));

import { GET, POST } from "./route";
import { GET as GET_ONE, DELETE } from "./[appId]/route";

beforeAll(() => svixServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  svixServer.resetHandlers();
  auth.token = undefined;
  clearAdminEnv();
});
afterAll(() => svixServer.close());

const BASE = ADMIN_ENV.SVIX_SERVER_URL;

function req(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}

describe("GET /api/admin/apps", () => {
  it("returns 401 without a session", async () => {
    applyAdminEnv();
    const res = await GET(req("/api/admin/apps"));
    expect(res.status).toBe(401);
  });

  it("lists applications for an authenticated operator", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let sentAuth: string | null = null;
    svixServer.use(
      http.get(`${BASE}/api/v1/app`, ({ request }) => {
        sentAuth = request.headers.get("authorization");
        return HttpResponse.json({
          data: [{ id: "app_1", name: "Acme", createdAt: "", updatedAt: "" }],
          iterator: null,
          done: true,
        });
      }),
    );
    const res = await GET(req("/api/admin/apps?limit=10"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].name).toBe("Acme");
    expect(sentAuth).toBe(`Bearer ${ADMIN_ENV.SVIX_ADMIN_TOKEN}`);
  });
});

describe("POST /api/admin/apps", () => {
  it("creates an application and forwards an idempotency key", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let idem: string | null = null;
    svixServer.use(
      http.post(`${BASE}/api/v1/app`, async ({ request }) => {
        idem = request.headers.get("idempotency-key");
        const body = (await request.json()) as { name: string };
        return HttpResponse.json(
          { id: "app_new", name: body.name, createdAt: "", updatedAt: "" },
          { status: 201 },
        );
      }),
    );
    const res = await POST(
      req("/api/admin/apps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Beta" }),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("app_new");
    expect(idem).toBeTruthy();
  });

  it("rejects an invalid body with 400 and does not call upstream", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    const res = await POST(
      req("/api/admin/apps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notName: "x" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("/api/admin/apps/[appId]", () => {
  it("maps an upstream 404 to a 404 response", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    svixServer.use(
      http.get(`${BASE}/api/v1/app/missing`, () =>
        HttpResponse.json({ code: "not_found", detail: "Not found" }, { status: 404 }),
      ),
    );
    const res = await GET_ONE(req("/api/admin/apps/missing"), {
      params: Promise.resolve({ appId: "missing" }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes an application", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    svixServer.use(
      http.delete(`${BASE}/api/v1/app/app_1`, () => new HttpResponse(null, { status: 204 })),
    );
    const res = await DELETE(req("/api/admin/apps/app_1", { method: "DELETE" }), {
      params: Promise.resolve({ appId: "app_1" }),
    });
    expect(res.status).toBe(204);
  });
});
