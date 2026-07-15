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
} from "../../../../../../tests/helpers/admin-route";

const auth = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "svix_ui_session" && auth.token ? { value: auth.token } : undefined,
  }),
}));

import { PUT, DELETE } from "./route";

beforeAll(() => svixServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  svixServer.resetHandlers();
  auth.token = undefined;
  clearAdminEnv();
});
afterAll(() => svixServer.close());

const BASE = ADMIN_ENV.SVIX_SERVER_URL;
const NAME = "user.created";

function req(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}
const P = <T>(v: T) => ({ params: Promise.resolve(v) });

describe("PUT /api/admin/event-types/[name]", () => {
  it("returns 401 without a session and does not call upstream", async () => {
    applyAdminEnv();
    const res = await PUT(
      req(`/api/admin/event-types/${NAME}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: "A user was created" }),
      }),
      P({ name: NAME }),
    );
    expect(res.status).toBe(401);
  });

  it("forwards description/schemas/archived/deprecated to the upstream PUT", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let sentBody: Record<string, unknown> | undefined;
    let sentAuth: string | null = null;
    svixServer.use(
      http.put(`${BASE}/api/v1/event-type/${NAME}`, async ({ request }) => {
        sentAuth = request.headers.get("authorization");
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          name: NAME,
          description: (sentBody as { description: string }).description,
          archived: (sentBody as { archived: boolean }).archived,
          deprecated: (sentBody as { deprecated: boolean }).deprecated,
          createdAt: "",
          updatedAt: "",
        });
      }),
    );
    const schemas = { "1": { type: "object", properties: { id: { type: "string" } } } };
    const res = await PUT(
      req(`/api/admin/event-types/${NAME}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: "A user was created",
          schemas,
          archived: true,
          deprecated: false,
        }),
      }),
      P({ name: NAME }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe(NAME);
    expect(sentAuth).toBe(`Bearer ${ADMIN_ENV.SVIX_ADMIN_TOKEN}`);
    expect(sentBody).toMatchObject({
      description: "A user was created",
      schemas,
      archived: true,
      deprecated: false,
    });
  });

  it("rejects an empty description with 400 and does not call upstream", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    const res = await PUT(
      req(`/api/admin/event-types/${NAME}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description: "" }),
      }),
      P({ name: NAME }),
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/event-types/[name]", () => {
  it("returns 401 without a session", async () => {
    applyAdminEnv();
    const res = await DELETE(
      req(`/api/admin/event-types/${NAME}?expunge=true`, { method: "DELETE" }),
      P({ name: NAME }),
    );
    expect(res.status).toBe(401);
  });

  it("expunges (expunge=true) via the upstream DELETE and forwards the query", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let sentExpunge: string | null = "unset";
    svixServer.use(
      http.delete(`${BASE}/api/v1/event-type/${NAME}`, ({ request }) => {
        sentExpunge = new URL(request.url).searchParams.get("expunge");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const res = await DELETE(
      req(`/api/admin/event-types/${NAME}?expunge=true`, { method: "DELETE" }),
      P({ name: NAME }),
    );
    expect(res.status).toBe(204);
    expect(sentExpunge).toBe("true");
  });

  it("soft-deletes without an expunge query when the flag is absent", async () => {
    applyAdminEnv();
    auth.token = validOperatorToken();
    let sentExpunge: string | null = "unset";
    svixServer.use(
      http.delete(`${BASE}/api/v1/event-type/${NAME}`, ({ request }) => {
        sentExpunge = new URL(request.url).searchParams.get("expunge");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const res = await DELETE(
      req(`/api/admin/event-types/${NAME}`, { method: "DELETE" }),
      P({ name: NAME }),
    );
    expect(res.status).toBe(204);
    expect(sentExpunge).toBeNull();
  });
});
