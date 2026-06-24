# Svix Webhooks — verified feature research

> Compiled from a multi-agent sweep of `github.com/svix/svix-webhooks`,
> `docs.svix.com`, and `standardwebhooks.com`, with the load-bearing claims
> adversarially re-verified. Confidence is noted where it matters. This is the
> reference the UI design ([`PLAN.md`](PLAN.md)) is built on.

---

## 0. The single most important fact

**The open-source `svix-server` ships no UI of any kind.** The repo's top-level
directories are exclusively backend / SDK / tooling. There is no `frontend/`,
`dashboard/`, or `ui/`. The App Portal is shipped separately as a **closed
Enterprise artifact** (`ghcr.io/svix/svix-app-portal-ee`) and served by Svix
Cloud at `app.svix.com`.

The OSS server *does* expose `POST /api/v1/auth/app-portal-access/{app_id}`,
which returns a valid `{ url, token }`. The `token` is a real, app-scoped,
browser-safe session token — but the `url` is a hardcoded placeholder
(`https://docs.svix.com/app-portal/oss`). **The OSS server hands you a session
token and no UI to render it.** Building that UI is the entire premise of
`svix-ui`. ✅ *Confirmed* (auth.rs placeholder; maintainer in discussion #575;
docs state the portal is "only included in the hosted version").

---

## 1. The self-hosted server: deploy & configure

- **Image:** `svix/svix-server` (Docker Hub), `latest` or versioned tags. Rust, **MIT-licensed**.
- **Port:** listens `0.0.0.0:8071`; API under `/api/v1`.
- **Backing services (required):** PostgreSQL (**postgres-only** for `SVIX_DB_DSN`) + Redis. The shipped `server/docker-compose.yml` also puts **PgBouncer** in front of Postgres.
- **Config:** a `config.toml`, or equivalently env vars = the config keys, **upper-cased and `SVIX_`-prefixed**.

| Env var | Default | Notes |
|---|---|---|
| `SVIX_JWT_SECRET` | *(must set)* | HS256 by default; signs API bearer tokens |
| `SVIX_DB_DSN` | `postgresql://postgres:postgres@pgbouncer/postgres` | **Postgres only** |
| `SVIX_REDIS_DSN` | `redis://redis:6379` | queue + optional cache |
| `SVIX_QUEUE_TYPE` | `redis` | `memory` / `redis` / `rediscluster` |
| `SVIX_CACHE_TYPE` | `memory` | `memory` / `redis` / `rediscluster` / `none` |
| `SVIX_LOG_LEVEL` | `info` | `info` / `debug` / `trace` |
| `SVIX_LISTEN_ADDRESS` | `0.0.0.0:8071` | |

- **Health:** `GET /api/v1/health` and `/api/v1/health/ping` (checks DB + queue + cache).
- **Auth bootstrap:** there is **no signup/login UI**. You mint a bearer JWT from the CLI:
  `svix-server jwt generate` (or for the operational-webhooks account,
  `svix-server jwt generate org_00000000000SvixManagement00`).
- **Scaling:** API and worker roles can be split (`api_enabled` vs `worker_enabled`); workers are Redis-Streams consumer groups.
- **Metrics:** OTLP **push-only** (no Prometheus scrape endpoint). Four gauges:
  `svix.queue.depth_main`, `svix.queue.pending_msgs`, `svix.queue.depth_delayed`, `svix.queue.depth_dlq`.
- **Retention:** default **90 days** (`payloadRetentionPeriod` days / `payloadRetentionHours`), enforced by an in-server pruner; CLI `prune`/`wipe` also exist.

---

## 2. The REST resource model (what every screen maps to)

Hierarchy: **Environment ▸ Application (a tenant/consumer) ▸ { Endpoints, Messages } ▸ Message Attempts.** Event Types are **environment-level**, not under an app.

### Application — `/api/v1/app`
`GET, POST /api/v1/app` · `GET, PUT, PATCH, DELETE /api/v1/app/{app_id}`
`ApplicationIn`: **`name`** (req), `uid`, `metadata`, `throttleRate` (`rateLimit` deprecated). List filters include `exclude_apps_with_no_endpoints`, `exclude_apps_with_disabled_endpoints`. `POST` supports `get_if_exists`.

### Endpoint — `/api/v1/app/{app_id}/endpoint`
`EndpointIn`: **`url`** (req), `channels`, `filterTypes`, `description`, `disabled`, `secret`, `throttleRate`, `uid`, `headers`, `metadata`, `version` (optional, **deprecated**, defaults to 1 — *not* server-managed; this corrects an earlier note). Sub-resources:

