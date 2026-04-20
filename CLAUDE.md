# mello

Independent plugin marketplace for Pasmello. This repo ships the
registry API, marketplace web UI, admin/moderation tools, the Rust CLI,
TS client packages, and infra. Per-subtree licenses — see `LICENSING.md`.

## Scope (Tier 3 of the Pasmello 4-tier roadmap)

- Marketplace is independent public infrastructure. SaaS, local pasmello,
  and the CLI are all equal clients of this API. Core flows (install /
  search / publish) must never require the commercial SaaS to be up.
- Dependency direction is one-way: `pasmello-saas` → `mello`, never the
  reverse. The only exception is the paid-plugin `verify-access` path,
  which forwards a user bearer to `api.pasmello.com /subscriptions/verify`.

## Three-repo map

| Repo | License | Contents |
|---|---|---|
| `pasmello` | MIT | Pasmello web app, `@pasmello/plugin-spec`, `?install=` handler |
| `mello` *(this repo)* | Mixed (per subtree) | registry API + web UI + admin + CLI + TS client packages + infra |
| `pasmello-saas` | Private / commercial | hosted SaaS backend |

## Per-subtree licenses

- **AGPL v3** (+ commercial dual-license): `apps/api/`, `apps/web/`, `packages/admin-core/`, `infra/`
- **Apache 2.0**: `apps/cli/`, `packages/plugin-spec/`, `packages/registry-client/`, `spec/`

## Stack

- **API:** Hono on Fly.io (Tokyo `nrt`) — TypeScript, Node ≥ 24
- **Web:** SvelteKit 2 (Svelte 5) + Vite, `adapter-static`, deployed to Cloudflare Pages
- **CLI:** Rust + clap — single-binary, distributed via GitHub Releases + `get.pasmello.com`
- **DB:** Neon Postgres (serverless)
- **Storage:** Cloudflare R2 (zero egress), content-addressable keys
- **CDN:** CF Worker in front of R2 (logs to Analytics Engine; long TTL for immutable zips)
- **Auth:** GitHub OAuth only — web uses HttpOnly session cookies, CLI uses `mello_tok_`-prefixed bearer tokens (sha256-hashed in DB). No password auth.
- **Search:** Postgres `tsvector` Phase 1; Meilisearch hook for Phase 2
- **Monorepo:** pnpm workspaces + Makefile + Cargo (CLI)

## Structure

```
apps/api/                   Hono registry API (Fly.io)
apps/web/                   SvelteKit static marketplace UI (CF Pages)
apps/cli/                   Rust CLI (Apache 2.0)
packages/admin-core/        Moderation primitives used by apps/web + api
packages/plugin-spec/       Envelope + vendored Pasmello schemas + validators (Apache 2.0)
packages/registry-client/   Typed API client used by apps/web (Apache 2.0)
spec/                       JSON Schemas, source of truth
infra/terraform/            Cloudflare + Fly provisioning
infra/workers/cdn-analytics/  CF Worker fronting cdn.pasmello.com
infra/scripts/              Analytics batch + maintenance
docs/                       Publisher guide, CLI ref, API ref
```

## Commands

```
make install        install all deps
make dev            local Postgres + MinIO + api (:8787) + web (:5180)
make migrate        run DB migrations against the configured env
make build          build all workspaces
make deploy         deploy api to Fly + web to CF Pages
make clean          remove build artifacts
```

## Architecture

### Package format

Every published zip has a root `mello.package.json` envelope plus the
Pasmello-native manifest (`tool.manifest.json` / `theme.manifest.json` /
`workflow.manifest.json`). Envelope is validated first, then the nested
manifest. Source of truth for schemas: `spec/mello-package-v1.schema.json`
+ vendored copies under `spec/pasmello-manifests/`.

### Naming + immutability

- Package ids: `@<github-login>/<name>`, globally unique by construction
- Three package types (`tool`, `theme`, `workflow`) are independent
- Versions are immutable once published (semver)
- `packages.status`: `active | yanked | taken_down`
- R2 keys are content-addressable: `packages/{type}/{scope}/{name}/{version}/{sha256}.zip`

### API invariants

- All endpoints CORS-open (`Access-Control-Allow-Origin: *`)
- API never serves zip bytes — always `302` to `cdn.pasmello.com`
- Anonymous by default; auth only for writes + admin
- Rate limits enforced at the Cloudflare edge (app-side per-IP counter is defense-in-depth)

### Day-1 guardrails (non-negotiable)

- CF billing alerts at $20 / $50 / $100
- Fly spending cap $25/mo; Neon free-tier auto-suspend
- Upload cap **20 MB** per package
- Admin takedown + feature flags live from launch
- Archive safety validators: reject symlinks, absolute paths, zip-slip, ELF/Mach-O/PE executables
- Malware-scan hook in publish pipeline (stub in MVP; ClamAV/VirusTotal later)

## Conventions

- **Pasmello types are vendored, not depended on transitively.** The registry
  validates against JSON Schemas in `spec/pasmello-manifests/`, pinned to a
  specific Pasmello release (see `spec/pasmello-manifests/PINNED_VERSION`).
  Bump the schema when Pasmello releases new types.
- **Never write to Postgres on download.** Download counts go through the CF
  Worker → Analytics Engine → daily batch into `download_stats_daily`.
- **Feature flags are the only legitimate way to disable a surface at runtime.**
  No env-var hot toggles, no conditional route mounting — the `admin/flags`
  table is the single source of truth.
- **GitHub OAuth only.** No password auth. Email verification is not required
  (GitHub vouches for identity); no Resend dependency.
- **Commit messages: use the exact message approved, nothing appended.** No
  `Co-Authored-By:` trailer unless the user explicitly asks for one.
- **Don't dump on main.** Each phase / feature goes on its own `feat/*`
  branch and lands via PR. Stacked PRs are fine — note the base branch.
