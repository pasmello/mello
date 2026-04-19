# Infrastructure

This directory is the source of truth for everything outside application
code: dev-compose, Terraform provisioning, and maintenance scripts.

## Layout

- `compose.dev.yml` — local Postgres + MinIO for `make dev`
- `terraform/` — Cloudflare (zones, R2, Pages, edge rules) + Fly.io provisioning
- `scripts/` — Cron jobs (analytics batch, retention)

## Provisioning notes

- **Cloudflare** — zone `pasmello.dev`, subdomains `market`, `cdn`, `get`.
  R2 bucket `mello-packages` fronted by a custom domain on `cdn.pasmello.dev`.
  Edge rate-limit rules for:
    - anon 60 req/min per IP
    - authed 300 req/min per token (derived from the `Authorization` header)
    - `/v1/publish` 10 req/hour per user
    - upload body cap 50 MB
- **Fly.io** — app `mello-api` in `iad` by default, 1 small VM,
  autoscaling to 3.
- **Neon** — one project, one branch. Free-tier auto-suspend enabled.
- **Sentry / UptimeRobot / BetterStack** — configured out-of-band per the
  plan's day-1 guardrails.

## Billing alerts (out-of-band in each provider)

- Cloudflare account: notifications at $20 / $50 / $100
- Fly.io account: hard spending cap, alert at 75% of cap
- Neon: free-tier auto-suspend

Document any out-of-band changes in this README as they're made.
