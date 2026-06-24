import crypto from "node:crypto";

/**
 * Sealed cookie for a consumer App Portal session. It carries the short-lived,
 * app-scoped Svix access token (returned by app-portal-access) plus the app id,
 * HMAC-signed with the server session secret so it cannot be forged.
 */
export interface PortalSession {
  token: string;
  appId: string;
  exp: number; // epoch millis
}

function mac(body: string, secret: string): Buffer {
  return crypto.createHmac("sha256", secret).update(body).digest();
}

export function sealPortalSession(session: PortalSession, secret: string): string {
  const body = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${body}.${mac(body, secret).toString("base64url")}`;
}

export function openPortalSession(
  cookie: string | undefined | null,
  secret: string,
  now: number = Date.now(),
): PortalSession | null {
  if (!cookie) return null;
  const dot = cookie.indexOf(".");
  if (dot <= 0) return null;
  const body = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);

  let provided: Buffer;
  try {
    provided = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  const expected = mac(body, secret);
  if (provided.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(provided, expected)) return null;

  let session: PortalSession;
  try {
    session = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
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
  return session;
}
