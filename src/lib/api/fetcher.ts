/** Client-side helpers for talking to the BFF (`/api/...`). */

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  const body = await parse(res);
  if (!res.ok) throw new ApiError(res.status, messageOf(body, res.status));
  return body as T;
}

export async function apiSend<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const parsed = await parse(res);
  if (!res.ok) throw new ApiError(res.status, messageOf(parsed, res.status));
  return parsed as T;
}
