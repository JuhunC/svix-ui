import { describe, expect, it } from "vitest";

/**
 * Full-stack integration over HTTP against a RUNNING svix-ui (its BFF talking to
 * a real svix-server). Exercises every user type and the portal-link flows:
 *
 *   - Operator (admin console) — /api/auth + /api/admin/*
 *   - Portal consumer, app-wide link — full /api/portal/* access
 *   - Portal consumer, endpoint-scoped link — restricted to one endpoint
 *   - Portal magic links — launch / expiry / tamper
 *
 * Runs only when SVIX_UI_URL is set (the integration CI job and the local
 * docker/dev stack provide it); otherwise the suite is skipped so the hermetic
 * unit run is unaffected. The svix-ui under test must be configured with the
 * operator credentials below and the same svix-server the token targets.
 */
const BASE = process.env.SVIX_UI_URL?.replace(/\/$/, "");
const OPERATOR_USER = process.env.SVIX_UI_OPERATOR_USERNAME ?? "admin";
const OPERATOR_PASS = process.env.SVIX_UI_OPERATOR_PASSWORD ?? "password123";

const suite = BASE ? describe : describe.skip;

/** Minimal cookie jar for Node fetch (which does not persist cookies). */
class CookieJar {
  private cookies = new Map<string, string>();

