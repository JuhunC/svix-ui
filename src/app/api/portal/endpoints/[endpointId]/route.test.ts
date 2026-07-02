// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as route from "./route";

describe("portal endpoint detail route", () => {
  it("allows read and settings update but not delete", () => {
    // Consumers may view (GET) and change settings (PATCH) but must not be able
    // to delete the endpoint itself — DELETE is intentionally not exported, so
    // Next.js returns 405.
    expect(typeof route.GET).toBe("function");
    expect(typeof route.PATCH).toBe("function");
    expect((route as Record<string, unknown>).DELETE).toBeUndefined();
  });
});