| Sub-resource | Method · Path | Body / returns |
|---|---|---|
| View secret | `GET .../endpoint/{id}/secret` | `{ key }` (`whsec_…`) |
| Rotate secret | `POST .../endpoint/{id}/secret/rotate` | `{ key }` (optional, else generated) |
| Headers | `GET, PUT, PATCH .../endpoint/{id}/headers` | `{ headers }`, out adds `sensitive[]` |
| Stats | `GET .../endpoint/{id}/stats` | `{ success, pending, sending, fail, canceled }` |
| Recover failed | `POST .../endpoint/{id}/recover` | `{ since*, until }` |
| Replay missing | `POST .../endpoint/{id}/replay-missing` | `{ since*, until }` |
| Transformation | `GET, PATCH .../endpoint/{id}/transformation` | JS `code`, `enabled` |

### Message — `/api/v1/app/{app_id}/msg`
`GET, POST /api/v1/app/{app_id}/msg` · `GET .../msg/{msg_id}` (immutable — no PUT/PATCH/DELETE; content removed via `DELETE .../msg/{msg_id}/content`).
`MessageIn`: **`eventType`** (req), **`payload`** (req JSON), `eventId`, `channels[]`, `tags[]`, `payloadRetentionPeriod`, `payloadRetentionHours`, `deliverAt` (scheduled), `transformationsParams`.

### Message Attempt (read-mostly)
`GET .../attempt/msg/{msg_id}` (by message) · `GET .../attempt/endpoint/{endpoint_id}` (by endpoint) · `GET .../msg/{msg_id}/attempt/{attempt_id}` (one).
**Resend a single delivery:** `POST .../msg/{msg_id}/endpoint/{endpoint_id}/resend`.
`MessageAttemptOut`: `id, msgId, endpointId, url, response, responseStatusCode, responseDurationMs, status, triggerType, timestamp`.

### Event Type — `/api/v1/event-type` (environment-level)
`GET, POST` · `GET, PUT, PATCH, DELETE /api/v1/event-type/{name}` · `POST /api/v1/event-type/import/openapi`.
`EventTypeIn`: **`name`** (req, the id), **`description`** (req), `schemas` (map of *version → JSONSchema Draft 7*), `archived`, `deprecated`, `featureFlags[]`, `groupName`. **Schemas are not enforced** at message-create (bad payloads are sent, not blocked).

### App Portal access — `POST /api/v1/auth/app-portal-access/{app_id}`
`AppPortalAccessIn`: `expiry` (seconds), `readOnly` (bool), `capabilities[]`, `featureFlags[]`, `sessionId`, optional inline `application`.
Capabilities enum: **`ViewBase`, `ViewEndpointSecret`, `ManageEndpointSecret`, `ManageTransformations`, `CreateAttempts`, `ManageEndpoint`**.
Returns `{ url, token }` — **the `token` is browser-safe and app-scoped.**

### Cross-cutting API conventions
- **Auth:** `Authorization: Bearer <JWT>`.
- **Pagination:** cursor-based — `limit` + `iterator` → `{ data, done, iterator, prevIterator }`. **Build cursor pagers, not page-number pagers.**
- **Idempotency:** optional `Idempotency-Key` header on POSTs (UUID; retained ~12h; replays the original response).
- **Rate limits:** `429` + `Retry-After`.
- **SDKs:** JS/TS (`svix`), Python, Rust, Go, Java, Kotlin, Ruby, C#/.NET, PHP, plus a CLI. UIDs may stand in for IDs on apps/endpoints.

---

## 3. Security & signing (Standard Webhooks)

- **Scheme:** HMAC-SHA256. Secret looks like `whsec_<base64>`; the HMAC key is the **base64-decoded** portion *after* `whsec_`.
- **Signed content:** `` `{svix-id}.{svix-timestamp}.{body}` `` (raw body). Identical to Standard Webhooks `msg_id.timestamp.payload`.
- **Headers sent to consumers:** `svix-id`, `svix-timestamp`, `svix-signature` (+ Standard-Webhooks aliases `webhook-id`, `webhook-timestamp`, `webhook-signature`, accepted interchangeably).
- **Signature value:** `v1,<base64-hmac>`; multiple signatures are **space-delimited** (`v1,… v1,…`) — a match against *any* passes.
- **Secret rotation:** old secret stays valid **24h**; during the window messages carry both old+new signatures → zero-downtime rotation.
- **Replay protection:** reject if `svix-timestamp` is more than **5 minutes (300s)** from now (past or future).
- **Per-endpoint custom headers**, HTTP Basic via `https://user:pass@host/...`, advanced auth (mTLS/OAuth) documented separately.
- **Static egress IPs** for firewall allowlisting are a **Pro/Enterprise** feature (not OSS).
- **Standard Webhooks** (Svix co-authored): also defines asymmetric **Ed25519** signing — secret `whsk_`, public key `whpk_`, scheme id `v1a`.

