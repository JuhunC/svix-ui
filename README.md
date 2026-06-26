# svix-ui — an open-source web UI for self-hosted Svix Webhooks

> **📖 User guides:** **<https://juhunc.github.io/svix-ui/>**
> · **Image:** `ghcr.io/juhunc/svix-ui:1.0.0` (`:latest`) · **License:** MIT
>
> Operator console + a consumer **App Portal** at feature/design parity with the
> hosted Svix dashboard — endpoints (events, channels, rate limit, secret,
> headers), a filterable Activity log with full attempt history, an event
> catalog, and recovery — all over the open-source `svix-server` API, shipped as
> a single container. See [Getting started](https://juhunc.github.io/svix-ui/getting-started.html).

## The one-paragraph pitch

The open-source [`svix-server`](https://github.com/svix/svix-webhooks) is the
*same Rust binary that powers Svix Cloud* — it ships the full webhook engine
(signing, retries, transformations, channels, polling) under a REST API on port
`8071`. What it **does not** ship is any web UI. The polished **App Portal** your
customers use, and the **admin dashboard** you use to operate the service, are
closed Svix-Cloud / Enterprise features. If you `docker compose up` the OSS
server, you get a headless API and a CLI — every endpoint, secret, and replay is
a `curl` command.

**`svix-ui` fills that gap.** It is a single container image you drop into your
existing Svix `docker-compose.yml` that gives you:

1. an **Operator Console** — create tenants (applications), author event types,
   mint tokens, and watch deliveries across every tenant; and
2. an embeddable, open-source **Consumer App Portal** — the screen your own
   customers use to add endpoints, grab their signing secret, pick which events
   they want, test, and replay failed messages.

Both talk to the unmodified `svix-server` over its REST API. No fork, no patch.

## Why this exists (the verified gap)

| Capability | OSS `svix-server` | Svix Cloud / EE | `svix-ui` |
|---|:---:|:---:|:---:|
| Webhook engine (signing, retries, transforms, polling) | ✅ | ✅ | uses it |
| REST API + CLI | ✅ | ✅ | uses it |
| Admin / operator dashboard | ❌ | ✅ | ✅ **adds it** |
| Consumer **App Portal** UI | ❌ (returns a placeholder URL) | ✅ | ✅ **adds it** |
| License | MIT | proprietary | MIT (this project) |

The OSS `POST /api/v1/auth/app-portal-access/{app_id}` call still works and
returns a real `{ url, token }` — but in OSS the `url` is a hardcoded placeholder
(`docs.svix.com/app-portal/oss`). As Svix's maintainer put it, *"getting the
token is still very valuable because you can build your own UI."* That is
precisely what this project does.

## Quick start (Docker)

The sample [`docker-compose.yml`](docker-compose.yml) runs the whole stack —
svix-ui + svix-server + PostgreSQL + Redis:

```bash
# 1. start the backend (svix-server needs Postgres + Redis)
SVIX_JWT_SECRET=change-me docker compose up -d postgres redis svix-server

# 2. mint an admin token from the running server
export SVIX_ADMIN_TOKEN=$(docker compose exec -T svix-server svix-server jwt generate | awk '{print $NF}')

# 3. start the UI
SVIX_JWT_SECRET=change-me \
SVIX_UI_SESSION_SECRET=$(openssl rand -hex 32) \
SVIX_UI_OPERATOR_PASSWORD=change-me \
docker compose up -d svix-ui

# 4. open http://localhost:3000 and sign in as admin / change-me
```

See [`.env.example`](.env.example) for every configuration variable.

## Repository layout

```
svix-ui/
├── docs/                    ← RESEARCH.md, PLAN.md, USE-CASES.md
├── src/
│   ├── app/
│   │   ├── console/         ← operator console (admin JWT, server-side only)
│   │   ├── portal/          ← consumer App Portal (app-scoped token)
│   │   └── api/             ← BFF route handlers (admin + portal)
│   ├── components/          ← React UI (Tailwind)
│   └── lib/
│       ├── svix/            ← typed REST client over svix-server
│       ├── auth/            ← HMAC sessions + sealed portal cookies
│       └── api/             ← BFF wrappers (withAdmin / withPortal)
├── tests/integration/       ← end-to-end checks against a real svix-server
├── Dockerfile               ← single multi-arch svix-ui image
└── docker-compose.yml       ← svix-ui + svix-server + Postgres + Redis
```

## Quick mental model

```
Your customer ─▶ Consumer App Portal ─┐
                                       ├─▶ svix-ui (BFF) ─▶ svix-server :8071 ─▶ Postgres + Redis
You (operator) ─▶ Operator Console  ──┘        (holds the admin JWT)
```

## Documentation

- **What Svix can do:** [`docs/RESEARCH.md`](docs/RESEARCH.md)
- **Architecture & roadmap:** [`docs/PLAN.md`](docs/PLAN.md)
- **Use-case walkthroughs:** [`docs/USE-CASES.md`](docs/USE-CASES.md)

## Development

```bash
npm install
npm run dev            # http://localhost:3000 (needs SVIX_SERVER_URL + token)
npm test               # unit + mocked-BFF tests
npm run test:integration   # against a real svix-server (set SVIX_SERVER_URL + SVIX_ADMIN_TOKEN)
npm run lint && npm run typecheck && npm run build
```

CI runs lint, typecheck, the test suite, a production build, and a job that
boots a real `svix-server` and runs the integration suite against it.

## License

MIT — matching the upstream `svix-server`. "Svix" is a trademark of Svix, Inc.;
this is an independent community project and the published package will use a
neutral name (e.g. `svix-ui` / "for Svix") rather than imply endorsement.
