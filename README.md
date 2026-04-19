# mello

Independent plugin marketplace for [Pasmello](https://github.com/pasmello/pasmello).
Hosts shareable **tools**, **themes**, and **workflows** under a public
package registry with a web UI and a CLI package manager.

> ⚠️ Early scaffold. Not yet deployed.

## What this repo is

This is the mello service — the open-source, AGPL-licensed infrastructure
that powers the Pasmello plugin ecosystem. It is **independent public
infrastructure**: the hosted pasmello SaaS, a self-built local pasmello,
and the CLI are all equal clients of this API.

- Registry API (Hono on Fly.io)
- Marketplace web UI (SvelteKit static on Cloudflare Pages)
- Admin / moderation tools
- Infrastructure as code (Terraform + Neon migrations)

## What this repo is **not**

| Concern | Lives in |
|---|---|
| `mello` CLI (Rust) | `pasmello` repo (MIT) |
| `@pasmello/plugin-spec` | `pasmello` repo (MIT) |
| `@pasmello/registry-client` SDK | `pasmello` repo (MIT) |
| Hosted SaaS (sessions, LLM proxy, billing) | `pasmello-saas` repo (private, commercial) |

See [`LICENSING.md`](./LICENSING.md) for the full strategy.

## Deployment layout

- `market.pasmello.dev` → this repo's API + web UI
- `cdn.pasmello.dev` → R2 public bucket (package zip downloads)
- `pasmello.dev` / `api.pasmello.dev` → hosted SaaS (separate repo)
- `get.pasmello.dev` → CLI install script

## Quick start

```bash
# Prereqs: Node ≥ 24, pnpm ≥ 10, Docker (for local Postgres + MinIO)
make install
make dev             # api on :8787, web on :5173, postgres + minio via compose
make migrate         # run DB migrations
```

## Repo layout

```
mello/
  spec/                     Package envelope schema + vendored Pasmello manifest schemas
  apps/
    api/                    Registry API (Hono on Fly.io)
    web/                    Marketplace web UI (SvelteKit → Cloudflare Pages)
  packages/
    admin-core/             Moderation primitives consumed by apps/web
  infra/
    terraform/              Cloudflare + Fly provisioning
    scripts/                Analytics batch + maintenance scripts
```

## Design principles

1. Anonymous by default. Login only for writes (publish, manage, private).
2. Independence. Marketplace works with or without the commercial SaaS.
3. Metadata-first API. Zip bytes never pass through the server — always 302 to CDN.
4. Hard cost caps + rate limits from day one.
5. Degraded mode. Feature flags can disable publish / download / search at runtime.

## License

Dual-licensed. See [`LICENSING.md`](./LICENSING.md).

- Core registry + web + admin → AGPL v3 (with commercial dual-license option)
- Package envelope spec (`spec/`) → Apache 2.0 (so plugin tooling can freely validate)
