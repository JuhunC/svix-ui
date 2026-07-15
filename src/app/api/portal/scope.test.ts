// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";
import {
  ADMIN_ENV,
  applyAdminEnv,
  clearAdminEnv,
  svixServer,
} from "../../../../tests/helpers/admin-route";
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

import { GET as GET_ENDPOINTS } from "./endpoints/route";
import { GET as GET_ENDPOINT } from "./endpoints/[endpointId]/route";
import { GET as GET_SECRET } from "./endpoints/[endpointId]/secret/route";
import { GET as GET_ATTEMPTS } from "./endpoints/[endpointId]/attempts/route";
import { GET as LIST_MESSAGES } from "./messages/route";
import { GET as GET_MESSAGE } from "./messages/[msgId]/route";
import { GET as MSG_ATTEMPTS } from "./messages/[msgId]/attempts/route";
import { POST as RESEND } from "./endpoints/[endpointId]/messages/[msgId]/resend/route";

const BASE = ADMIN_ENV.SVIX_SERVER_URL;
const SCOPED = "ep_scoped";
const OTHER = "ep_other";

function scopedCookie(endpointId: string) {
  return sealPortalSession(
    { token: "tok", appId: "app_1", endpointId, exp: Date.now() + 60_000 },
    ADMIN_ENV.SVIX_UI_SESSION_SECRET,
  );
}
function appWideCookie() {
  return sealPortalSession(
    { token: "tok", appId: "app_1", exp: Date.now() + 60_000 },
    ADMIN_ENV.SVIX_UI_SESSION_SECRET,
  );
}
function req(path: string) {
  return new NextRequest(`http://localhost${path}`);
}
const P = <T>(v: T) => ({ params: Promise.resolve(v) });

beforeAll(() => svixServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  svixServer.resetHandlers();
  cookieState.value = undefined;
  clearAdminEnv();
});
afterAll(() => svixServer.close());

