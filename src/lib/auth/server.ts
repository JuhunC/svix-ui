import { cookies } from "next/headers";
import { loadServerConfig } from "@/lib/config";
import { verifySession, type SessionPayload } from "./session";

export const SESSION_COOKIE = "svix_ui_session";

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  };
}

/**
 * Reads and verifies the operator session from the request cookies. Returns
 * null when there is no valid session or when the server is misconfigured
 * (so callers redirect to /login rather than crash).
 */
export async function getOperatorSession(): Promise<SessionPayload | null> {
  let secret: string;
  try {
    secret = loadServerConfig().sessionSecret;
  } catch {
    return null;
  }
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySession(token, secret);
}
