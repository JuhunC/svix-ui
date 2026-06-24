import { describe, expect, it } from "vitest";
import { openPortalSession, sealPortalSession } from "./portal";

const SECRET = "portal-signing-secret-value";

describe("portal session sealing", () => {
  it("round-trips token and appId", () => {
    const sealed = sealPortalSession(
      { token: "sk_app", appId: "app_1", exp: Date.now() + 10000 },
      SECRET,
    );
    const opened = openPortalSession(sealed, SECRET);
    expect(opened?.token).toBe("sk_app");
    expect(opened?.appId).toBe("app_1");
  });

  it("rejects a different secret", () => {
    const sealed = sealPortalSession(
      { token: "sk_app", appId: "app_1", exp: Date.now() + 10000 },
      SECRET,
    );
    expect(openPortalSession(sealed, "other")).toBeNull();
  });

  it("rejects an expired session", () => {
    const sealed = sealPortalSession(
      { token: "sk_app", appId: "app_1", exp: Date.now() - 1 },
      SECRET,
    );
    expect(openPortalSession(sealed, SECRET)).toBeNull();
  });

  it("rejects tampering with the appId", () => {
    const sealed = sealPortalSession(
      { token: "sk_app", appId: "app_1", exp: Date.now() + 10000 },
      SECRET,
    );
    const [, sig] = sealed.split(".");
    const forged = Buffer.from(
      JSON.stringify({ token: "sk_app", appId: "app_evil", exp: Date.now() + 10000 }),
    ).toString("base64url");
    expect(openPortalSession(`${forged}.${sig}`, SECRET)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(openPortalSession(undefined, SECRET)).toBeNull();
    expect(openPortalSession("nope", SECRET)).toBeNull();
  });
});
