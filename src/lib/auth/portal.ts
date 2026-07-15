import crypto from "node:crypto";

/**
 * Encrypted cookie for a consumer App Portal session. It carries the
 * short-lived, app-scoped Svix access token (from app-portal-access), the app
 * id, and — for a per-endpoint link — the single endpoint it is limited to.
 *
 * The cookie is AES-256-GCM ENCRYPTED (not merely signed): a scoped consumer
 * owns this cookie, so if the token were only signed they could read it out and
 * re-launch with app-wide scope. Encryption keeps the token confidential and
 * the payload tamper-proof.
 */
export interface PortalSession {
  token: string;
  appId: string;
  exp: number; // epoch millis
  /**
   * When present, this session was opened from a per-endpoint portal link and
   * is restricted to this single endpoint — the BFF (withPortal) refuses any
   * other endpoint's data. Absent for app-wide (operator-shared) links.
   */
  endpointId?: string;
}

const IV_LEN = 12;
const TAG_LEN = 16;

function scopeKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

/** AES-256-GCM encrypt → base64url(iv || ciphertext || tag). */
function gcmEncrypt(plaintext: Buffer, secret: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", scopeKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString("base64url");
}

/** Inverse of gcmEncrypt; returns null on any tampering or malformed input. */
function gcmDecrypt(blob: string | undefined | null, secret: string): Buffer | null {
  if (!blob) return null;
  let raw: Buffer;
  try {
    raw = Buffer.from(blob, "base64url");
  } catch {
    return null;
  }
  if (raw.length <= IV_LEN + TAG_LEN) return null;
  const iv = raw.subarray(0, IV_LEN);
  const tag = raw.subarray(raw.length - TAG_LEN);
  const ciphertext = raw.subarray(IV_LEN, raw.length - TAG_LEN);
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", scopeKey(secret), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    return null;
  }
}

export function sealPortalSession(session: PortalSession, secret: string): string {
  return gcmEncrypt(Buffer.from(JSON.stringify(session), "utf8"), secret);
}

export function openPortalSession(
  cookie: string | undefined | null,
  secret: string,
  now: number = Date.now(),
): PortalSession | null {
  const buf = gcmDecrypt(cookie, secret);
  if (!buf) return null;

  let session: PortalSession;
  try {
    session = JSON.parse(buf.toString("utf8"));
  } catch {
    return null;
  }
  if (
    typeof session.token !== "string" ||
    typeof session.appId !== "string" ||
    typeof session.exp !== "number" ||
    session.exp < now
  ) {
    return null;
  }
  if (session.endpointId !== undefined && typeof session.endpointId !== "string") {
    return null;
  }
  return session;
}

/**
 * Encrypted launch payload for a per-endpoint portal link. The token is
 * AES-256-GCM encrypted so a consumer cannot read it, strip the endpoint
 * restriction, and re-launch with app-wide scope. It can only be replayed whole
 * to /portal/launch, which always yields an endpoint-scoped session.
 */
export interface LaunchScope {
  token: string;
  appId: string;
  endpointId: string;
  exp: number; // epoch millis
}

export function encryptLaunchScope(scope: LaunchScope, secret: string): string {
  return gcmEncrypt(
    Buffer.from(
      JSON.stringify({ t: scope.token, a: scope.appId, e: scope.endpointId, x: scope.exp }),
      "utf8",
    ),
    secret,
  );
}

export function decryptLaunchScope(
  blob: string | undefined | null,
  secret: string,
  now: number = Date.now(),
): LaunchScope | null {
  const buf = gcmDecrypt(blob, secret);
  if (!buf) return null;
  try {
    const obj = JSON.parse(buf.toString("utf8"));
    if (
      typeof obj.t !== "string" ||
      typeof obj.a !== "string" ||
      typeof obj.e !== "string" ||
      typeof obj.x !== "number" ||
      obj.x < now
    ) {
      return null;
    }
    return { token: obj.t, appId: obj.a, endpointId: obj.e, exp: obj.x };
  } catch {
    return null;
  }
}
