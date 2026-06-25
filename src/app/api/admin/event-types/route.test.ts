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
import { PUT, DELETE } from "./[name]/route";

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

describe("event types", () => {
  it("forwards includeArchived as include_archived", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let archivedParam: string | null = null;
    svixServer.use(
      http.get(`${BASE}/api/v1/event-type`, ({ request }) => {
        archivedParam = new URL(request.url).searchParams.get("include_archived");
        return HttpResponse.json({ data: [], iterator: null, done: true });
      }),
    );
    await GET(req("/api/admin/event-types?includeArchived=true"));
    expect(archivedParam).toBe("true");
  });

  it("creates an event type with a schema", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let body: { name: string; schemas?: unknown } | undefined;
    svixServer.use(
      http.post(`${BASE}/api/v1/event-type`, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json(
          { name: body!.name, description: "x", createdAt: "", updatedAt: "" },
          { status: 201 },
        );
      }),
    );
    const res = await POST(
      req("/api/admin/event-types", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "invoice.paid",
          description: "An invoice was paid",
          schemas: { "1": { type: "object" } },
        }),
      }),
    );
    expect(res.status).toBe(201);
    expect(body?.schemas).toEqual({ "1": { type: "object" } });
  });

  it("rejects an invalid event type name", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    const res = await POST(
      req("/api/admin/event-types", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "has spaces", description: "x" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("updates an event type via PUT", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    svixServer.use(
      http.put(`${BASE}/api/v1/event-type/invoice.paid`, () =>
        HttpResponse.json({ name: "invoice.paid", description: "updated", createdAt: "", updatedAt: "" }),
      ),
    );
    const res = await PUT(
      req("/x", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: "updated" }),
      }),
      { params: Promise.resolve({ name: "invoice.paid" }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).description).toBe("updated");
  });

  it("archives an event type by default (no expunge)", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let expungeParam: string | null = "unset";
    svixServer.use(
      http.delete(`${BASE}/api/v1/event-type/invoice.paid`, ({ request }) => {
        expungeParam = new URL(request.url).searchParams.get("expunge");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const res = await DELETE(req("/x", { method: "DELETE" }), {
      params: Promise.resolve({ name: "invoice.paid" }),
    });
    expect(res.status).toBe(204);
    expect(expungeParam).toBeNull();
  });

  it("permanently deletes when expunge=true", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let expungeParam: string | null = null;
    svixServer.use(
      http.delete(`${BASE}/api/v1/event-type/invoice.paid`, ({ request }) => {
        expungeParam = new URL(request.url).searchParams.get("expunge");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const res = await DELETE(req("/x?expunge=true", { method: "DELETE" }), {
      params: Promise.resolve({ name: "invoice.paid" }),
    });
    expect(res.status).toBe(204);
    expect(expungeParam).toBe("true");
  });
});
