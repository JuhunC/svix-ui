import { describe, it, expect, afterEach, vi } from "vitest";
import { getAppVersion } from "./version";

afterEach(() => vi.unstubAllEnvs());

describe("getAppVersion", () => {
  it("includes a shortened commit when SVIX_UI_GIT_SHA is set", () => {
    vi.stubEnv("SVIX_UI_GIT_SHA", "4f66a2ecafebabe0001");
    const v = getAppVersion();
    expect(v.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(v.commit).toBe("4f66a2e");
    expect(v.label).toBe(`v${v.version} · 4f66a2e`);
  });

  it("omits the commit when SVIX_UI_GIT_SHA is unset", () => {
    vi.stubEnv("SVIX_UI_GIT_SHA", "");
    const v = getAppVersion();
    expect(v.commit).toBe("");
    expect(v.label).toBe(`v${v.version}`);
  });
});
