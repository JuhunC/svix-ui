import crypto from "node:crypto";

/**
 * Stateless, HMAC-signed session tokens for the operator console. Format:
 *   base64url(payloadJson) "." base64url(hmacSha256(payloadJson, secret))
 *
 * No external dependency, no server-side store — verification is a constant-time
 * MAC check plus an expiry check.
 */

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

export interface SessionPayload {
  sub: string;
  role: "operator";
  exp: number; // epoch millis
}

function sign(body: string, secret: string): Buffer {
  return crypto.createHmac("sha256", secret).update(body).digest();
}

export function signSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const mac = sign(body, secret).toString("base64url");
  return `${body}.${mac}`;
}

export function verifySession(
  token: string | undefined | null,
  secret: string,
  now: number = Date.now(),
): SessionPayload | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const macStr = token.slice(dot + 1);

  let provided: Buffer;
  try {
    provided = Buffer.from(macStr, "base64url");
  } catch {
    return null;
  }
  const expected = sign(body, secret);
  if (provided.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(provided, expected)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (payload.role !== "operator") return null;
  if (typeof payload.exp !== "number" || payload.exp < now) return null;
  if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;
  return payload;
}

export function createOperatorSession(
  username: string,
  secret: string,
  ttlMs: number = DEFAULT_TTL_MS,
  now: number = Date.now(),
): string {
  return signSession(
    { sub: username, role: "operator", exp: now + ttlMs },
    secret,
  );
}
