import { describe, expect, it } from "vitest";
import { verifyOperatorCredentials } from "./operator";

const cfg = { operatorUsername: "admin", operatorPassword: "hunter2" };

describe("verifyOperatorCredentials", () => {
  it("accepts correct credentials", () => {
    expect(verifyOperatorCredentials("admin", "hunter2", cfg)).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(verifyOperatorCredentials("admin", "nope", cfg)).toBe(false);
  });

  it("rejects a wrong username", () => {
    expect(verifyOperatorCredentials("root", "hunter2", cfg)).toBe(false);
  });

  it("rejects credentials of a different length without throwing", () => {
    expect(verifyOperatorCredentials("a", "b", cfg)).toBe(false);
    expect(verifyOperatorCredentials("", "", cfg)).toBe(false);
  });
});
