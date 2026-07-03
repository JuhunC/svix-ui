/** Client-side helpers for talking to the BFF (`/api/...`). */

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Abort a hung request (e.g. svix-server unreachable) instead of leaving the UI
// stuck on a spinner forever.
const TIMEOUT_MS = 30_000;

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function messageOf(body: unknown, status: number): string {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error?: unknown }).error;
    if (typeof e === "string") return e;
  }
  return `Request failed (${status})`;
}

/**
 * An expired/missing session makes the BFF return 401. A fresh navigation would
 * be redirected by the server layout guards; mirror that for client fetches so
 * the user lands on re-auth instead of a silently broken page.
 */
function handleUnauthorized(): void {
  if (typeof window === "undefined") return;
  const onPortal = window.location.pathname.startsWith("/portal");
  const target = onPortal ? "/portal/expired" : "/login";
  if (window.location.pathname !== target) window.location.assign(target);
}

/**
 * Wraps fetch with a timeout, network-error normalization (a rejected fetch is
 * turned into an ApiError with actionable copy), and 401 → re-auth handling.
 */
async function request(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(path, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new ApiError(
        0,
        "The server took too long to respond — is svix-server reachable?",
      );
    }
    throw new ApiError(0, "Couldn't reach the server — is svix-server running?");
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401) handleUnauthorized();
  return res;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await request(path, { headers: { accept: "application/json" } });
  const body = await parse(res);
  if (!res.ok) throw new ApiError(res.status, messageOf(body, res.status));
  return body as T;
}

export async function apiSend<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await request(path, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const parsed = await parse(res);
  if (!res.ok) throw new ApiError(res.status, messageOf(parsed, res.status));
  return parsed as T;
}
