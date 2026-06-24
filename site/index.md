---
title: Home
layout: default
nav_order: 1
description: "Open-source web UI for self-hosted Svix webhooks."
permalink: /
---

# svix-ui
{: .fs-9 }

A clean, open-source web UI for the **self-hosted** (open-source, MIT) Svix
webhooks server — shipped as a single container image that drops into your
existing Svix `docker-compose` stack.
{: .fs-6 .fw-300 }

[Get started](getting-started){: .btn .btn-primary .fs-5 .mb-4 .mb-md-0 .mr-2 }
[View on GitHub](https://github.com/JuhunC/svix-ui){: .btn .fs-5 .mb-4 .mb-md-0 }

---

## Why this exists

The open-source `svix-server` is **API-only**. The polished dashboard and the
embeddable **App Portal** that make Svix Cloud pleasant to use are not part of
the self-hosted image — self-hosters are left talking to the REST API by hand.

`svix-ui` fills that gap. It gives you two things the OSS server doesn't:

- **An operator console** — manage applications, event types, endpoints, and
  inspect/replay deliveries across every tenant.
- **A consumer App Portal** — a magic-link, self-service page your customers
  open to manage their own endpoints, signing secret, event subscriptions, and
  replays — without ever seeing your admin token.

## Who serves whom

```
Your customer ─▶ Consumer App Portal ─┐
                                       ├─▶ svix-ui (BFF) ─▶ svix-server :8071 ─▶ Postgres + Redis
You (operator) ─▶ Operator Console  ──┘     (holds the admin JWT)
```

The privileged admin token lives **only** inside svix-ui's server side. Browsers
in the operator console talk to a same-origin backend-for-frontend; consumers in
the portal only ever hold a short-lived, **app-scoped** token.

## Guides

| Guide | What it covers |
|---|---|
| [Getting started](getting-started) | Run the whole stack with Docker in a few minutes |
| [Configuration](configuration) | Every environment variable, explained |
| [Operator console](operator-console) | Applications, event types, endpoints, deliveries |
| [Consumer App Portal](app-portal) | Magic links, capabilities, what customers can do |
| [Verifying webhooks](verifying-webhooks) | Signatures, headers, and verification code |
| [Deployment](deployment) | Production topology, TLS, scaling, hardening |
| [Troubleshooting](troubleshooting) | Common errors and how to fix them |

---

{: .note }
svix-ui is an independent, MIT-licensed community project. "Svix" is a trademark
of Svix, Inc.; this project is not affiliated with or endorsed by Svix.
