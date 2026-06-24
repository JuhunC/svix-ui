/**
 * Typed view of the subset of the svix-server REST API (`/api/v1`) that the UI
 * uses. Field names mirror the Svix OpenAPI schema (camelCase in JSON).
 */

export type Ordering = "ascending" | "descending";

export interface ListOptions {
  limit?: number;
  iterator?: string;
  order?: Ordering;
}

/** Cursor-paginated envelope returned by every list endpoint. */
export interface ListResponse<T> {
  data: T[];
  iterator: string | null;
  prevIterator?: string | null;
  done: boolean;
}

// --- Application ---------------------------------------------------------

export interface Application {
  id: string;
  uid?: string | null;
  name: string;
  rateLimit?: number | null;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationIn {
  name: string;
  uid?: string;
  rateLimit?: number;
  metadata?: Record<string, string>;
}

// --- Endpoint ------------------------------------------------------------

export interface Endpoint {
  id: string;
  uid?: string | null;
  url: string;
  version?: number;
  description?: string;
  disabled?: boolean;
  filterTypes?: string[] | null;
  channels?: string[] | null;
  rateLimit?: number | null;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface EndpointIn {
  url: string;
  description?: string;
  disabled?: boolean;
  filterTypes?: string[];
  channels?: string[];
  rateLimit?: number;
  uid?: string;
  secret?: string;
  metadata?: Record<string, string>;
}

export type EndpointPatch = Partial<EndpointIn>;

export interface EndpointSecret {
  key: string;
}

export interface EndpointHeaders {
  headers: Record<string, string>;
  sensitive?: string[];
}

export interface EndpointStats {
  success: number;
  pending: number;
  sending: number;
  fail: number;
}

export interface EndpointTransformation {
  enabled?: boolean;
  code?: string | null;
}

// --- Event type ----------------------------------------------------------

export interface EventType {
  name: string;
  description: string;
  schemas?: Record<string, unknown> | null;
  archived?: boolean;
  deprecated?: boolean;
  featureFlags?: string[];
  groupName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventTypeIn {
  name: string;
  description: string;
  schemas?: Record<string, unknown>;
  archived?: boolean;
  deprecated?: boolean;
  featureFlags?: string[];
  groupName?: string;
}

export type EventTypePatch = Partial<Omit<EventTypeIn, "name">>;

// --- Message -------------------------------------------------------------

export interface Message {
  id: string;
  eventType: string;
  eventId?: string | null;
  channels?: string[] | null;
  payload: Record<string, unknown>;
  tags?: string[];
  timestamp: string;
}

export interface MessageIn {
  eventType: string;
  payload: Record<string, unknown>;
  eventId?: string;
  channels?: string[];
  tags?: string[];
  payloadRetentionPeriod?: number;
}

export type MessageStatus = "success" | "pending" | "fail" | "sending";

export interface MessageAttempt {
  id: string;
  msgId: string;
  endpointId: string;
  url: string;
  response: string;
  responseStatusCode: number;
  responseDurationMs?: number;
  status: number; // 0 success, 1 pending, 2 fail, 3 sending
  triggerType: number; // 0 scheduled, 1 manual
  timestamp: string;
}

// --- App portal access ---------------------------------------------------

export type AppPortalCapability =
  | "ViewBase"
  | "ViewEndpointSecret"
  | "ManageEndpointSecret"
  | "ManageTransformations"
  | "CreateAttempts"
  | "ManageEndpoint";

export interface AppPortalAccessIn {
  expiry?: number;
  readOnly?: boolean;
  capabilities?: AppPortalCapability[];
  sessionId?: string;
}

export interface AppPortalAccessOut {
  url: string;
  token: string;
}

// --- Health --------------------------------------------------------------

export interface HealthStatus {
  ok: boolean;
  status: number;
}
