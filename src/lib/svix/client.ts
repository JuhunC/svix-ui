import { SvixApiError, SvixConfigError } from "./errors";
import type {
  Application,
  ApplicationIn,
  AppPortalAccessIn,
  AppPortalAccessOut,
  Endpoint,
  EndpointHeaders,
  EndpointIn,
  EndpointPatch,
  EndpointSecret,
  EndpointStats,
  EndpointTransformation,
  EventType,
  EventTypeIn,
  EventTypePatch,
  HealthStatus,
  ListOptions,
  ListQuery,
  ListResponse,
  Message,
  MessageAttempt,
  MessageIn,
} from "./types";

export interface SvixClientOptions {
  serverUrl: string;
  token: string;
  /** Injectable fetch for testing; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

interface RequestInitEx {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

const API = "/api/v1";

function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `idem_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

/**
 * Thin, typed REST client for a self-hosted svix-server.
 *
 * It intentionally takes an explicit `serverUrl` — the official SDKs infer the
 * URL from the token prefix and fall back to Svix Cloud, which would silently
 * bypass a self-hosted server.
 */
export class SvixClient {
  private readonly serverUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: SvixClientOptions) {
    if (!opts.serverUrl) throw new SvixConfigError("serverUrl is required");
    if (!opts.token) throw new SvixConfigError("token is required");
    this.serverUrl = opts.serverUrl.replace(/\/+$/, "");
    this.token = opts.token;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private buildUrl(
    path: string,
    query?: RequestInitEx["query"],
  ): string {
    const url = new URL(this.serverUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== "") {
          url.searchParams.set(k, String(v));
        }
      }
    }
    return url.toString();
  }

  private async request<T>(
    method: string,
    path: string,
    init: RequestInitEx = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.token}`,
      accept: "application/json",
    };
    if (init.body !== undefined) headers["content-type"] = "application/json";
    if (init.idempotencyKey) headers["idempotency-key"] = init.idempotencyKey;

    const res = await this.fetchImpl(this.buildUrl(path, init.query), {
      method,
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    });

    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      throw new SvixApiError({
        status: res.status,
        message: extractMessage(parsed, res.status),
        code: extractCode(parsed),
        retryAfter: parseRetryAfter(res.headers.get("retry-after")),
        body: parsed,
      });
    }

    return parsed as T;
  }

  // --- Health ------------------------------------------------------------

  async health(): Promise<HealthStatus> {
    try {
      await this.request<void>("GET", `${API}/health`);
      return { ok: true, status: 200 };
    } catch (err) {
      if (err instanceof SvixApiError) return { ok: false, status: err.status };
      throw err;
    }
  }

  // --- Applications ------------------------------------------------------

  listApplications(opts: ListOptions = {}): Promise<ListResponse<Application>> {
    return this.request("GET", `${API}/app`, { query: { ...opts } });
  }

  createApplication(
    data: ApplicationIn,
    idempotencyKey = newIdempotencyKey(),
  ): Promise<Application> {
    return this.request("POST", `${API}/app`, { body: data, idempotencyKey });
  }

  getApplication(appId: string): Promise<Application> {
    return this.request("GET", `${API}/app/${enc(appId)}`);
  }

  updateApplication(appId: string, data: ApplicationIn): Promise<Application> {
    return this.request("PUT", `${API}/app/${enc(appId)}`, { body: data });
  }

  deleteApplication(appId: string): Promise<void> {
    return this.request("DELETE", `${API}/app/${enc(appId)}`);
  }

  // --- Endpoints ---------------------------------------------------------

  listEndpoints(
    appId: string,
    opts: ListOptions = {},
  ): Promise<ListResponse<Endpoint>> {
    return this.request("GET", `${API}/app/${enc(appId)}/endpoint`, {
      query: { ...opts },
    });
  }

  createEndpoint(
    appId: string,
    data: EndpointIn,
    idempotencyKey = newIdempotencyKey(),
  ): Promise<Endpoint> {
    return this.request("POST", `${API}/app/${enc(appId)}/endpoint`, {
      body: data,
      idempotencyKey,
    });
  }

  getEndpoint(appId: string, endpointId: string): Promise<Endpoint> {
    return this.request(
      "GET",
      `${API}/app/${enc(appId)}/endpoint/${enc(endpointId)}`,
    );
  }

  updateEndpoint(
    appId: string,
    endpointId: string,
    data: EndpointPatch,
  ): Promise<Endpoint> {
    return this.request(
      "PATCH",
      `${API}/app/${enc(appId)}/endpoint/${enc(endpointId)}`,
      { body: data },
    );
  }

  deleteEndpoint(appId: string, endpointId: string): Promise<void> {
    return this.request(
      "DELETE",
      `${API}/app/${enc(appId)}/endpoint/${enc(endpointId)}`,
    );
  }

  getEndpointSecret(
    appId: string,
    endpointId: string,
  ): Promise<EndpointSecret> {
    return this.request(
      "GET",
      `${API}/app/${enc(appId)}/endpoint/${enc(endpointId)}/secret`,
    );
  }

  rotateEndpointSecret(
    appId: string,
    endpointId: string,
    key?: string,
    idempotencyKey = newIdempotencyKey(),
  ): Promise<void> {
    return this.request(
      "POST",
      `${API}/app/${enc(appId)}/endpoint/${enc(endpointId)}/secret/rotate`,
      { body: { key: key ?? null }, idempotencyKey },
    );
  }

  getEndpointHeaders(
    appId: string,
    endpointId: string,
  ): Promise<EndpointHeaders> {
    return this.request(
      "GET",
      `${API}/app/${enc(appId)}/endpoint/${enc(endpointId)}/headers`,
    );
  }

  updateEndpointHeaders(
    appId: string,
    endpointId: string,
    headers: Record<string, string>,
  ): Promise<void> {
    return this.request(
      "PATCH",
      `${API}/app/${enc(appId)}/endpoint/${enc(endpointId)}/headers`,
      { body: { headers } },
    );
  }

  getEndpointStats(appId: string, endpointId: string): Promise<EndpointStats> {
    return this.request(
      "GET",
      `${API}/app/${enc(appId)}/endpoint/${enc(endpointId)}/stats`,
    );
  }

  recoverEndpoint(
    appId: string,
    endpointId: string,
    since: string,
    until?: string,
    idempotencyKey = newIdempotencyKey(),
  ): Promise<{ id?: string; status?: string; task?: string }> {
    return this.request(
      "POST",
      `${API}/app/${enc(appId)}/endpoint/${enc(endpointId)}/recover`,
      { body: until ? { since, until } : { since }, idempotencyKey },
    );
  }

  getEndpointTransformation(
    appId: string,
    endpointId: string,
  ): Promise<EndpointTransformation> {
    return this.request(
      "GET",
      `${API}/app/${enc(appId)}/endpoint/${enc(endpointId)}/transformation`,
    );
  }

  setEndpointTransformation(
    appId: string,
    endpointId: string,
    data: EndpointTransformation,
  ): Promise<void> {
    return this.request(
      "PATCH",
      `${API}/app/${enc(appId)}/endpoint/${enc(endpointId)}/transformation`,
      { body: data },
    );
  }

  sendExample(
    appId: string,
    endpointId: string,
    eventType: string,
    idempotencyKey = newIdempotencyKey(),
  ): Promise<MessageAttempt> {
    return this.request(
      "POST",
      `${API}/app/${enc(appId)}/endpoint/${enc(endpointId)}/send-example`,
      { body: { eventType }, idempotencyKey },
    );
  }

  // --- Event types -------------------------------------------------------

  listEventTypes(
    opts: ListOptions & { includeArchived?: boolean; withContent?: boolean } = {},
  ): Promise<ListResponse<EventType>> {
    const { includeArchived, withContent, ...rest } = opts;
    return this.request("GET", `${API}/event-type`, {
      query: {
        ...rest,
        include_archived: includeArchived,
        with_content: withContent,
      },
    });
  }

  createEventType(
    data: EventTypeIn,
    idempotencyKey = newIdempotencyKey(),
  ): Promise<EventType> {
    return this.request("POST", `${API}/event-type`, {
      body: data,
      idempotencyKey,
    });
  }

  getEventType(name: string): Promise<EventType> {
    return this.request("GET", `${API}/event-type/${enc(name)}`);
  }

  updateEventType(name: string, data: EventTypePatch): Promise<EventType> {
    return this.request("PUT", `${API}/event-type/${enc(name)}`, {
      body: data,
    });
  }

  /**
   * Deletes an event type. By default Svix soft-deletes (archives) it; pass
   * `expunge` to permanently remove the record.
   */
  deleteEventType(name: string, expunge = false): Promise<void> {
    return this.request("DELETE", `${API}/event-type/${enc(name)}`, {
      query: { expunge: expunge ? true : undefined },
    });
  }

  // --- Messages ----------------------------------------------------------

  listMessages(
    appId: string,
    opts: ListQuery = {},
  ): Promise<ListResponse<Message>> {
    const { eventTypes, channel, before, after, tag, ...rest } = opts;
    return this.request("GET", `${API}/app/${enc(appId)}/msg`, {
      query: {
        limit: rest.limit,
        iterator: rest.iterator,
        event_types: eventTypes?.join(","),
        channel,
        before,
        after,
        tag,
      },
    });
  }

  createMessage(
    appId: string,
    data: MessageIn,
    idempotencyKey = newIdempotencyKey(),
  ): Promise<Message> {
    return this.request("POST", `${API}/app/${enc(appId)}/msg`, {
      body: data,
      idempotencyKey,
    });
  }

  getMessage(appId: string, msgId: string): Promise<Message> {
    return this.request("GET", `${API}/app/${enc(appId)}/msg/${enc(msgId)}`);
  }

  // --- Message attempts --------------------------------------------------

  listAttemptsByMessage(
    appId: string,
    msgId: string,
    opts: ListQuery = {},
  ): Promise<ListResponse<MessageAttempt>> {
    return this.request(
      "GET",
      `${API}/app/${enc(appId)}/attempt/msg/${enc(msgId)}`,
      { query: attemptQuery(opts) },
    );
  }

  listAttemptsByEndpoint(
    appId: string,
    endpointId: string,
    opts: ListQuery = {},
  ): Promise<ListResponse<MessageAttempt>> {
    return this.request(
      "GET",
      `${API}/app/${enc(appId)}/attempt/endpoint/${enc(endpointId)}`,
      { query: attemptQuery(opts) },
    );
  }

  resendMessage(
    appId: string,
    msgId: string,
    endpointId: string,
    idempotencyKey = newIdempotencyKey(),
  ): Promise<void> {
    return this.request(
      "POST",
      `${API}/app/${enc(appId)}/msg/${enc(msgId)}/endpoint/${enc(endpointId)}/resend`,
      { idempotencyKey },
    );
  }

  // --- App portal access -------------------------------------------------

  appPortalAccess(
    appId: string,
    data: AppPortalAccessIn = {},
    idempotencyKey = newIdempotencyKey(),
  ): Promise<AppPortalAccessOut> {
    return this.request(
      "POST",
      `${API}/auth/app-portal-access/${enc(appId)}`,
      { body: data, idempotencyKey },
    );
  }
}

function enc(segment: string): string {
  return encodeURIComponent(segment);
}

function attemptQuery(
  opts: ListQuery,
): Record<string, string | number | boolean | undefined> {
  return {
    limit: opts.limit,
    iterator: opts.iterator,
    status: opts.status,
    status_code_class: opts.statusCodeClass,
    channel: opts.channel,
    event_types: opts.eventTypes?.join(","),
    before: opts.before,
    after: opts.after,
    with_content: opts.withContent,
  };
}

function extractMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.detail === "string") return b.detail;
    if (Array.isArray(b.detail) && b.detail.length > 0) {
      const first = b.detail[0] as { msg?: string };
      if (first?.msg) return first.msg;
    }
    if (typeof b.message === "string") return b.message;
  }
  if (typeof body === "string" && body) return body;
  return `Request failed with status ${status}`;
}

function extractCode(body: unknown): string | undefined {
  if (body && typeof body === "object") {
    const code = (body as Record<string, unknown>).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
