import { afterEach, describe, expect, it } from "vitest";
import {
  getAdminClient,
  getGuideNetworkInfo,
  loadServerConfig,
  resetConfigCache,
} from "./config";
import { SvixClient } from "./svix/client";
import { SvixConfigError } from "./svix/errors";

const validEnv = {
  SVIX_SERVER_URL: "http://svix-server:8071",
  SVIX_ADMIN_TOKEN: "testsk.token",
  SVIX_UI_SESSION_SECRET: "a-very-long-session-secret",
  SVIX_UI_OPERATOR_USERNAME: "admin",
  SVIX_UI_OPERATOR_PASSWORD: "hunter2",
} as unknown as NodeJS.ProcessEnv;

afterEach(() => resetConfigCache());

describe("loadServerConfig", () => {
  it("parses a valid environment", () => {
    const cfg = loadServerConfig(validEnv);
    expect(cfg.svixServerUrl).toBe("http://svix-server:8071");
    expect(cfg.operatorUsername).toBe("admin");
  });

  it("throws SvixConfigError listing every missing field", () => {
    try {
      loadServerConfig({} as NodeJS.ProcessEnv);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SvixConfigError);
      const msg = (e as Error).message;
      expect(msg).toContain("svixServerUrl");
      expect(msg).toContain("svixAdminToken");
      expect(msg).toContain("sessionSecret");
    }
  });

  it("rejects a too-short session secret", () => {
    expect(() =>
      loadServerConfig({ ...validEnv, SVIX_UI_SESSION_SECRET: "short" } as NodeJS.ProcessEnv),
    ).toThrow(SvixConfigError);
  });

  it("rejects a non-url server url", () => {
    expect(() =>
      loadServerConfig({ ...validEnv, SVIX_SERVER_URL: "not-a-url" } as NodeJS.ProcessEnv),
    ).toThrow(SvixConfigError);
  });

  it("treats a blank public url as unset (falls back to request origin)", () => {
    const cfg = loadServerConfig({
      ...validEnv,
      SVIX_UI_PUBLIC_URL: "   ",
    } as NodeJS.ProcessEnv);
    expect(cfg.publicUrl).toBeUndefined();
  });

  it("keeps a provided public url", () => {
    const cfg = loadServerConfig({
      ...validEnv,
      SVIX_UI_PUBLIC_URL: "https://hooks.example.com",
    } as NodeJS.ProcessEnv);
    expect(cfg.publicUrl).toBe("https://hooks.example.com");
  });
});

describe("getAdminClient", () => {
  it("returns a SvixClient bound to the configured server", () => {
    const client = getAdminClient(validEnv);
    expect(client).toBeInstanceOf(SvixClient);
  });
});

describe("getGuideNetworkInfo", () => {
  it("returns the configured source IP and the svix-server host:port", () => {
    const info = getGuideNetworkInfo({
      ...validEnv,
      SVIX_UI_WEBHOOK_SOURCE_IP: "203.0.113.10",
    } as NodeJS.ProcessEnv);
    expect(info.svixSourceIp).toBe("203.0.113.10");
    expect(info.svixServerAddress).toBe("svix-server:8071");
  });

  it("omits the source IP when unset but still returns the server address", () => {
    const info = getGuideNetworkInfo(validEnv);
    expect(info.svixSourceIp).toBeUndefined();
    expect(info.svixServerAddress).toBe("svix-server:8071");
  });

  it("returns an empty object (never throws) when config is invalid", () => {
    expect(getGuideNetworkInfo({} as NodeJS.ProcessEnv)).toEqual({});
  });
});
