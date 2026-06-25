// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isRequestSecure } from "./server";

function req(url: string, headers?: Record<string, string>) {
  return new NextRequest(url, { headers });
}

afterEach(() => {
  delete process.env.SVIX_UI_COOKIE_SECURE;
});

describe("isRequestSecure", () => {
  it("is false for plain http", () => {
    expect(isRequestSecure(req("http://example.com/"))).toBe(false);
  });

  it("is true for https", () => {
    expect(isRequestSecure(req("https://example.com/"))).toBe(true);
  });

  it("honours X-Forwarded-Proto from a TLS-terminating proxy", () => {
    expect(
      isRequestSecure(req("http://example.com/", { "x-forwarded-proto": "https" })),
    ).toBe(true);
    expect(
      isRequestSecure(req("http://example.com/", { "x-forwarded-proto": "http" })),
    ).toBe(false);
  });

  it("lets SVIX_UI_COOKIE_SECURE force the value", () => {
    process.env.SVIX_UI_COOKIE_SECURE = "true";
    expect(isRequestSecure(req("http://example.com/"))).toBe(true);

    process.env.SVIX_UI_COOKIE_SECURE = "false";
    expect(
      isRequestSecure(req("https://example.com/", { "x-forwarded-proto": "https" })),
    ).toBe(false);
  });
});
