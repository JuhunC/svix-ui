---
title: Troubleshooting
layout: default
nav_order: 8
---

# Troubleshooting
{: .no_toc }

1. TOC
{:toc}

---

## "Invalid svix-ui configuration" on sign-in

A required environment variable is missing or malformed. The error lists the
offending fields. Check that all of `SVIX_SERVER_URL`, `SVIX_ADMIN_TOKEN`,
`SVIX_UI_SESSION_SECRET`, `SVIX_UI_OPERATOR_USERNAME`, and
`SVIX_UI_OPERATOR_PASSWORD` are set, that `SVIX_SERVER_URL` is a valid URL, and
that `SVIX_UI_SESSION_SECRET` is at least 16 characters. See
[Configuration](configuration).

## "Invalid username or password"

The credentials don't match `SVIX_UI_OPERATOR_USERNAME` /
`SVIX_UI_OPERATOR_PASSWORD`. Remember they are case-sensitive. If you changed
them, restart the container so the new values take effect.

## Pages load but every list shows an error

svix-ui can't reach `svix-server`, or the admin token is wrong.

- From the svix-ui container, confirm connectivity:
  `curl -s -o /dev/null -w '%{http_code}' $SVIX_SERVER_URL/api/v1/health` should
  print `200`.
- Inside Compose, `SVIX_SERVER_URL` must use the **service name**
  (`http://svix-server:8071`), not `localhost`.
- A `401`/"authentication failed" means `SVIX_ADMIN_TOKEN` is invalid — usually
  because the server's `SVIX_JWT_SECRET` changed. Mint a fresh token with
  `svix-server jwt generate` and update `SVIX_ADMIN_TOKEN`.

## "Invalid token" from svix-server

The admin token was signed with a different `SVIX_JWT_SECRET` than the server is
running with now. Regenerate it against the *current* server:

```bash
docker compose exec -T svix-server svix-server jwt generate | awk '{print $NF}'
```

## App Portal shows "Link expired"

Portal links are valid for 7 days. Generate a new link from the application's
page (**Create portal link**). Note that changing `SVIX_UI_SESSION_SECRET`
invalidates all outstanding links immediately, since the sealed cookie can no
longer be verified.

## Portal links point at the wrong host

If links use `localhost` or an internal hostname, set `SVIX_UI_PUBLIC_URL` to
your external origin (e.g. `https://hooks.example.com`) and make sure your proxy
forwards `X-Forwarded-Proto` / `X-Forwarded-Host`. See
[Deployment](deployment#put-tls-in-front).

## Test messages send but never deliver

The message is accepted and queued, but delivery depends on the receiving URL:

- Check the message's **attempts** — a `Failed` attempt shows the HTTP status
  the receiver returned.
- The receiver must answer with a `2xx`; anything else is a failure and is
  retried.
- A disabled endpoint won't receive anything — re-enable it from the endpoint
  page.
- Use **Resend** (per attempt) or **Recover** (per endpoint) after fixing the
  receiver.

## svix-server won't start

It needs Postgres and Redis reachable and healthy first. In the sample Compose
stack the dependencies have health checks; if you run svix-server standalone,
ensure `SVIX_DB_DSN` and `SVIX_REDIS_DSN` point at running services. Check logs:

```bash
docker compose logs svix-server
```

## Still stuck?

Open an issue at
[github.com/JuhunC/svix-ui/issues](https://github.com/JuhunC/svix-ui/issues)
with the svix-ui and svix-server logs and your (redacted) configuration.
