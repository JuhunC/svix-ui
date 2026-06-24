// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
import {
  ADMIN_ENV,
  applyAdminEnv,
  clearAdminEnv,
  svixServer,
} from "../../../../../tests/helpers/admin-route";
import { sealPortalSession } from "@/lib/auth/portal";

const cookieState = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "svix_ui_portal" && cookieState.value
        ? { value: cookieState.value }
        : undefined,
  }),
}));

import { GET, POST } from "./route";

const BASE = ADMIN_ENV.SVIX_SERVER_URL;

function portalCookie(token: string, appId: string) {
  return sealPortalSession(
    { token, appId, exp: Date.now() + 60_000 },
    ADMIN_ENV.SVIX_UI_SESSION_SECRET,
  );
}

function req(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}

beforeAll(() => svixServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  svixServer.resetHandlers();
  cookieState.value = undefined;
  clearAdminEnv();
});
afterAll(() => svixServer.close());

describe("portal endpoints", () => {
  it("returns 401 without a portal session", async () => {
    applyAdminEnv();
    const res = await GET(req("/api/portal/endpoints"));
    expect(res.status).toBe(401);
  });

  it("lists endpoints using the app-scoped token and app id", async () => {
    applyAdminEnv();
    cookieState.value = portalCookie("sk_app_scoped", "app_42");
    let sentAuth: string | null = null;
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_42/endpoint`, ({ request }) => {
        sentAuth = request.headers.get("authorization");
        return HttpResponse.json({ data: [], iterator: null, done: true });
      }),
    );
    const res = await GET(req("/api/portal/endpoints"));
    expect(res.status).toBe(200);
    expect(sentAuth).toBe("Bearer sk_app_scoped");
  });

  it("creates an endpoint scoped to the session app", async () => {
    applyAdminEnv();
    cookieState.value = portalCookie("sk_app_scoped", "app_42");
    svixServer.use(
      http.post(`${BASE}/api/v1/app/app_42/endpoint`, async ({ request }) => {
        const body = (await request.json()) as { url: string };
        return HttpResponse.json(
          { id: "ep_new", url: body.url, createdAt: "", updatedAt: "" },
          { status: 201 },
        );
      }),
    );
    const res = await POST(
      req("/api/portal/endpoints", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/hook" }),
      }),
    );
    expect(res.status).toBe(201);
  });
});
