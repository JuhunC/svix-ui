import { describe, expect, it } from "vitest";
import {
  DEMO_SECRET,
  fromBase64,
  generateMsgId,
  hmacSha256,
  sha256,
  signPayload,
  toBase64,
  verifySignature,
} from "./sign";

const hex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const utf8 = (s: string) => new TextEncoder().encode(s);

describe("sha256", () => {
  it("matches known digests", () => {
    expect(hex(sha256(utf8("abc")))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(hex(sha256(utf8("")))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    // Multi-block input (>64 bytes).
    expect(
      hex(sha256(utf8("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"))),
    ).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });
});

describe("hmacSha256 (RFC 4231)", () => {
  it("test case 1", () => {
    const key = new Uint8Array(20).fill(0x0b);
    expect(hex(hmacSha256(key, utf8("Hi There")))).toBe(
      "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
    );
  });
  it("test case 2", () => {
    expect(hex(hmacSha256(utf8("Jefe"), utf8("what do ya want for nothing?")))).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });
  it("long key (hashed first)", () => {
    const key = new Uint8Array(131).fill(0xaa);
    expect(
      hex(hmacSha256(key, utf8("Test Using Larger Than Block-Size Key - Hash Key First"))),
    ).toBe("60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54");
  });
});

describe("base64", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 128, 64]);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
  it("matches Buffer's encoding", () => {
    const bytes = new Uint8Array(Buffer.from("hello svix webhooks!"));
    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
  it("rejects invalid input", () => {
    expect(() => fromBase64("not!!valid")).toThrow();
  });
});

describe("signPayload (official Svix docs vector)", () => {
  // From docs.svix.com/receiving/verifying-payloads/how-manual — also verified
  // against node:crypto.
  const msgId = "msg_p5jXN8AQM9LWM0D4loKWxJek";
  const timestamp = "1614265330";
  const payload = '{"test": 2432232314}';
  const expected = "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=";

  it("produces the documented signature", () => {
    expect(signPayload(DEMO_SECRET, msgId, timestamp, payload)).toBe(expected);
  });

  it("verifies the documented signature, including multi-signature headers", () => {
    expect(verifySignature(DEMO_SECRET, msgId, timestamp, payload, expected)).toBe(true);
    expect(
      verifySignature(
        DEMO_SECRET,
        msgId,
        timestamp,
        payload,
        `v1,bogus ${expected} v2,other`,
      ),
    ).toBe(true);
  });

  it("rejects tampering", () => {
    expect(
      verifySignature(DEMO_SECRET, msgId, timestamp, '{"test": 1}', expected),
    ).toBe(false);
    expect(verifySignature(DEMO_SECRET, "msg_other", timestamp, payload, expected)).toBe(false);
    expect(verifySignature(DEMO_SECRET, msgId, "1614265331", payload, expected)).toBe(false);
    expect(
      verifySignature("whsec_c2VjcmV0LXR3bw==", msgId, timestamp, payload, expected),
    ).toBe(false);
  });

  it("returns false (not throws) on malformed secrets", () => {
    expect(verifySignature("whsec_%%%", msgId, timestamp, payload, expected)).toBe(false);
    expect(verifySignature("", msgId, timestamp, payload, expected)).toBe(false);
  });
});

describe("generateMsgId", () => {
  it("makes unique msg_-prefixed ids", () => {
    const a = generateMsgId();
    const b = generateMsgId();
    expect(a).toMatch(/^msg_[0-9A-Za-z]{22}$/);
    expect(a).not.toBe(b);
  });
});
