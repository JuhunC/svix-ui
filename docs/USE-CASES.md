# svix-ui — use-case scenarios

> Concrete, end-to-end walkthroughs of what `svix-ui` feels like in use. Each
> scenario names the screen, the action, and the **exact API call** behind it
> (see [`RESEARCH.md`](RESEARCH.md) §2 for the resource model). Two personas:
> the **Operator** (you, running the platform) and the **Consumer** (your
> customer, receiving webhooks).

---

## The setting

*Acme Cloud* runs a SaaS and wants to offer webhooks to its customers. They
self-host Svix with `docker compose up` and add the `svix-ui` service. Today,
without `svix-ui`, every step below is a raw `curl` with a hand-pasted bearer
token. With `svix-ui`, it's a screen.

---

## Scenario 1 — Operator: stand up webhooks from zero

**Goal:** go from a fresh stack to a tenant that can receive `invoice.paid`.

1. **Bootstrap.** `docker compose up`; operator runs
   `docker compose exec backend svix-server jwt generate`, pastes the token into
   `SVIX_ADMIN_TOKEN`, restarts `svix-ui`, opens `http://localhost:3000`, logs in.
2. **Author event types.** *Event Types → New.* They define `invoice.paid` and
   `invoice.payment_failed`, pasting a JSON Schema (Draft 7) into the Monaco
   editor for each. The Event Catalog preview renders the schema + an example.
   → `POST /api/v1/event-type` (`name`, `description`, `schemas`).
   *Bonus:* they click **Import from OpenAPI** to bulk-create from their existing
   spec. → `POST /api/v1/event-type/import/openapi`.
3. **Create a tenant.** *Applications → New* → "Beta Customer Inc."
   → `POST /api/v1/app` (`name`, `uid: "cust_beta"`).
4. **Smoke test.** From the app's *Send test message*, they fire a sample
   `invoice.paid`. → `POST /api/v1/app/cust_beta/msg` (`eventType`, `payload`).
   The delivery explorer shows the message and (no endpoints yet) zero attempts.
5. **Invite the customer.** *Generate App Portal link* → the BFF calls
   `POST /api/v1/auth/app-portal-access/cust_beta` with capabilities
   `[ViewBase, ManageEndpoint, ViewEndpointSecret, CreateAttempts]`, and `svix-ui`
   produces a magic link. They send it to the customer.

**Outcome:** in minutes, no `curl`, the operator has a typed event catalog, a
tenant, and a self-service link.

---

## Scenario 2 — Consumer: self-serve an endpoint (the headline flow)

**Goal:** the customer wires up their receiver without ever talking to Acme support.

