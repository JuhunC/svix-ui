import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { SvixClient } from "./client";
import { SvixApiError } from "./errors";

const BASE = "http://svix.test";

interface Captured {
  url?: string;
  method?: string;
  auth?: string | null;
  idempotency?: string | null;
  body?: unknown;
}
let captured: Captured = {};

const server = setupServer();

function client() {
  return new SvixClient({ serverUrl: BASE, token: "tok_secret" });
}

async function capture(request: Request) {
  let body: unknown;
  const text = await request.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  captured = {
    url: request.url,
    method: request.method,
    auth: request.headers.get("authorization"),
    idempotency: request.headers.get("idempotency-key"),
    body,
  };
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  captured = {};
});
afterAll(() => server.close());

describe("SvixClient construction", () => {
  it("requires serverUrl and token", () => {
    expect(() => new SvixClient({ serverUrl: "", token: "x" })).toThrow();
    expect(() => new SvixClient({ serverUrl: BASE, token: "" })).toThrow();
  });

  it("strips trailing slashes from the server url", async () => {
    server.use(
      http.get(`${BASE}/api/v1/health`, () => new HttpResponse(null, { status: 204 })),
    );
    const c = new SvixClient({ serverUrl: `${BASE}///`, token: "t" });
    const health = await c.health();
    expect(health.ok).toBe(true);
  });
});

describe("authentication & headers", () => {
  it("sends a Bearer token on every request", async () => {
    server.use(
      http.get(`${BASE}/api/v1/app`, async ({ request }) => {
        await capture(request);
        return HttpResponse.json({ data: [], iterator: null, done: true });
      }),
    );
    await client().listApplications();
    expect(captured.auth).toBe("Bearer tok_secret");
  });

  it("attaches an Idempotency-Key to create operations", async () => {
    server.use(
      http.post(`${BASE}/api/v1/app`, async ({ request }) => {
        await capture(request);
        return HttpResponse.json({ id: "app_1", name: "Acme", createdAt: "", updatedAt: "" });
      }),
    );
    await client().createApplication({ name: "Acme" });
    expect(captured.idempotency).toBeTruthy();
    expect(captured.body).toEqual({ name: "Acme" });
  });
});

describe("cursor pagination", () => {
  it("forwards limit and iterator as query params", async () => {
    server.use(
      http.get(`${BASE}/api/v1/app`, async ({ request }) => {
        await capture(request);
        return HttpResponse.json({
          data: [{ id: "app_1", name: "Acme", createdAt: "", updatedAt: "" }],
          iterator: "cursor2",
          done: false,
        });
      }),
    );
    const page = await client().listApplications({ limit: 50, iterator: "cursor1" });
    const url = new URL(captured.url!);
    expect(url.searchParams.get("limit")).toBe("50");
    expect(url.searchParams.get("iterator")).toBe("cursor1");
    expect(page.done).toBe(false);
    expect(page.iterator).toBe("cursor2");
    expect(page.data).toHaveLength(1);
  });

  it("omits empty/undefined query params", async () => {
    server.use(
      http.get(`${BASE}/api/v1/app`, async ({ request }) => {
        await capture(request);
        return HttpResponse.json({ data: [], iterator: null, done: true });
      }),
    );
    await client().listApplications({});
    const url = new URL(captured.url!);
    expect(url.searchParams.has("limit")).toBe(false);
    expect(url.searchParams.has("iterator")).toBe(false);
  });
});

describe("error mapping", () => {
  it("maps 404 to a not-found SvixApiError", async () => {
    server.use(
      http.get(`${BASE}/api/v1/app/missing`, () =>
        HttpResponse.json({ code: "not_found", detail: "Application not found" }, { status: 404 }),
      ),
    );
    await expect(client().getApplication("missing")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
      message: "Application not found",
    });
    await client()
      .getApplication("missing")
      .catch((e) => {
        expect(e).toBeInstanceOf(SvixApiError);
        expect((e as SvixApiError).isNotFound).toBe(true);
      });
  });

  it("parses Retry-After on 429 responses", async () => {
    server.use(
      http.get(`${BASE}/api/v1/app`, () =>
        HttpResponse.json({ detail: "slow down" }, { status: 429, headers: { "retry-after": "7" } }),
      ),
    );
    await client()
      .listApplications()
      .catch((e) => {
        const err = e as SvixApiError;
        expect(err.isRateLimited).toBe(true);
        expect(err.retryAfter).toBe(7);
      });
  });

  it("extracts validation message from a detail array", async () => {
    server.use(
      http.post(`${BASE}/api/v1/app`, () =>
        HttpResponse.json({ detail: [{ msg: "name is required" }] }, { status: 422 }),
      ),
    );
    await expect(client().createApplication({ name: "" })).rejects.toMatchObject({
      message: "name is required",
    });
  });
});

describe("resource paths", () => {
  it("encodes ids and hits the right endpoint for secret rotation", async () => {
    server.use(
      http.post(
        `${BASE}/api/v1/app/app_1/endpoint/ep%2F1/secret/rotate`,
        async ({ request }) => {
          await capture(request);
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );
    await client().rotateEndpointSecret("app_1", "ep/1");
    expect(captured.method).toBe("POST");
    expect(captured.idempotency).toBeTruthy();
  });

  it("requests app portal access and returns url + token", async () => {
    server.use(
      http.post(`${BASE}/api/v1/auth/app-portal-access/app_1`, async ({ request }) => {
        await capture(request);
        return HttpResponse.json({ url: "https://portal.example/x", token: "ey.portal" });
      }),
    );
    const out = await client().appPortalAccess("app_1", {
      capabilities: ["ViewBase"],
      readOnly: true,
    });
    expect(out).toEqual({ url: "https://portal.example/x", token: "ey.portal" });
    expect(captured.body).toMatchObject({ capabilities: ["ViewBase"], readOnly: true });
  });
});

describe("health", () => {
  it("returns ok=false when the server is unhealthy", async () => {
    server.use(
      http.get(`${BASE}/api/v1/health`, () => new HttpResponse(null, { status: 503 })),
    );
    const health = await client().health();
    expect(health.ok).toBe(false);
    expect(health.status).toBe(503);
  });
});
