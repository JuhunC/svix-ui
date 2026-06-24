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
import { GET as GET_ATTEMPTS } from "./[msgId]/attempts/route";
import { POST as RESEND } from "./[msgId]/endpoints/[endpointId]/resend/route";
import { POST as RECOVER } from "../endpoints/[endpointId]/recover/route";

const BASE = ADMIN_ENV.SVIX_SERVER_URL;

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

const appParams = { params: Promise.resolve({ appId: "app_1" }) };

describe("messages", () => {
  it("lists messages", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_1/msg`, () =>
        HttpResponse.json({
          data: [{ id: "msg_1", eventType: "invoice.paid", payload: {}, timestamp: "" }],
          iterator: null,
          done: true,
        }),
      ),
    );
    const res = await GET(req("/x"), appParams);
    expect(res.status).toBe(200);
    expect((await res.json()).data[0].id).toBe("msg_1");
  });

  it("sends a message and returns 202", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    svixServer.use(
      http.post(`${BASE}/api/v1/app/app_1/msg`, async ({ request }) => {
        const body = (await request.json()) as { eventType: string };
        return HttpResponse.json({ id: "msg_x", eventType: body.eventType, payload: {}, timestamp: "" });
      }),
    );
    const res = await POST(
      req("/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventType: "invoice.paid", payload: { amount: 1 } }),
      }),
      appParams,
    );
    expect(res.status).toBe(202);
  });

  it("rejects a non-object payload with 400", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    const res = await POST(
      req("/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventType: "invoice.paid", payload: "nope" }),
      }),
      appParams,
    );
    expect(res.status).toBe(400);
  });
});

describe("attempts and resend", () => {
  it("lists attempts for a message", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    svixServer.use(
      http.get(`${BASE}/api/v1/app/app_1/attempt/msg/msg_1`, () =>
        HttpResponse.json({ data: [], iterator: null, done: true }),
      ),
    );
    const res = await GET_ATTEMPTS(req("/x"), {
      params: Promise.resolve({ appId: "app_1", msgId: "msg_1" }),
    });
    expect(res.status).toBe(200);
  });

  it("resends a message to an endpoint", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let hit = false;
    svixServer.use(
      http.post(`${BASE}/api/v1/app/app_1/msg/msg_1/endpoint/ep_1/resend`, () => {
        hit = true;
        return new HttpResponse(null, { status: 202 });
      }),
    );
    const res = await RESEND(req("/x", { method: "POST" }), {
      params: Promise.resolve({ appId: "app_1", msgId: "msg_1", endpointId: "ep_1" }),
    });
    expect(res.status).toBe(202);
    expect(hit).toBe(true);
  });
});

describe("recover", () => {
  it("starts recovery with a since timestamp", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let body: { since?: string } | undefined;
    svixServer.use(
      http.post(`${BASE}/api/v1/app/app_1/endpoint/ep_1/recover`, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return new HttpResponse(null, { status: 202 });
      }),
    );
    const res = await RECOVER(
      req("/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ since: "2026-06-01T00:00:00Z" }),
      }),
      { params: Promise.resolve({ appId: "app_1", endpointId: "ep_1" }) },
    );
    expect(res.status).toBe(202);
    expect(body?.since).toBe("2026-06-01T00:00:00Z");
  });

  it("rejects recovery without since (400)", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    const res = await RECOVER(
      req("/x", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ appId: "app_1", endpointId: "ep_1" }) },
    );
    expect(res.status).toBe(400);
  });
});
