---
title: Getting started
layout: default
nav_order: 2
---

# Getting started
{: .no_toc }

1. TOC
{:toc}

---

## Prerequisites

- **Docker** and the **Docker Compose** plugin.
- A few free ports: `3000` (svix-ui), `8071` (svix-server), and internal
  Postgres/Redis.

That's it — the sample stack brings up `svix-server`, PostgreSQL, and Redis for
you. If you already run Svix, see [point svix-ui at an existing
server](#pointing-at-an-existing-svix-server).

## Run the full stack

The repository ships a sample
[`docker-compose.yml`](https://github.com/JuhunC/svix-ui/blob/main/docker-compose.yml)
that runs **svix-ui + svix-server + PostgreSQL + Redis**.

```bash
git clone https://github.com/JuhunC/svix-ui
cd svix-ui

# 1. Start the backend (svix-server needs Postgres + Redis).
SVIX_JWT_SECRET=change-me docker compose up -d postgres redis svix-server

# 2. Mint an admin token from the running server.
export SVIX_ADMIN_TOKEN=$(docker compose exec -T svix-server svix-server jwt generate | awk '{print $NF}')

# 3. Start the UI.
SVIX_JWT_SECRET=change-me \
SVIX_UI_SESSION_SECRET=$(openssl rand -hex 32) \
SVIX_UI_OPERATOR_PASSWORD=change-me \
docker compose up -d svix-ui
```

Open **<http://localhost:3000>** and sign in with:

- **Username:** `admin`
- **Password:** `change-me`

{: .warning }
`change-me` and `SVIX_JWT_SECRET=change-me` are for local trials only. For
anything reachable by others, set a strong operator password, a random
`SVIX_UI_SESSION_SECRET` (`openssl rand -hex 32`), and a strong
`SVIX_JWT_SECRET`. See [Deployment](deployment#production-hardening).

### What the `jwt generate` step does

`svix-server` has no sign-up flow. You mint a bearer token from the CLI; it is
signed with `SVIX_JWT_SECRET` and grants full API access. svix-ui holds this
token server-side as `SVIX_ADMIN_TOKEN` — it is never sent to a browser.

The command prints `Token (Bearer): <jwt>`; the `awk '{print $NF}'` above keeps
just the token.

## First steps in the console

Once signed in:

1. **Create an application** — each application is one tenant (one customer).
2. Open it and **add an endpoint** (any HTTPS URL that can receive a POST).
3. Optionally **define an event type** under *Event types* (e.g. `invoice.paid`).
4. Hit **Send test message** from the application's *Deliveries* page and watch
   the attempt appear, with its response status.

See the [Operator console guide](operator-console) for the full tour.

## Hand a customer the App Portal

On an application's page, click **Create portal link**. Copy the generated URL
and send it to your customer. When they open it, they get a self-service page to
manage *their* endpoints — without any access to your other tenants or your
admin token. See [Consumer App Portal](app-portal).

## Pointing at an existing svix-server

If you already operate a `svix-server`, you only need the `svix-ui` service.
Point it at your server and give it an admin token:

```bash
docker run -d --name svix-ui -p 3000:3000 \
  -e SVIX_SERVER_URL=http://your-svix-server:8071 \
  -e SVIX_ADMIN_TOKEN=<your admin jwt> \
  -e SVIX_UI_SESSION_SECRET=$(openssl rand -hex 32) \
  -e SVIX_UI_OPERATOR_USERNAME=admin \
  -e SVIX_UI_OPERATOR_PASSWORD='a-strong-password' \
  -e SVIX_UI_PUBLIC_URL=https://hooks.example.com \
  ghcr.io/juhunc/svix-ui:latest
```

Every variable is documented in [Configuration](configuration).
