# mello

Independent plugin marketplace for [Pasmello](https://github.com/pasmello/pasmello).
Hosts shareable **tools**, **themes**, and **workflows** under a public
package registry with a web UI and a CLI package manager.

> ⚠️ Early scaffold. Not yet deployed.

## What this repo is

This is the mello service — the open-source infrastructure that powers the
Pasmello plugin ecosystem. It is **independent public infrastructure**: the
hosted pasmello SaaS, a self-built local pasmello, and the CLI are all equal
clients of this API.

- Registry API (Hono on Fly.io) — AGPL v3
- Marketplace web UI (SvelteKit static on Cloudflare Pages) — AGPL v3
- Admin / moderation tools — AGPL v3
- Rust CLI (`apps/cli/`) — Apache 2.0
- TS client packages (`packages/plugin-spec`, `packages/registry-client`) — Apache 2.0
- Package envelope + vendored Pasmello schemas (`spec/`) — Apache 2.0
- Infrastructure as code (Terraform, CF Worker, Neon migrations)

## What this repo is **not**

| Concern | Lives in |
|---|---|
| Pasmello web app | `pasmello` repo (MIT) |
| `@pasmello/plugin-spec` (Pasmello's plugin author ergonomics) | `pasmello` repo (MIT) |
| Hosted SaaS (sessions, LLM proxy, billing) | `pasmello-saas` repo (private, commercial) |

See [`LICENSING.md`](./LICENSING.md) for the full strategy.

## Deployment layout

- `registry.pasmello.com` → this repo's API (Hono on Fly.io, Tokyo `nrt`)
- `market.pasmello.com` → this repo's web UI (SvelteKit static on CF Pages)
- `cdn.pasmello.com` → R2 public bucket (package zip downloads), fronted by a CF Worker for analytics
- `get.pasmello.com` → CLI install script (`install.sh`) + release manifest
- `pasmello.com` / `api.pasmello.com` → hosted SaaS (separate repo)

## Quick start

```bash
# Prereqs: Node ≥ 24, pnpm ≥ 10, Docker (for local Postgres + MinIO)
make install
make dev             # api on :8787, web on :5180, postgres + minio via compose
make migrate         # run DB migrations
```

## Repo layout

```
mello/
  spec/                     Package envelope schema + vendored Pasmello manifest schemas [Apache 2.0]
  apps/
    api/                    Registry API (Hono on Fly.io)                                [AGPL]
    web/                    Marketplace web UI (SvelteKit → Cloudflare Pages)             [AGPL]
    cli/                    Rust CLI — `mello publish`, `mello yank`, …                  [Apache 2.0]
  packages/
    admin-core/             Moderation primitives consumed by apps/web                    [AGPL]
    plugin-spec/            Envelope + manifest validators, re-exported types            [Apache 2.0]
    registry-client/        Typed HTTP client consumed by apps/web                        [Apache 2.0]
  infra/
    terraform/              Cloudflare + Fly provisioning
    workers/cdn-analytics/  CF Worker fronting cdn.pasmello.com (download analytics)
    scripts/                Analytics batch + maintenance scripts
  docs/                     Publisher Guide, CLI reference, API reference
```

## Quick publish walkthrough

```bash
curl -fsSL https://get.pasmello.com | sh
mello login
mello init --type tool --name clock
# edit mello.package.json + tool.manifest.json + build your entry file
mello validate
mello publish
```

See [docs/publisher-guide.md](./docs/publisher-guide.md) for the full walk-through.

## Design principles

1. Anonymous by default. Login only for writes (publish, manage, private).
2. Independence. Marketplace works with or without the commercial SaaS.
3. Metadata-first API. Zip bytes never pass through the server — always 302 to CDN.
4. Hard cost caps + rate limits from day one.
5. Degraded mode. Feature flags can disable publish / download / search at runtime.

## License

Per-subtree. See [`LICENSING.md`](./LICENSING.md).

- Registry API + web + admin + infra → **AGPL v3** with commercial dual-license option
- CLI + plugin-spec + registry-client + spec → **Apache 2.0**
