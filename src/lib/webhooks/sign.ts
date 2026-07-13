/**
 * Pure-TS Svix webhook signing/verification for the interactive guide.
 *
 * Runs entirely in the browser. Deliberately does NOT use WebCrypto:
 * crypto.subtle is unavailable in non-secure contexts (plain-HTTP deploys on
 * private networks — a supported way to run svix-ui), and the guide's
 * playground must work there too.
 *
 * Scheme (docs.svix.com/receiving/verifying-payloads/how-manual):
 *   signedContent = `${msgId}.${timestamp}.${payload}`
 *   signature     = "v1," + base64(HMAC-SHA256(base64decode(secret sans "whsec_"), signedContent))
 */

// --- SHA-256 ---------------------------------------------------------------

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function sha256(message: Uint8Array): Uint8Array {
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];

  // Pad: append 0x80, zeros, then the 64-bit big-endian bit length.
  const len = message.length;
  const bitLenHi = Math.floor(len / 0x20000000);
  const bitLenLo = (len << 3) >>> 0;
  const padded = new Uint8Array((((len + 8) >> 6) + 1) << 6);
  padded.set(message);
  padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, bitLenHi);
  dv.setUint32(padded.length - 4, bitLenLo);

  const w = new Array<number>(64);
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e;
      e = (d + t1) >>> 0;
      d = c; c = b; b = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outDv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outDv.setUint32(i * 4, H[i]);
  return out;
}

// --- HMAC-SHA256 -------------------------------------------------------------

export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const BLOCK = 64;
  const k = key.length > BLOCK ? sha256(key) : key;
  const ipad = new Uint8Array(BLOCK + message.length);
  const opad = new Uint8Array(BLOCK + 32);
  for (let i = 0; i < BLOCK; i++) {
    const b = i < k.length ? k[i] : 0;
    ipad[i] = b ^ 0x36;
    opad[i] = b ^ 0x5c;
  }
  ipad.set(message, BLOCK);
  opad.set(sha256(ipad), BLOCK);
  return sha256(opad);
}

// --- base64 ------------------------------------------------------------------

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < bytes.length ? B64[b2 & 63] : "=";
  }
  return out;
}

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[\s=]+$/g, "");
  if (!/^[A-Za-z0-9+/]*$/.test(clean)) throw new Error("invalid base64");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]) << 18) |
      (B64.indexOf(clean[i + 1] ?? "A") << 12) |
      (B64.indexOf(clean[i + 2] ?? "A") << 6) |
      B64.indexOf(clean[i + 3] ?? "A");
    if (o < out.length) out[o++] = (n >> 16) & 0xff;
    if (o < out.length) out[o++] = (n >> 8) & 0xff;
    if (o < out.length) out[o++] = n & 0xff;
  }
  return out;
}

// --- Svix signing --------------------------------------------------------------

const utf8 = (s: string) => new TextEncoder().encode(s);

/** Decode a `whsec_…` signing secret to key bytes. Throws on malformed input. */
export function decodeSecret(secret: string): Uint8Array {
  const body = secret.trim().replace(/^whsec_/, "");
  if (!body) throw new Error("empty secret");
  return fromBase64(body);
}

/** Compute the `v1,<base64>` signature for one delivery. */
export function signPayload(
  secret: string,
  msgId: string,
  timestamp: string | number,
  payload: string,
): string {
  const key = decodeSecret(secret);
  const signed = hmacSha256(key, utf8(`${msgId}.${timestamp}.${payload}`));
  return `v1,${toBase64(signed)}`;
}

/**
 * Check a raw `svix-signature` header (space-delimited `v<n>,<sig>` list)
 * against the expected v1 signature. Comparison is constant-time per
 * candidate.
 */
export function verifySignature(
  secret: string,
  msgId: string,
  timestamp: string | number,
  payload: string,
  signatureHeader: string,
): boolean {
  let expected: string;
  try {
    expected = signPayload(secret, msgId, timestamp, payload);
  } catch {
    return false;
  }
  return signatureHeader
    .trim()
    .split(/\s+/)
    .some((candidate) => constantTimeEqual(candidate, expected));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Random sample message ID for the playground (not a real KSUID). */
export function generateMsgId(): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const bytes = new Uint8Array(22);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let id = "msg_";
  for (const b of bytes) id += alphabet[b % alphabet.length];
  return id;
}

/** The demo secret used across the Svix docs — safe to prefill in the guide. */
export const DEMO_SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
