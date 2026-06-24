# svix-ui — an open-source web UI for self-hosted Svix Webhooks

> **Status:** Planning / pre-implementation. This repository currently holds the
> design and research that the build will be driven from. See [`docs/`](docs/).

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

## Repository layout (planned)

```
svix-ui/
├── README.md                ← you are here
├── docs/
│   ├── RESEARCH.md          ← verified deep-dive on every Svix feature
│   ├── PLAN.md              ← architecture, tech stack, container image, roadmap
│   └── USE-CASES.md         ← end-to-end use-case scenarios for both personas
├── apps/
│   ├── web/                 ← React frontend (Operator Console + Consumer Portal)
│   └── bff/                 ← backend-for-frontend (holds the admin JWT)
├── packages/
│   └── svix-client/         ← thin typed wrapper over the official svix SDK
├── Dockerfile               ← builds the single `svix-ui` image
└── docker-compose.example.yml  ← svix-server + svix-ui, ready to `up`
```

## Quick mental model

```
Your customer ─▶ Consumer App Portal ─┐
                                       ├─▶ svix-ui (BFF) ─▶ svix-server :8071 ─▶ Postgres + Redis
You (operator) ─▶ Operator Console  ──┘        (holds the admin JWT)
```

## Start here

- **What Svix can do:** [`docs/RESEARCH.md`](docs/RESEARCH.md)
- **How we'll build it:** [`docs/PLAN.md`](docs/PLAN.md)
- **What it feels like to use:** [`docs/USE-CASES.md`](docs/USE-CASES.md)

## License

MIT — matching the upstream `svix-server`. "Svix" is a trademark of Svix, Inc.;
this is an independent community project and the published package will use a
neutral name (e.g. `svix-ui` / "for Svix") rather than imply endorsement.
