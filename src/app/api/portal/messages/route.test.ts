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

import { GET as LIST } from "./route";
import { GET as GET_ONE } from "./[msgId]/route";

const BASE = ADMIN_ENV.SVIX_SERVER_URL;

function portalCookie(appId: string) {
  return sealPortalSession(
    { token: "sk_app", appId, exp: Date.now() + 60_000 },
    ADMIN_ENV.SVIX_UI_SESSION_SECRET,
  );
}
function req(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

beforeAll(() => svixServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  svixServer.resetHandlers();
  cookieState.value = undefined;
  clearAdminEnv();
});
afterAll(() => svixServer.close());

describe("portal messages", () => {
  it("lists messages for the session app", async () => {
    applyAdminEnv();
    cookieState.value = portalCookie("app_42");
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_42/msg`, () =>
        HttpResponse.json({ data: [], iterator: null, done: true }),
      ),
    );
    expect((await LIST(req("/api/portal/messages"))).status).toBe(200);
  });

  it("gets a single message (regression: route must exist)", async () => {
    applyAdminEnv();
    cookieState.value = portalCookie("app_42");
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_42/msg/msg_1`, () =>
        HttpResponse.json({ id: "msg_1", eventType: "x", payload: {}, timestamp: "" }),
      ),
    );
    const res = await GET_ONE(req("/api/portal/messages/msg_1"), {
      params: Promise.resolve({ msgId: "msg_1" }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("msg_1");
  });

  it("returns 401 without a portal session", async () => {
    applyAdminEnv();
    const res = await GET_ONE(req("/api/portal/messages/msg_1"), {
      params: Promise.resolve({ msgId: "msg_1" }),
    });
    expect(res.status).toBe(401);
  });
});
