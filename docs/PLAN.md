# svix-ui — implementation plan

> Read [`RESEARCH.md`](RESEARCH.md) first; this plan assumes its facts.
> Scope: a single container image, dropped into an existing Svix
> `docker-compose.yml`, that adds an **Operator Console** and an embeddable
> **Consumer App Portal** over the unmodified `svix-server` REST API.

---

## 1. Goals & non-goals

**Goals**
- One image, `docker compose up`, no fork of `svix-server`, no DB of our own (the BFF is stateless apart from a session/signing secret).
- Cover the daily workflows that are *only* possible via `curl` today: tenant/app management, event-type authoring, endpoint config, the message/attempt explorer, and manual replay/recover/resend.
- Ship an open-source re-implementation of the closed App Portal that your customers can use, embeddable via a magic link.
- Be safe by construction: the admin JWT never reaches a browser.

**Non-goals (v1)**
- Re-implementing the webhook engine — we are a UI over the API.
- Multi-region, billing, SSO/SCIM (leave hooks for later).
- Editing `svix-server` config from the UI (it's env/CLI-driven).
- A custom metrics backend — we surface `/health` + the four OTLP queue gauges if an OTel collector is wired up, and degrade gracefully if not.

---

## 2. Architecture

Two browser surfaces, one server process (the BFF), one upstream (`svix-server`).

```
┌─────────────────────────┐        ┌─────────────────────────┐
│   Operator Console SPA   │        │   Consumer App Portal    │
│  (you / the provider)    │        │   (your customer)        │
└────────────┬────────────┘        └────────────┬────────────┘
   session cookie (operator login)   magic-link → app-portal token (browser-safe)
             │                                    │
             ▼                                    ▼
        ┌──────────────────────────────────────────────┐
        │            svix-ui  BFF  (this image)          │
        │  • holds SVIX_ADMIN_TOKEN (org JWT) server-side│
        │  • exchanges operator session ↔ admin calls    │
        │  • mints app-portal-access tokens for portal   │
        │  • proxies/normalizes cursor pagination + CORS │
        │  • official `svix` SDK with explicit serverUrl │
        └───────────────────────┬──────────────────────┘
                                 │ Authorization: Bearer <JWT>
                                 ▼
                ┌────────────────────────────────┐
                │   svix-server  :8071  /api/v1   │  ← unmodified OSS image
                └───────────────┬────────────────┘
                                ▼
                     Postgres  +  Redis  (+ PgBouncer)
```

**Why a BFF is mandatory, not a style choice:** the org-scoped admin JWT can do
anything across all tenants and is signed with the symmetric `SVIX_JWT_SECRET`.
If it reached the browser, any customer could read every tenant. So:

- **Operator Console** → authenticates the human operator against the BFF (session cookie); the BFF attaches the admin token to upstream calls. The token is an env var, never sent to the client.
- **Consumer App Portal** → the BFF calls `app-portal-access/{app_id}` and hands the browser only the **short-lived, app-scoped** token. The portal SPA may call `svix-server` with that token directly (same-origin via the BFF proxy to avoid CORS surprises).

---

## 3. Tech stack (recommended)

| Concern | Choice | Why |
|---|---|---|
| Frontend + BFF | **Next.js (App Router, TypeScript)** | One image serves both the SPA and the server-side route handlers (the BFF). Server components keep the admin token off the client by default. |
| Upstream client | official **`svix` npm SDK**, `new Svix(token, { serverUrl })` | Don't hand-roll the API; the SDK already models every resource. `serverUrl` is set from env (see RESEARCH §6.1). |
| UI kit | **Tailwind + shadcn/ui + Radix** | Fast, accessible, themable (the portal needs white-label theming). |
| Data fetching | **TanStack Query** with a cursor-aware `infiniteQuery` | The API is `limit`+`iterator`; cursor pagers are first-class. |
| Forms / schema | **react-hook-form + Zod**; **Monaco** for JSON-Schema & transformation JS | Event-type schemas and the transformation `handler(webhook)` need real editors. |
| Auth (operator) | session cookie (iron-session / Auth.js credentials), pluggable to OIDC later | Keeps the admin token server-side. |
| Auth (consumer) | magic-link → `app-portal-access` token in an httpOnly cookie scoped to the portal route | Mirrors Svix Cloud's portal-link UX. |
| Tests | Vitest + Playwright; a compose-based integration test against a real `svix-server` | De-risks the unverified items (CORS, 429, portal-token parity) automatically. |

> If the team prefers a non-Node BFF (Go/Python), the split still holds — but the
> official SDKs all support `serverUrl`, and Next.js collapses two deploy units
> into one image, which matters for the "single container" requirement.

---

## 4. Screen ↔ API map

### 4a. Operator Console (admin JWT, via BFF)

| Screen | Primary endpoints |
|---|---|
| **Applications / tenants** list + create | `GET, POST /api/v1/app`; filters `exclude_apps_with_no_endpoints`, … |
| **Application detail** (endpoints, recent activity) | `GET /api/v1/app/{id}`, `GET .../endpoint`, `GET .../msg` |
| **Event-type registry** (author JSON Schema, OpenAPI import, deprecate/archive) | `GET, POST /api/v1/event-type`, `PUT/PATCH/DELETE .../{name}`, `POST .../import/openapi` |
| **Global delivery explorer** (any tenant) | `GET .../msg`, `.../msg/{id}`, `.../attempt/endpoint/{id}`, `.../attempt/msg/{id}` |
| **Resend / Recover / Replay** | `POST .../msg/{m}/endpoint/{e}/resend`, `.../endpoint/{id}/recover`, `.../endpoint/{id}/replay-missing` |
| **Send test message** | `POST /api/v1/app/{id}/msg` |
| **Tokens & portal links** | wrap CLI `jwt generate`; `POST /api/v1/auth/app-portal-access/{id}` |
| **Health / ops** | `GET /api/v1/health`; OTLP gauges `svix.queue.depth_main\|pending_msgs\|depth_delayed\|depth_dlq` |
| **Retention / prune** | `DELETE .../msg/{id}/content`; wrap CLI `prune`/`wipe` |

### 4b. Consumer App Portal (app-scoped token, browser-safe)

Gated by `app-portal-access` **capabilities** (`ViewBase`, `ViewEndpointSecret`,
`ManageEndpointSecret`, `ManageTransformations`, `CreateAttempts`,
`ManageEndpoint`) and the `readOnly` flag — the UI hides/disables controls per
the token's grant.

| Screen | Endpoints | Capability |
|---|---|---|
| **My endpoints** (add/edit/delete) | `GET/POST/PUT/PATCH/DELETE .../endpoint/...` | `ManageEndpoint` |
| **Signing secret** (view / rotate) | `GET .../endpoint/{id}/secret`, `POST .../secret/rotate` | `ViewEndpointSecret` / `ManageEndpointSecret` |
| **Subscriptions** (pick event types) | `filterTypes` on endpoint; `GET /event-type` for catalog | `ManageEndpoint` |
| **Channels** | `channels` on endpoint | `ManageEndpoint` |
| **Custom headers** | `GET/PUT/PATCH .../endpoint/{id}/headers` | `ManageEndpoint` |
| **Transformations** (JS editor) | `GET/PATCH .../endpoint/{id}/transformation` | `ManageTransformations` |
| **Testing tab** (send example) | `POST .../endpoint/{id}/send-example` | `CreateAttempts` |
| **Message & attempt logs** (payload, status, response, duration) | `GET .../endpoint/{id}/msg`, `.../attempt/endpoint/{id}`, `.../stats` | `ViewBase` |
| **Replay / recover own failures** | `.../resend`, `.../recover`, `.../replay-missing` | `CreateAttempts` |
| **Event Catalog** (schemas + examples) | `GET /api/v1/event-type` (`with_content`) | `ViewBase` |

---

## 5. The container image & docker-compose integration

The deliverable is **one image** (`ghcr.io/<org>/svix-ui:<tag>`, multi-arch
amd64+arm64), built from a multi-stage Dockerfile (build the Next.js standalone
output, run on a slim `node` base, non-root). It needs **no database** — its only
state is the operator session secret and the upstream token, both from env.

### Configuration (env)

| Env var | Required | Purpose |
|---|:---:|---|
| `SVIX_SERVER_URL` | ✅ | Upstream, e.g. `http://svix-server:8071` (the fix for RESEARCH §6.1) |
| `SVIX_ADMIN_TOKEN` | ✅ | Org JWT from `svix-server jwt generate`; **server-side only** |
| `SVIX_UI_SESSION_SECRET` | ✅ | Signs operator session + portal magic-link cookies |
| `SVIX_UI_OPERATOR_USERS` | ✅ (v1) | Bootstrap operator credentials (or point to OIDC) |
| `SVIX_UI_PUBLIC_URL` | ✅ | Public origin, for magic-link generation & same-origin proxying |
| `SVIX_UI_PORTAL_DEFAULT_CAPS` | – | Default `app-portal-access` capabilities for generated links |
| `SVIX_UI_THEME` / branding vars | – | White-label the consumer portal |

### Drop-in `docker-compose.example.yml`

```yaml
# Adds `svix-ui` to the stock Svix server compose. The svix-server,
# postgres, pgbouncer, and redis services below mirror server/docker-compose.yml.
services:
  svix-ui:
    image: ghcr.io/your-org/svix-ui:latest
    depends_on: [backend]
    environment:
      SVIX_SERVER_URL: http://backend:8071
      SVIX_ADMIN_TOKEN: ${SVIX_ADMIN_TOKEN}        # from: docker compose exec backend svix-server jwt generate
      SVIX_UI_SESSION_SECRET: ${SVIX_UI_SESSION_SECRET}
      SVIX_UI_OPERATOR_USERS: ${SVIX_UI_OPERATOR_USERS}
      SVIX_UI_PUBLIC_URL: http://localhost:3000
    ports: ["3000:3000"]

  backend:                                          # unchanged stock svix-server
    image: svix/svix-server
    environment:
      WAIT_FOR: "true"
      SVIX_REDIS_DSN: redis://redis:6379
      SVIX_DB_DSN: postgresql://postgres:postgres@pgbouncer/postgres
      SVIX_JWT_SECRET: ${SVIX_JWT_SECRET}
    ports: ["8071:8071"]
    depends_on: [pgbouncer, redis]

  pgbouncer:
    image: docker.io/edoburu/pgbouncer:v1.24.1-p1
    environment: { DB_HOST: postgres, AUTH_TYPE: trust, MAX_CLIENT_CONN: "500" }
    depends_on: [postgres]
  postgres:
    image: docker.io/postgres:13.4
    environment: { POSTGRES_PASSWORD: postgres }
    volumes: ["postgres-data:/var/lib/postgresql/data"]
  redis:
    image: docker.io/redis:7-alpine
    command: ["--save", "60", "500", "--appendonly", "yes"]
    volumes: ["redis-data:/data"]

volumes: { postgres-data: {}, redis-data: {} }
```

**First-run UX we will document:**
1. `docker compose up`
2. `docker compose exec backend svix-server jwt generate` → paste into `SVIX_ADMIN_TOKEN`, restart `svix-ui`.
3. Open `http://localhost:3000`, log in as operator, create your first application, generate a portal link, hand it to a customer.

> A future quality-of-life option: a one-time bootstrap mode where `svix-ui`
> shells `svix-server jwt generate` itself (if co-located) so step 2 disappears.

---

## 6. Security model

- **Token isolation:** admin token only in BFF process env; never serialized into HTML, server-component props, or client bundles. Lint rule + test to assert it.
- **Consumer scoping:** every portal request is bound to one `app_id` via the app-scoped token; the BFF refuses cross-app access even if a client forges an id.
- **Capability + readOnly enforcement happens twice:** UI hides controls *and* the BFF validates the token's capabilities before proxying mutations.
- **Same-origin by default:** serve portal API calls through the BFF (`/api/proxy/...`) so we never depend on `svix-server` CORS config (RESEARCH §6.3). Direct-to-server is an opt-in once CORS is verified.
- **Magic-link hygiene:** short expiry, single-session `sessionId`, httpOnly cookie, rotation on use.
- **Secrets display:** `whsec_…` revealed only with `ViewEndpointSecret`; rotation surfaces the 24h dual-signing window so customers know they have time to migrate.
- **Rate limits / idempotency:** BFF honors upstream `429`+`Retry-After` and attaches `Idempotency-Key` (UUID) to mutating POSTs.

---

## 7. Roadmap / milestones

| Milestone | Deliverable | De-risks |
|---|---|---|
| **M0 — Spike (1–2 days)** | BFF talks to a real `svix-server` via SDK + `serverUrl`; verify CORS behavior, `429`, and that an `app-portal-access` token authenticates against the OSS API. | The ⚠️ unverified items in RESEARCH §6. |
| **M1 — Operator MVP** | Operator login, app list/create, app detail, **delivery explorer** (messages + attempts with payload/response), send test message. | Core "stop curling" value. |
| **M2 — Replay & ops** | Resend / Recover / Replay-missing flows; health panel + queue gauges; retention/prune. | The daily operational loop. |
| **M3 — Event-type registry** | JSON-Schema (Monaco) authoring, OpenAPI import, deprecate/archive, Event Catalog. | Self-service event modeling. |
| **M4 — Consumer App Portal** | Magic-link issuance from console; endpoint CRUD, secret view/rotate, subscriptions, channels, custom headers, testing tab, logs, replay — all capability-gated. | **The headline feature.** |
| **M5 — Transformations & polish** | Transformation JS editor with test harness; white-label theming; i18n; read-only links. | Parity with Cloud portal. |
| **M6 — Release** | Multi-arch image to GHCR, signed (cosign) + SBOM; `docker-compose.example.yml`; docs site; versioned against `svix-server` API. | Adoption. |

---

## 8. Risks & open questions (carry into M0)

1. **CORS allowed-origins configurability** in OSS — unverified. *Mitigation:* same-origin BFF proxy by default.
2. **API-level `429`** in OSS vs Cloud-edge only — unverified. *Mitigation:* handle it defensively regardless.
3. **`app-portal-access` parity** — does the OSS-issued token grant the same capabilities our portal calls need? *Mitigation:* the M0 spike asserts each capability against a live container.
4. **Stats depth** — Cloud-style success-rate-over-time may not exist in OSS; scope dashboards to attempts + `stats` + queue gauges.
5. **API drift** — pin a tested `svix-server` version range; CI runs the integration suite against it.
6. **Naming/trademark** — publish under a neutral name; "for Svix," not "Svix UI" as a product claim.
