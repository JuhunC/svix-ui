---
title: Deployment
layout: default
nav_order: 7
---

# Deployment
{: .no_toc }

1. TOC
{:toc}

---

## The container image

svix-ui is published as a multi-arch image (linux/amd64 + linux/arm64):

```
ghcr.io/juhunc/svix-ui:latest
```

It is a self-contained Next.js standalone server that listens on port `3000`,
runs as a non-root user, and includes a container healthcheck. Tags follow the
default branch (`latest`) and any `v*` release tags.

## Topology

```
            ┌────────────┐      ┌──────────────┐      ┌────────────┐
 browser ─▶ │  svix-ui   │ ─▶   │ svix-server  │ ─▶   │  Postgres  │
            │  :3000     │      │  :8071       │      │  + Redis   │
            └────────────┘      └──────────────┘      └────────────┘
```

- **svix-ui** is stateless — all state lives in `svix-server` (Postgres + Redis).
  You can run multiple replicas behind a load balancer; just give every replica
  the same `SVIX_UI_SESSION_SECRET` so sessions and portal links are portable.
- **svix-server** is reached over the private network at `SVIX_SERVER_URL`.
  svix-ui should be the only thing that needs the admin token.

## Compose deployment

The sample
[`docker-compose.yml`](https://github.com/JuhunC/svix-ui/blob/main/docker-compose.yml)
runs everything. For production, switch the `svix-ui` service from `build: .` to
the published image:

```yaml
  svix-ui:
    image: ghcr.io/juhunc/svix-ui:latest
    # ...environment as in Getting started...
```

Provide secrets via an `.env` file or your orchestrator's secret store rather
than inline literals.

## Put TLS in front

svix-ui speaks plain HTTP on `3000`. Terminate TLS at a reverse proxy
(Caddy, nginx, Traefik, a cloud load balancer) and forward to svix-ui. Then:

- Set `SVIX_UI_PUBLIC_URL` to the external HTTPS origin so portal magic links
  use the right host.
- Forward the usual proxy headers (`X-Forwarded-Proto`, `X-Forwarded-Host`).

Example Caddy block:

```
hooks.example.com {
    reverse_proxy svix-ui:3000
}
```

## Production hardening

- **Strong secrets.** Set a random `SVIX_UI_SESSION_SECRET` (`openssl rand -hex
  32`), a strong `SVIX_UI_OPERATOR_PASSWORD`, and a strong server
  `SVIX_JWT_SECRET`. Never ship the `change-me` defaults.
- **Scope network access.** Keep `svix-server`, Postgres, and Redis on a private
  network; expose only svix-ui (behind TLS) and, if needed, the Svix ingest
  endpoint.
- **Back up Postgres.** It holds applications, endpoints, messages, and delivery
  history. Redis is the queue/cache and is less critical but should be durable.
- **Rotate the admin token** by rotating it in `svix-server` and updating
  `SVIX_ADMIN_TOKEN`; restart svix-ui to pick it up.

## Health checks

- **svix-ui** — `GET /login` returns `200` once the app is ready; the image's
  built-in `HEALTHCHECK` uses it.
- **svix-server** — `GET /api/v1/health` returns `2xx` when ready.

## Upgrading

Pull the new image and recreate the container:

```bash
docker compose pull svix-ui
docker compose up -d svix-ui
```

svix-ui carries no migrations of its own; upgrades are a simple image swap.
Upgrade `svix-server` independently following Svix's own release notes.
