---
title: Consumer App Portal
layout: default
nav_order: 5
---

# Consumer App Portal
{: .no_toc }

The App Portal is the self-service page your **customers** use to manage their
own webhook endpoints. It is the headline feature that the open-source
`svix-server` does not provide on its own.

1. TOC
{:toc}

---

## What the consumer can do

When a customer opens their portal link, they get a sidebar dashboard scoped to
a single application — *their* application — with **Endpoints**, **Activity**,
and **Event catalog** sections, mirroring the hosted Svix App Portal. From it
they can:

- **Endpoints** — add (with event-type selection from the catalog, channels,
  and advanced rate-limit/secret options), edit, enable/disable, and delete.
  Each endpoint has tabbed detail (Overview / Testing / Advanced / Activity)
  with a delivery **stats strip**.
- **Reveal** and **rotate** the endpoint **signing secret**.
- Choose **event-type subscriptions** (catalog-driven checkboxes) and
  **channels**; set a per-endpoint **rate limit** and **custom headers**.
- **Activity** — a filterable log of events (by event type, channel, time
  range). Open any message to see its **payload** and full **attempt history**:
  per-attempt response body, status code, duration, trigger, and **resend**.
- **Event catalog** — browse event types grouped by prefix, with JSON Schema
  and a generated **example payload**.
- **Recover** failed deliveries over a chosen time window (presets or custom
  since/until).

{: .note }
Two App Portal features depend on the svix-server build: **transformations** and
**send-test-event**. The open-source `svix-server` (tested 1.96.0) doesn't
support them, so svix-ui shows an explained "not supported" state rather than an
error.

They **cannot** see other tenants, your admin token, your event-type management,
or anything outside their application.

## How it works

1. In the operator console, open an application and click **Create portal
   link**. svix-ui asks `svix-server` for an **app-portal-access token** — a
   short-lived JWT scoped to that one application.
2. svix-ui returns a magic link of the form
   `https://your-svix-ui/portal/launch?token=…&app=…`.
3. You send that link to your customer.
4. When they open it, svix-ui moves the token out of the URL into a **sealed,
   httpOnly cookie** and redirects them to `/portal`. From then on, their
   browser never holds the raw token in the address bar, and the cookie is
   HMAC-signed so it cannot be forged or pointed at a different application.
5. Every action the customer takes is sent to svix-ui's backend, which calls
   `svix-server` using **the app-scoped token** — never the admin token.

```
operator: Create portal link ─▶ svix-ui ─▶ svix-server (mint app-scoped token)
                                   │
you ──────────────────── send link to customer
                                   ▼
customer opens link ─▶ /portal/launch ─▶ sealed cookie ─▶ /portal (self-service)
```

## Link lifetime

Portal links default to a **7-day** expiry. After it lapses, the customer sees a
"Link expired" page and you simply generate a new link. The expiry is encoded in
the link and enforced both by the sealed cookie and by the upstream token.

## Security model

- The **admin token stays server-side.** Consumers only ever receive an
  app-scoped token, and only inside a sealed cookie.
- The cookie is **httpOnly** (not readable by JavaScript) and **HMAC-signed**
  with `SVIX_UI_SESSION_SECRET`, binding the token to its application.
- Capabilities (what the token may do) are enforced **server-side by
  `svix-server`** — the portal UI surfaces controls, and unauthorized actions
  are rejected upstream.

{: .note }
Because the portal is served same-origin by svix-ui, there is no CORS to
configure and no token handling in client-side code — a meaningful simplification
over embedding a cross-origin dashboard.

## Sharing links safely

- Treat a portal link like a password: anyone with the link can manage that
  application's endpoints until it expires.
- Prefer sending links over a channel the customer already trusts (your
  authenticated dashboard, or a direct message), not a public page.
- Set `SVIX_UI_PUBLIC_URL` so generated links use your real external origin —
  see [Configuration](configuration.html#setting-the-public-url).
