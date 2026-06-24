import { describe, expect, it } from "vitest";
import {
  createOperatorSession,
  signSession,
  verifySession,
} from "./session";

const SECRET = "super-secret-session-key";

describe("session signing", () => {
  it("round-trips a valid session", () => {
    const token = createOperatorSession("admin", SECRET);
    const payload = verifySession(token, SECRET);
    expect(payload?.sub).toBe("admin");
    expect(payload?.role).toBe("operator");
  });

  it("rejects a token signed with a different secret", () => {
    const token = createOperatorSession("admin", SECRET);
    expect(verifySession(token, "other-secret")).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = createOperatorSession("admin", SECRET);
    const [, mac] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ sub: "root", role: "operator", exp: Date.now() + 10000 }),
    ).toString("base64url");
    expect(verifySession(`${forged}.${mac}`, SECRET)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signSession(
      { sub: "admin", role: "operator", exp: Date.now() - 1000 },
      SECRET,
    );
    expect(verifySession(token, SECRET)).toBeNull();
  });

  it("respects an explicit now for expiry", () => {
    const token = createOperatorSession("admin", SECRET, 1000, 0);
    expect(verifySession(token, SECRET, 500)).not.toBeNull();
    expect(verifySession(token, SECRET, 2000)).toBeNull();
  });

  it("rejects malformed and empty tokens", () => {
    expect(verifySession(undefined, SECRET)).toBeNull();
    expect(verifySession("", SECRET)).toBeNull();
    expect(verifySession("no-dot", SECRET)).toBeNull();
    expect(verifySession(".abc", SECRET)).toBeNull();
  });

  it("rejects a non-operator role", () => {
    const token = signSession(
      // @ts-expect-error deliberately wrong role
      { sub: "admin", role: "intruder", exp: Date.now() + 10000 },
      SECRET,
    );
    expect(verifySession(token, SECRET)).toBeNull();
  });
});