---

## 4. Reliability & delivery semantics

- **Default retry schedule — 8 attempts (each delay measured from the prior failure):**
  `immediately → 5s → 5m → 30m → 2h → 5h → 10h → 10h` (~24h window; **configurable** via `retry_schedule`).
- **Success = HTTP 2xx within ~15s.** Anything else (incl. 3xx) is a failure.
- **Exhaustion:** message marked **Failed** for that endpoint; account gets a `message.attempt.exhausted` operational webhook.
- **Auto-disable:** an endpoint failing for **5 days** is disabled (`endpoint.disabled` op-webhook); `endpoint_failure_disable_after` defaults to 120h. The 5-day clock starts only after multiple failures within 24h, ≥12h apart.
- **Manual re-delivery (three flavors):**
  - **Resend** — re-deliver one message immediately.
  - **Recover Failed** — re-deliver all failures in a time window (outage recovery).
  - **Replay** — re-deliver all failed messages since a timestamp; **Replay Missing** fills gaps.
- **Throttling:** `throttleRate` (msgs/sec) at app or endpoint level — excess is **delayed, not dropped**.
- **FIFO endpoints:** strict ordered delivery with head-of-line blocking; configurable batch size to recover throughput.
- **Operational webhooks** (about your own environment): `endpoint.disabled`, `message.attempt.exhausted`, `message.attempt.failing`, `message.attempt.recovered`.

---

## 5. Event types, filtering, transformations, polling

- **Event types** carry versioned **JSON Schema (Draft 7)** in `schemas`; the **Event Catalog** (schema + example) is auto-generated for the portal. `featureFlags` control *visibility only*, not deliverability.
- **Filtering** = `filterTypes` (subscribe to a subset of event types; empty = all) **plus** `channels` (case-sensitive free-form tags on both messages and endpoints). Rules: a channel-less endpoint is a catch-all; a message with no channel only reaches channel-less endpoints.
- **Transformations:** per-endpoint JavaScript `handler(webhook)` that may edit `payload`, `url`, `method` (POST/PUT), `headers`, or `cancel` the delivery. `eventType`/`env`/`transformationsParams` are read-only. Gated by an env-level "Enable Transformations" + endpoint `transformationsEnabled`.
- **Svix Ingest:** a push-to-pull gateway that verifies inbound provider webhooks (Stripe, GitHub, Shopify, …), fans out, transforms, and can expose a poller.
- **Polling endpoints (pull model):** `/api/v1/app/{app}/poller/{poller_id}` returns `{ data, iterator, done }`, auth `Bearer sk_poll…`. A **Consumer ID** lets the server remember the last cursor (resume without passing `iterator`); `seek` jumps by an `after` timestamp.

---

## 6. Integrating a UI with a self-hosted server (constraints)

These shape the architecture and are **non-negotiable**:

1. **`serverUrl` must be set explicitly.** SDKs infer the URL from the *token prefix*, which only resolves to Cloud regions or falls back to `https://api.svix.com`. Self-hosted calls **must** pass `serverUrl: 'http://svix-server:8071'` — otherwise the UI silently talks to Svix Cloud. ✅ *Confirmed.*
2. **The admin JWT is an org-scoped symmetric secret and must never reach the browser.** Only the short-lived, app-scoped `app-portal-access` token is browser-safe. → The Operator Console **requires a backend-for-frontend (BFF)** holding the JWT server-side. ✅ *Confirmed.*
3. **CORS configurability is unverified.** Don't assume arbitrary allowed-origins are configurable; plan to serve the UI/BFF **same-origin** or behind a reverse proxy. ⚠️ *De-risk against a running container early.*
4. **API-level `429` enforcement in OSS** (vs only the Cloud edge) is unverified. ⚠️
5. **Cloud-style success-rate "reports" are not confirmed in OSS.** Scope the ops dashboard to attempt records + endpoint `stats` + the four queue gauges. ⚠️

### Corrections from verification
- `Endpoint.version` is **client-settable & deprecated**, *not* server-managed — don't render it as read-only.
- The retry total is ~24–27.5h depending on counting; treat the schedule as **configurable** and avoid hard-coding "24h" in copy.
