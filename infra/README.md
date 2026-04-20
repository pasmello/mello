# Infrastructure

This directory is the source of truth for everything outside application
code: dev-compose, Terraform provisioning, CF Workers, and maintenance scripts.

## Layout

- `compose.dev.yml` — local Postgres + MinIO for `make dev`
- `terraform/` — Cloudflare (zones, R2, Pages, edge rules, DNS) + Fly.io app reservation
- `workers/cdn-analytics/` — CF Worker fronting `cdn.pasmello.com` (logs downloads to Analytics Engine)
- `scripts/` — cron jobs (analytics batch, retention)

## Provisioning notes

- **Cloudflare** — zone `pasmello.com`, subdomains `market`, `registry`, `cdn`, `get`.
  R2 bucket `mello-packages-prod` fronted by `cdn.pasmello.com` via the CF Worker.
  Edge rate-limit rules for:
    - anon 60 req/min per IP on `/v1/*`
    - `/v1/publish` 10 req/hour per IP
    - upload body cap 20 MB
- **Fly.io** — app `mello-api` in Tokyo `nrt`, 1 small VM, autoscaling to 3.
  Spending cap $25/mo (set in the Fly dashboard; not exposed by the Terraform provider).
- **Neon** — one project, one branch. Free-tier auto-suspend enabled.
- **Sentry** — organization `pasmello`, projects `mello-registry-api`, `mello-web`, `mello-cli`.
- **UptimeRobot / BetterStack** — configured out-of-band per the day-1 guardrails.

## Billing alerts (out-of-band in each provider)

- Cloudflare account: notifications at $20 / $50 / $100
- Fly.io account: hard spending cap, alert at 75% of cap
- Neon: free-tier auto-suspend

Document any out-of-band changes in this README as they're made.
