---
title: Configuration
layout: default
nav_order: 3
---

# Configuration
{: .no_toc }

svix-ui is configured entirely through environment variables. Configuration is
validated on first use, so a missing or malformed value produces a clear error
at sign-in rather than a silent failure.

1. TOC
{:toc}

---

## Environment variables

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `SVIX_SERVER_URL` | ✅ | — | Base URL of the upstream `svix-server`, e.g. `http://svix-server:8071` inside Compose, or `http://localhost:8071` locally. |
| `SVIX_ADMIN_TOKEN` | ✅ | — | Privileged admin JWT used by the server-side BFF. Generate with `svix-server jwt generate`. **Never exposed to browsers.** |
| `SVIX_UI_SESSION_SECRET` | ✅ | — | Secret used to sign operator session cookies and seal portal sessions. Use ≥ 16 chars; 32 random bytes recommended (`openssl rand -hex 32`). |
| `SVIX_UI_OPERATOR_USERNAME` | ✅ | — | Username for the operator console login. |
| `SVIX_UI_OPERATOR_PASSWORD` | ✅ | — | Password for the operator console login (constant-time compared). |
| `SVIX_UI_PUBLIC_URL` | ⛔️ | request origin | Public origin of svix-ui, used to build consumer App Portal magic links. Set this when behind a reverse proxy. |
| `SVIX_UI_COOKIE_SECURE` | ⛔️ | auto | Force the `Secure` flag on cookies. Default mirrors the connection (Secure over HTTPS / `X-Forwarded-Proto: https`, not over plain HTTP). Set `true` to always require HTTPS, `false` to never set Secure. |

{: .note }
In the sample `.env.example`, `SVIX_UI_OPERATOR_USERNAME` defaults to `admin`
and `SVIX_UI_OPERATOR_PASSWORD` to `change-me` for convenience — both should be
overridden outside local trials.

## Generating the admin token

```bash
# Against a Compose stack:
docker compose exec -T svix-server svix-server jwt generate | awk '{print $NF}'

# Against a standalone container:
docker exec <svix-server-container> svix-server jwt generate | awk '{print $NF}'
```

The token is signed with the server's `SVIX_JWT_SECRET`. If you rotate
`SVIX_JWT_SECRET`, previously minted tokens stop working and you must mint a new
`SVIX_ADMIN_TOKEN`.

## Generating the session secret

```bash
openssl rand -hex 32
```

The session secret protects two things:

- **Operator sessions** — an HMAC-signed cookie proves you logged in. No
  server-side session store is needed.
- **Portal sessions** — the app-scoped token handed to a consumer is sealed
  inside an HMAC-signed cookie so it cannot be forged or retargeted at another
  application.

{: .warning }
Changing `SVIX_UI_SESSION_SECRET` invalidates all existing operator logins and
all outstanding App Portal links. Generate it once per deployment and keep it
stable.

## Setting the public URL

`SVIX_UI_PUBLIC_URL` is used to build portal magic links
(`{public-url}/portal/launch?...`). If unset, svix-ui falls back to the origin of
the incoming request, which is usually correct for direct access but wrong
behind a proxy that terminates TLS. Set it to the externally reachable origin,
e.g. `https://hooks.example.com`.

## A complete `.env`

```bash
# Upstream svix-server
SVIX_SERVER_URL=http://svix-server:8071
SVIX_ADMIN_TOKEN=eyJhbGciOi...        # from: svix-server jwt generate

# svix-ui session + operator login
SVIX_UI_SESSION_SECRET=8f3c...        # from: openssl rand -hex 32
SVIX_UI_OPERATOR_USERNAME=admin
SVIX_UI_OPERATOR_PASSWORD=a-strong-password

# Public origin (for portal links)
SVIX_UI_PUBLIC_URL=https://hooks.example.com
```

See [`.env.example`](https://github.com/JuhunC/svix-ui/blob/main/.env.example)
in the repository for the canonical, commented template.
