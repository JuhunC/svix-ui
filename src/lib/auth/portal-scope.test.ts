import { describe, expect, it } from "vitest";
import {
  decryptLaunchScope,
  encryptLaunchScope,
  openPortalSession,
  sealPortalSession,
} from "./portal";

const SECRET = "0123456789abcdef0123456789abcdef";

describe("encryptLaunchScope / decryptLaunchScope", () => {
  const scope = {
    token: "tok_app_scoped_secret",
    appId: "app_1",
    endpointId: "ep_1",
    exp: Date.now() + 60_000,
  };

  it("round-trips a scope", () => {
    const blob = encryptLaunchScope(scope, SECRET);
    expect(decryptLaunchScope(blob, SECRET)).toEqual(scope);
  });

  it("does not expose the token in plaintext (it is encrypted, not just signed)", () => {
    const blob = encryptLaunchScope(scope, SECRET);
    const decoded = Buffer.from(blob, "base64url").toString("latin1");
    expect(decoded).not.toContain(scope.token);
    expect(decoded).not.toContain("ep_1");
  });

  it("rejects a tampered blob (GCM auth tag)", () => {
    const blob = encryptLaunchScope(scope, SECRET);
    const bytes = Buffer.from(blob, "base64url");
    bytes[bytes.length - 1] ^= 0x01; // flip a tag bit
    expect(decryptLaunchScope(bytes.toString("base64url"), SECRET)).toBeNull();
  });

  it("rejects a blob sealed with a different secret", () => {
    const blob = encryptLaunchScope(scope, SECRET);
    expect(decryptLaunchScope(blob, "different-secret-different-secret")).toBeNull();
  });

  it("rejects an expired scope", () => {
    const blob = encryptLaunchScope({ ...scope, exp: Date.now() - 1 }, SECRET);
    expect(decryptLaunchScope(blob, SECRET)).toBeNull();
  });

  it("rejects garbage / empty input", () => {
    expect(decryptLaunchScope("", SECRET)).toBeNull();
    expect(decryptLaunchScope("!!!not-base64!!!", SECRET)).toBeNull();
    expect(decryptLaunchScope("aGVsbG8", SECRET)).toBeNull(); // too short
  });
});

describe("PortalSession carries an optional endpointId", () => {
  it("seals and opens the endpoint scope", () => {
    const sealed = sealPortalSession(
      { token: "t", appId: "app_1", endpointId: "ep_1", exp: Date.now() + 60_000 },
      SECRET,
    );
    expect(openPortalSession(sealed, SECRET)?.endpointId).toBe("ep_1");
  });

  it("app-wide sessions have no endpointId", () => {
    const sealed = sealPortalSession(
      { token: "t", appId: "app_1", exp: Date.now() + 60_000 },
      SECRET,
    );
    expect(openPortalSession(sealed, SECRET)?.endpointId).toBeUndefined();
  });

  it("ENCRYPTS the cookie — the token is not recoverable from it", () => {
    // A scoped consumer owns their cookie; if the token were merely signed they
    // could read it out and re-launch app-wide. It must be encrypted.
    const token = "eyJhbGciOiJIUzI1NiJ9.super-secret-app-token.sig";
    const sealed = sealPortalSession(
      { token, appId: "app_1", endpointId: "ep_1", exp: Date.now() + 60_000 },
      SECRET,
    );
    const decoded = Buffer.from(sealed, "base64url").toString("latin1");
    expect(decoded).not.toContain(token);
    expect(decoded).not.toContain("super-secret");
    expect(decoded).not.toContain("app_1");
    expect(decoded).not.toContain("ep_1");
  });

  it("rejects a tampered cookie (GCM integrity)", () => {
    const sealed = sealPortalSession(
      { token: "t", appId: "app_1", exp: Date.now() + 60_000 },
      SECRET,
    );
    const bytes = Buffer.from(sealed, "base64url");
    bytes[bytes.length - 1] ^= 0x01;
    expect(openPortalSession(bytes.toString("base64url"), SECRET)).toBeNull();
  });
});
