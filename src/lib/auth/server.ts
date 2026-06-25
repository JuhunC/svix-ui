import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { loadServerConfig } from "@/lib/config";
import { verifySession, type SessionPayload } from "./session";

export const SESSION_COOKIE = "svix_ui_session";

/**
 * Whether to mark cookies `Secure`. A `Secure` cookie is dropped by browsers
 * over plain HTTP (except on localhost), which would silently break login on an
 * HTTP deployment. So we mirror the actual connection: HTTPS (directly or via a
 * proxy's `X-Forwarded-Proto`) → secure; plain HTTP → not secure. Override with
 * `SVIX_UI_COOKIE_SECURE=true|false`.
 */
export function isRequestSecure(req: NextRequest): boolean {
  const override = process.env.SVIX_UI_COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true" || override === "1") return true;
  if (override === "false" || override === "0") return false;

  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  return req.nextUrl.protocol === "https:";
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
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
