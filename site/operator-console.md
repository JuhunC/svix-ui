---
title: Operator console
layout: default
nav_order: 4
---

# Operator console
{: .no_toc }

The operator console is the administrative side of svix-ui, reachable at
`/console` after signing in. It uses the privileged admin token and can see
every tenant.

1. TOC
{:toc}

---

## Signing in

Navigate to svix-ui and sign in with `SVIX_UI_OPERATOR_USERNAME` /
`SVIX_UI_OPERATOR_PASSWORD`. A signed session cookie keeps you logged in for 8
hours. Use **Sign out** in the top bar to end the session early.

## Applications

An **application** is a single tenant — typically one of your customers. Each
application owns its own endpoints, messages, and delivery history.

- **Create** — *Applications → New application*. Give it a name and, optionally,
  a **UID**: a stable identifier you control (e.g. `cust_acme`) that can be used
  in place of the generated `app_…` id.
- **Open** an application to manage its endpoints, generate a portal link, and
  reach its deliveries.
- **Delete** removes the application and all of its endpoints and messages.

## Event types

*Event types* is the catalog of events your applications can emit (for example
`invoice.paid` or `user.created`). Consumers subscribe their endpoints to the
event types they care about.

- **Create** — name (letters, numbers, `.`, `_`, `-`), a description, and an
  optional **JSON Schema** describing the payload (stored as schema version 1).
- **Edit** an event type to update its description or schema, or mark it
  **Deprecated** or **Archived**.
- Archived types are hidden from the default catalog but remain valid for
  already-sent messages.

{: .tip }
Defining schemas is optional but recommended — they document the payload shape
for the consumers who build against your webhooks.

## Endpoints

Open an application to manage its **endpoints** — the URLs Svix delivers to.

- **Add endpoint** — an HTTPS URL and an optional description.
- Open an endpoint to:
  - **Enable / disable** delivery.
  - **Reveal** and **rotate** the signing secret (`whsec_…`). On rotation the
    old secret stays valid for 24 hours so receivers can roll over without
    downtime.
  - Set **subscriptions** — deliver *all* event types, or only a selected list.
  - Manage **custom headers** sent with every delivery to that endpoint.
  - See **recent deliveries** and **recover** failed messages from the last
    1h / 24h.

See [Verifying webhooks](verifying-webhooks) for what receivers do with the
signing secret and headers.

## Deliveries

From an application, click **View deliveries** to open the delivery explorer.

- **Messages** — every message sent to the application, newest first, with its
  event type and id.
- **Send test message** — pick an event type, provide a JSON payload, and send
  it to exercise your endpoints.
- Open a message to see its **payload** and every **delivery attempt** — target
  endpoint, status (Succeeded / Pending / Failed / Sending), HTTP response code,
  and duration.
- **Resend** re-delivers a message to a specific endpoint. Use it after fixing a
  receiver that was returning errors.

## Replaying and recovering

Two complementary tools recover from receiver outages:

- **Resend** (per attempt) — re-deliver one message to one endpoint.
- **Recover** (per endpoint) — re-queue *all* failed messages for an endpoint
  over a time window (last 1h or 24h), from the endpoint's *Recent deliveries*
  panel.

## Consumer App Portal links

Each application page has a **Create portal link** action. It mints a
self-service link your customer can open to manage their own endpoints. This is
covered in detail in the [Consumer App Portal](app-portal) guide.