describe("endpoint-scoped portal session — access boundary", () => {
  it("blocks a sibling endpoint's detail (403) without touching upstream", async () => {
    applyAdminEnv();
    cookieState.value = scopedCookie(SCOPED);
    let upstreamHit = false;
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_1/endpoint/${OTHER}`, () => {
        upstreamHit = true;
        return HttpResponse.json({ id: OTHER });
      }),
    );
    const res = await GET_ENDPOINT(req(`/api/portal/endpoints/${OTHER}`), P({ endpointId: OTHER }));
    expect(res.status).toBe(403);
    expect(upstreamHit).toBe(false);
  });

  it("blocks a sibling endpoint's SECRET (403)", async () => {
    applyAdminEnv();
    cookieState.value = scopedCookie(SCOPED);
    const res = await GET_SECRET(req(`/api/portal/endpoints/${OTHER}/secret`), P({ endpointId: OTHER }));
    expect(res.status).toBe(403);
  });

  it("allows the scoped endpoint itself", async () => {
    applyAdminEnv();
    cookieState.value = scopedCookie(SCOPED);
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_1/endpoint/${SCOPED}`, () =>
        HttpResponse.json({ id: SCOPED, url: "https://x" }),
      ),
    );
    const res = await GET_ENDPOINT(req(`/api/portal/endpoints/${SCOPED}`), P({ endpointId: SCOPED }));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe(SCOPED);
  });

  it("allows the scoped endpoint's attempts", async () => {
    applyAdminEnv();
    cookieState.value = scopedCookie(SCOPED);
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_1/attempt/endpoint/${SCOPED}`, () =>
        HttpResponse.json({ data: [], iterator: null, done: true }),
      ),
    );
    const res = await GET_ATTEMPTS(req(`/api/portal/endpoints/${SCOPED}/attempts`), P({ endpointId: SCOPED }));
    expect(res.status).toBe(200);
  });

  it("lists only the scoped endpoint, never the app's full list", async () => {
    applyAdminEnv();
    cookieState.value = scopedCookie(SCOPED);
    let listHit = false;
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_1/endpoint`, () => {
        listHit = true; // the app-wide list must NOT be called
        return HttpResponse.json({ data: [{ id: SCOPED }, { id: OTHER }], iterator: null, done: true });
      }),
      http.get(`${BASE}/api/v1/app/app_1/endpoint/${SCOPED}`, () =>
        HttpResponse.json({ id: SCOPED, url: "https://x" }),
      ),
    );
    const res = await GET_ENDPOINTS(req("/api/portal/endpoints"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(SCOPED);
    expect(listHit).toBe(false);
  });

  it("blocks the app-wide message list (403)", async () => {
    applyAdminEnv();
    cookieState.value = scopedCookie(SCOPED);
    const res = await LIST_MESSAGES(req("/api/portal/messages"));
    expect(res.status).toBe(403);
  });

  it("blocks cross-endpoint message attempts (403)", async () => {
    applyAdminEnv();
    cookieState.value = scopedCookie(SCOPED);
    const res = await MSG_ATTEMPTS(req("/api/portal/messages/msg_1/attempts"), P({ msgId: "msg_1" }));
    expect(res.status).toBe(403);
  });

  it("refuses to resend a foreign message to the scoped endpoint (no delivery here)", async () => {
    applyAdminEnv();
    cookieState.value = scopedCookie(SCOPED);
    let resendHit = false;
    svixServer.use(
      // msg_foreign was delivered to OTHER, not SCOPED.
      http.get(`${BASE}/api/v1/app/app_1/attempt/msg/msg_foreign`, () =>
        HttpResponse.json({ data: [{ id: "a", endpointId: OTHER }], iterator: null, done: true }),
      ),
      http.post(
        `${BASE}/api/v1/app/app_1/msg/msg_foreign/endpoint/${SCOPED}/resend`,
        () => {
          resendHit = true;
          return new HttpResponse(null, { status: 202 });
        },
      ),
    );
    const res = await RESEND(req(`/api/portal/endpoints/${SCOPED}/messages/msg_foreign/resend`), {
      params: Promise.resolve({ endpointId: SCOPED, msgId: "msg_foreign" }),
    });
    expect(res.status).toBe(404);
    expect(resendHit).toBe(false); // upstream resend must NOT be called
  });

  it("allows resending a message that was delivered to the scoped endpoint", async () => {
    applyAdminEnv();
    cookieState.value = scopedCookie(SCOPED);
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_1/attempt/msg/msg_mine`, () =>
        HttpResponse.json({ data: [{ id: "a", endpointId: SCOPED }], iterator: null, done: true }),
      ),
      http.post(
        `${BASE}/api/v1/app/app_1/msg/msg_mine/endpoint/${SCOPED}/resend`,
        () => new HttpResponse(null, { status: 202 }),
      ),
    );
    const res = await RESEND(req(`/api/portal/endpoints/${SCOPED}/messages/msg_mine/resend`), {
      params: Promise.resolve({ endpointId: SCOPED, msgId: "msg_mine" }),
    });
    expect(res.status).toBe(202);
  });

  it("returns a message only if it was delivered to the scoped endpoint", async () => {
    applyAdminEnv();
    cookieState.value = scopedCookie(SCOPED);
    // msg delivered only to OTHER → 404 for the scoped consumer.
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_1/attempt/msg/msg_other`, () =>
        HttpResponse.json({ data: [{ id: "att", endpointId: OTHER }], iterator: null, done: true }),
      ),
    );
    const denied = await GET_MESSAGE(req("/api/portal/messages/msg_other"), P({ msgId: "msg_other" }));
    expect(denied.status).toBe(404);

    // msg delivered to SCOPED → payload returned.
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_1/attempt/msg/msg_mine`, () =>
        HttpResponse.json({ data: [{ id: "att", endpointId: SCOPED }], iterator: null, done: true }),
      ),
      http.get(`${BASE}/api/v1/app/app_1/msg/msg_mine`, () =>
        HttpResponse.json({ id: "msg_mine", payload: { ok: true } }),
      ),
    );
    const ok = await GET_MESSAGE(req("/api/portal/messages/msg_mine"), P({ msgId: "msg_mine" }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).id).toBe("msg_mine");
  });
});

describe("app-wide portal session is unaffected", () => {
  it("lists the full endpoint list", async () => {
    applyAdminEnv();
    cookieState.value = appWideCookie();
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_1/endpoint`, () =>
        HttpResponse.json({ data: [{ id: SCOPED }, { id: OTHER }], iterator: null, done: true }),
      ),
    );
    const res = await GET_ENDPOINTS(req("/api/portal/endpoints"));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toHaveLength(2);
  });

  it("allows the app-wide message list", async () => {
    applyAdminEnv();
    cookieState.value = appWideCookie();
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_1/msg`, () =>
        HttpResponse.json({ data: [{ id: "m1" }], iterator: null, done: true }),
      ),
    );
    const res = await LIST_MESSAGES(req("/api/portal/messages"));
    expect(res.status).toBe(200);
  });
});