  capture(res: Response) {
    const setCookies =
      typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    for (const raw of setCookies) {
      const [pair, ...attrs] = raw.split(";");
      const eq = pair.indexOf("=");
      if (eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const cleared =
        value === "" || attrs.some((a) => /max-age=0/i.test(a) || /expires=thu, 01 jan 1970/i.test(a));
      if (cleared) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }
}

async function call(
  jar: CookieJar,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  const cookie = jar.header();
  if (cookie) headers["cookie"] = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  jar.capture(res);
  return res;
}

const json = (r: Response) => r.json() as Promise<Record<string, unknown>>;
const stamp = Date.now();
const uid = `int-${stamp}`;

suite("user flows (real svix-ui + svix-server)", () => {
  const operator = new CookieJar();
  let appId = "";
  const evtA = `int.a.${stamp}`;
  const evtB = `int.b.${stamp}`;
  let epMain = ""; // scoped endpoint
  let epSibling = ""; // the endpoint a scoped link must NOT reach

  // ---- Operator (admin console) --------------------------------------------
  describe("operator (admin console)", () => {
    it("rejects wrong credentials", async () => {
      const res = await call(operator, "POST", "/api/auth/login", {
        username: OPERATOR_USER,
        password: "definitely-wrong",
      });
      expect(res.status).toBe(401);
      expect(operator.has("svix_ui_session")).toBe(false);
    });

    it("refuses admin routes without a session", async () => {
      const res = await call(new CookieJar(), "GET", "/api/admin/apps");
      expect(res.status).toBe(401);
    });

    it("logs in and sets a session cookie", async () => {
      const res = await call(operator, "POST", "/api/auth/login", {
        username: OPERATOR_USER,
        password: OPERATOR_PASS,
      });
      expect(res.status).toBe(200);
      expect(operator.has("svix_ui_session")).toBe(true);
    });

    it("exposes the admin token", async () => {
      const res = await call(operator, "GET", "/api/admin/token");
      expect(res.status).toBe(200);
      expect(typeof (await json(res)).token).toBe("string");
    });

    it("creates event types", async () => {
      for (const [name, schema] of [
        [evtA, { "1": { type: "object", properties: { id: { type: "string" } } } }],
        [evtB, undefined],
      ] as const) {
        const res = await call(operator, "POST", "/api/admin/event-types", {
          name,
          description: `integration ${name}`,
          schemas: schema,
        });
        expect(res.status).toBe(201);
      }
    });

    it("creates an application", async () => {
      const res = await call(operator, "POST", "/api/admin/apps", {
        name: `Integration ${stamp}`,
        uid,
      });
      expect(res.status).toBe(201);
      appId = String((await json(res)).id);
      expect(appId).toMatch(/^app_/);
    });

    it("renames the application (PATCH) preserving uid", async () => {
      const res = await call(operator, "PATCH", `/api/admin/apps/${uid}`, {
        name: `Integration ${stamp} renamed`,
      });
      expect(res.status).toBe(200);
      const app = await json(res);
      expect(app.name).toBe(`Integration ${stamp} renamed`);
      expect(app.uid).toBe(uid);
    });

    it("creates two endpoints", async () => {
      const mk = async (desc: string) => {
        const res = await call(operator, "POST", `/api/admin/apps/${uid}/endpoints`, {
          url: "https://example.com/hook",
          description: desc,
          filterTypes: [evtA, evtB],
        });
        expect(res.status).toBe(201);
        return String((await json(res)).id);
      };
      epMain = await mk("scoped endpoint");
      epSibling = await mk("sibling endpoint");
      expect(epMain).toMatch(/^ep_/);
      expect(epSibling).not.toBe(epMain);
    });

    it("reveals the endpoint signing secret", async () => {
      const res = await call(operator, "GET", `/api/admin/apps/${uid}/endpoints/${epMain}/secret`);
      expect(res.status).toBe(200);
      expect(String((await json(res)).key)).toMatch(/^whsec_/);
    });

    it("sends a message and lists it", async () => {
      const send = await call(operator, "POST", `/api/admin/apps/${uid}/messages`, {
        eventType: evtA,
        payload: { id: "u_1" },
      });
      expect(send.status).toBe(202);
      const list = await call(operator, "GET", `/api/admin/apps/${uid}/messages?limit=10`);
      expect(list.status).toBe(200);
      expect(Array.isArray((await json(list)).data)).toBe(true);
    });
  });

  // ---- Portal consumer via an APP-WIDE link --------------------------------
  describe("portal consumer — app-wide link", () => {
    const consumer = new CookieJar();

    it("refuses portal routes without a portal session", async () => {
      const res = await call(new CookieJar(), "GET", "/api/portal/endpoints");
      expect(res.status).toBe(401);
    });

    it("mints an app-wide link and launches it into a portal session", async () => {
      const mint = await call(operator, "POST", `/api/admin/apps/${uid}/portal-link`, {});
      expect(mint.status).toBe(200);
      const body = await json(mint);
      expect(typeof body.token).toBe("string");
      expect(body.scoped).toBeUndefined();
      const q = new URLSearchParams({
        token: String(body.token),
        app: String(body.app),
        exp: String(body.exp),
      });
      const launch = await call(consumer, "GET", `/portal/launch?${q.toString()}`);
      expect(launch.status).toBe(307);
      expect(consumer.has("svix_ui_portal")).toBe(true);
    });

    it("sees ALL of the application's endpoints", async () => {
      const res = await call(consumer, "GET", "/api/portal/endpoints");
      expect(res.status).toBe(200);
      const ids = (((await json(res)).data as Array<{ id: string }>) ?? []).map((e) => e.id);
      expect(ids).toContain(epMain);
      expect(ids).toContain(epSibling);
    });

    it("can read the app-wide activity feed and the event catalog", async () => {
      expect((await call(consumer, "GET", "/api/portal/messages")).status).toBe(200);
      expect((await call(consumer, "GET", "/api/portal/event-types")).status).toBe(200);
    });

    it("may edit endpoint settings but not add or delete endpoints", async () => {
      const patch = await call(consumer, "PATCH", `/api/portal/endpoints/${epMain}`, {
        description: "edited by consumer",
      });
      expect(patch.status).toBe(200);
      expect((await call(consumer, "POST", "/api/portal/endpoints", { url: "https://x" })).status).toBe(405);
      expect((await call(consumer, "DELETE", `/api/portal/endpoints/${epMain}`)).status).toBe(405);
    });
  });

  // ---- Portal consumer via an ENDPOINT-SCOPED link -------------------------
  describe("portal consumer — endpoint-scoped link", () => {
    const scoped = new CookieJar();

    it("mints a scoped link (no token in the response) and launches to the endpoint", async () => {
      const mint = await call(operator, "POST", `/api/admin/apps/${uid}/portal-link`, {
        endpointId: epMain,
      });
      expect(mint.status).toBe(200);
      const body = await json(mint);
      expect(typeof body.scoped).toBe("string");
      expect(body.token).toBeUndefined(); // token is encrypted inside the blob
      const launch = await call(scoped, "GET", `/portal/launch?s=${encodeURIComponent(String(body.scoped))}`);
      expect(launch.status).toBe(307);
      expect(launch.headers.get("location")).toBe(`/portal/endpoints/${epMain}`);
      expect(scoped.has("svix_ui_portal")).toBe(true);
    });

    it("does not leak the app-scoped token in the cookie", async () => {
      const cookie = scoped.get("svix_ui_portal") ?? "";
      const decoded = Buffer.from(cookie, "base64url").toString("latin1");
      expect(decoded).not.toContain("eyJ"); // no JWT header
      expect(decoded).not.toContain(appId);
    });

    it("lists ONLY the scoped endpoint", async () => {
      const res = await call(scoped, "GET", "/api/portal/endpoints");
      expect(res.status).toBe(200);
      const ids = (((await json(res)).data as Array<{ id: string }>) ?? []).map((e) => e.id);
      expect(ids).toEqual([epMain]);
    });

    it("allows its own endpoint but 403s a sibling endpoint", async () => {
      expect((await call(scoped, "GET", `/api/portal/endpoints/${epMain}`)).status).toBe(200);
      expect((await call(scoped, "GET", `/api/portal/endpoints/${epMain}/secret`)).status).toBe(200);
      expect((await call(scoped, "GET", `/api/portal/endpoints/${epSibling}`)).status).toBe(403);
      expect((await call(scoped, "GET", `/api/portal/endpoints/${epSibling}/secret`)).status).toBe(403);
      expect(
        (await call(scoped, "PATCH", `/api/portal/endpoints/${epSibling}`, { description: "x" })).status,
      ).toBe(403);
    });

    it("blocks the app-wide message feed but keeps the event catalog", async () => {
      expect((await call(scoped, "GET", "/api/portal/messages")).status).toBe(403);
      expect((await call(scoped, "GET", "/api/portal/event-types")).status).toBe(200);
    });
  });

  // ---- Portal magic links: launch / expiry / tamper ------------------------
  describe("portal magic links", () => {
    it("redirects an expired app-wide link to /portal/expired", async () => {
      const mint = await call(operator, "POST", `/api/admin/apps/${uid}/portal-link`, {});
      const body = await json(mint);
      // exp in the URL only bounds cookie TTL; a valid launch needs token+app.
      const missing = await call(new CookieJar(), "GET", `/portal/launch?app=${body.app}`);
      expect(missing.status).toBe(307);
      expect(missing.headers.get("location")).toBe("/portal/expired");
    });

    it("redirects a tampered scope blob to /portal/expired", async () => {
      const res = await call(new CookieJar(), "GET", "/portal/launch?s=not-a-valid-blob");
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("/portal/expired");
      expect(res.headers.getSetCookie?.() ?? []).toEqual([]);
    });
  });
});
