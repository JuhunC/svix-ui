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

import { POST } from "./route";

const BASE = ADMIN_ENV.SVIX_SERVER_URL;

beforeAll(() => svixServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  svixServer.resetHandlers();
  auth.token = undefined;
  clearAdminEnv();
});
afterAll(() => svixServer.close());

describe("POST /api/admin/apps/[appId]/portal-link", () => {
  it("mints a launch link embedding the app-scoped token", async () => {
    applyAdminEnv();
    process.env.SVIX_UI_PUBLIC_URL = "https://hooks.example.com";
    auth.token = validOperatorToken();
    svixServer.use(
      http.post(`${BASE}/api/v1/auth/app-portal-access/app_1`, () =>
        HttpResponse.json({ url: "https://docs.svix.com/app-portal/oss", token: "sk_portal" }),
      ),
    );

    const res = await POST(
      new NextRequest("http://localhost/api/admin/apps/app_1/portal-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ appId: "app_1" }) },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { link: string; token: string; app: string };
    expect(body.token).toBe("sk_portal");
    expect(body.app).toBe("app_1");
    const url = new URL(body.link);
    expect(url.origin).toBe("https://hooks.example.com");
    expect(url.pathname).toBe("/portal/launch");
    expect(url.searchParams.get("token")).toBe("sk_portal");
    expect(url.searchParams.get("app")).toBe("app_1");

    delete process.env.SVIX_UI_PUBLIC_URL;
  });

  it("returns a null link (client builds it) when no public URL is set", async () => {
    applyAdminEnv();
    delete process.env.SVIX_UI_PUBLIC_URL;
    auth.token = validOperatorToken();
    svixServer.use(
      http.post(`${BASE}/api/v1/auth/app-portal-access/app_1`, () =>
        HttpResponse.json({ url: "x", token: "sk_portal" }),
      ),
    );
    const res = await POST(
      new NextRequest("http://localhost/api/admin/apps/app_1/portal-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ appId: "app_1" }) },
    );
    const body = (await res.json()) as { link: string | null; token: string };
    expect(body.link).toBeNull();
    expect(body.token).toBe("sk_portal");
  });
});