1. **Open the portal.** The customer clicks the magic link → the **Consumer App
   Portal**, scoped to *only* their application (the app-scoped token; the admin
   token never leaves Acme's server).
2. **Add an endpoint.** *Add Endpoint* → paste
   `https://hooks.beta-customer.com/svix`, write a description.
   → `POST /api/v1/app/cust_beta/endpoint` (`url`).
3. **Grab the signing secret.** The endpoint detail shows `whsec_…` (because the
   link granted `ViewEndpointSecret`). They copy it into their verifier.
   → `GET .../endpoint/{id}/secret`. The UI shows the snippet: HMAC-SHA256 over
   `` `{svix-id}.{svix-timestamp}.{body}` ``, 5-minute tolerance.
4. **Subscribe to events.** *Subscriptions* → instead of "all events," they tick
   only `invoice.paid` and `invoice.payment_failed` from the catalog.
   → `PATCH .../endpoint/{id}` (`filterTypes`).
5. **Test before going live.** *Testing → Send example* with `invoice.paid`.
   → `POST .../endpoint/{id}/send-example`. The attempt appears instantly with a
   `200` and a 120 ms duration. Green check. They're confident it works.

**Outcome:** the customer is self-served end-to-end. This screen is the thing
the OSS server cannot give you — it's the open-source App Portal.

---

## Scenario 3 — Consumer: debug a failing delivery

**Goal:** a customer's receiver had a bad deploy; they need to see and recover.

1. **See the failures.** *Message Log* shows recent `invoice.paid` messages; three
   are red. → `GET .../endpoint/{id}/msg`, `.../attempt/endpoint/{id}`.
2. **Inspect one.** Click a failed attempt: full **request payload**, the
   **response status** (`500`), the **response body**, and duration — the exact
   thing you'd otherwise reconstruct from logs.
   → `GET .../msg/{id}/attempt/{attempt_id}`.
3. **They fix their deploy**, then **Recover**. *Endpoint options → Recover failed
   messages → last 2 hours.* → `POST .../endpoint/{id}/recover` (`since`).
   All three turn green on the next attempt.
4. **Or a single one:** *Resend* on a specific attempt →
   `POST .../msg/{m}/endpoint/{e}/resend`.

The UI also explains the retry schedule it already attempted
(`immediately → 5s → 5m → 30m → 2h → …`, configurable) so the customer
understands what Svix did automatically before they intervened.

---

## Scenario 4 — Operator: triage a tenant outage across the fleet

**Goal:** an alert says deliveries are backing up; the operator investigates.

1. **Ops panel.** *Health* shows `svix-server` healthy but the queue gauges
   (`svix.queue.depth_main`, `…depth_dlq`) climbing — surfaced from OTLP if a
   collector is wired, with graceful "metrics not configured" otherwise.
   → `GET /api/v1/health`.
2. **Find the culprit.** *Global Delivery Explorer*, filter by status = failing.
   One tenant's endpoint is erroring `503` across the board.
   → `GET .../attempt/endpoint/{id}`.
3. **Check auto-disable risk.** The endpoint card shows it's been failing for
   18h — `svix-ui` warns it will auto-disable at the 5-day mark
   (`endpoint.disabled` op-webhook) unless recovered.
4. **Bulk replay after the customer fixes it.** *Replay missing since 09:00.*
   → `POST .../endpoint/{id}/replay-missing` (`since`).
5. **Rotate a leaked secret** if needed: *Endpoint → Rotate secret*; the UI notes
   the old secret stays valid 24h (dual-signed) so the customer has a migration
   window. → `POST .../endpoint/{id}/secret/rotate`.

---

## Scenario 5 — Consumer: reshape the payload without code (transformations)

**Goal:** the customer's legacy receiver expects a different JSON shape and a
custom header — they can't change their endpoint, so they transform on the way out.

1. *Endpoint → Transformations* (visible because the link granted
   `ManageTransformations`). A Monaco editor shows the `handler(webhook)` stub.
2. They write JS that renames fields and sets
   `webhook.headers["X-Acme-Source"] = "svix"`, leaving `eventType`/`env`
   read-only. → `PATCH .../endpoint/{id}/transformation` (`code`, `enabled`).
3. **Test the transform** in the built-in harness against a sample event before
   enabling it, then **Send example** to confirm the live shape.
   → `POST .../endpoint/{id}/send-example`.

---

## Scenario 6 — Consumer: a read-only auditor

**Goal:** the customer's security team wants to *see* deliveries but change nothing.

- The operator generates a portal link with `readOnly: true` and capabilities
  `[ViewBase]` only. → `POST /api/v1/auth/app-portal-access/{id}`
  (`readOnly: true`, `capabilities: [ViewBase]`).
- The portal renders logs and the catalog but **hides every mutating control** —
  enforced both in the UI and re-checked at the BFF before any proxied write.

---

## Scenario 7 — Consumer: pull instead of push (polling)

**Goal:** the customer is behind a firewall and can't expose an inbound URL.

- The operator enables a **polling endpoint** for the app; the portal shows the
  poller URL and a `sk_poll…` token plus copy-paste consumer code.
  → `GET /api/v1/app/{app}/poller/{poller_id}` returns `{ data, iterator, done }`.
- The portal explains **Consumer IDs** (server remembers the cursor) and `seek`
  (jump by `after` timestamp) so the customer resumes cleanly after downtime.

---

## What these scenarios prove

| Persona | Without `svix-ui` | With `svix-ui` |
|---|---|---|
| Operator | `curl` + hand-minted JWT for every app, event type, replay | a console; tenants, catalog, fleet-wide delivery explorer, bulk recovery |
| Consumer | **nothing** — no UI exists in OSS; the operator proxies every change | a self-service App Portal: endpoints, secrets, subscriptions, testing, logs, replay, transforms |

The recurring thread: **every action maps to an existing `svix-server` API call.**
`svix-ui` invents no new backend behavior — it makes the headless engine usable,
which is exactly the capability the open-source distribution is missing.
