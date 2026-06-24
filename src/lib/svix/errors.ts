/** Error thrown when the svix-server returns a non-2xx response. */
export class SvixApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfter?: number;
  readonly body?: unknown;

  constructor(params: {
    status: number;
    message: string;
    code?: string;
    retryAfter?: number;
    body?: unknown;
  }) {
    super(params.message);
    this.name = "SvixApiError";
    this.status = params.status;
    this.code = params.code;
    this.retryAfter = params.retryAfter;
    this.body = params.body;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

/** Error thrown when the client is constructed or invoked with bad config. */
export class SvixConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SvixConfigError";
  }
}
