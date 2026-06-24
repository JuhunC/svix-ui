// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { resetConfigCache } from "@/lib/config";
import { SESSION_COOKIE } from "@/lib/auth/server";
import { verifySession } from "@/lib/auth/session";

const ENV = {
  SVIX_SERVER_URL: "http://svix:8071",
  SVIX_ADMIN_TOKEN: "tok",
  SVIX_UI_SESSION_SECRET: "session-secret-at-least-16-chars",
  SVIX_UI_OPERATOR_USERNAME: "admin",
  SVIX_UI_OPERATOR_PASSWORD: "hunter2",
};

function setEnv() {
  Object.assign(process.env, ENV);
  resetConfigCache();
}
function clearEnv() {
  for (const key of Object.keys(ENV)) delete process.env[key];
  resetConfigCache();
}

function loginRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => clearEnv());

describe("POST /api/auth/login", () => {
  it("sets a verifiable session cookie on valid credentials", async () => {
    setEnv();
    const res = await POST(loginRequest({ username: "admin", password: "hunter2" }));
    expect(res.status).toBe(200);
    const cookie = res.cookies.get(SESSION_COOKIE);
    expect(cookie?.value).toBeTruthy();
    const payload = verifySession(cookie!.value, ENV.SVIX_UI_SESSION_SECRET);
    expect(payload?.sub).toBe("admin");
  });

  it("rejects bad credentials with 401 and no cookie", async () => {
    setEnv();
    const res = await POST(loginRequest({ username: "admin", password: "wrong" }));
    expect(res.status).toBe(401);
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBeFalsy();
  });

  it("returns 400 on a malformed body", async () => {
    setEnv();
    const res = await POST(loginRequest({ username: "admin" }));
    expect(res.status).toBe(400);
  });

  it("returns 500 when the server is misconfigured", async () => {
    clearEnv();
    const res = await POST(loginRequest({ username: "admin", password: "hunter2" }));
    expect(res.status).toBe(500);
  });
});
