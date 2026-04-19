# mello

Independent plugin marketplace for Pasmello. This repo is the AGPL-licensed
registry API + marketplace web UI + admin tools. **Not** the CLI or the SDK
— those live in the `pasmello` repo (MIT).

## Scope (Tier 3 of the Pasmello 4-tier roadmap)

- Marketplace is independent public infrastructure. SaaS, local pasmello, and
  the CLI are all equal clients of this API. Core flows (install / search /
  publish) must never require the commercial SaaS to be up.
- Dependency direction is one-way: `pasmello-saas` → `mello`, never the
  reverse. The only exception is the paid-plugin `verify-access` path,
  which forwards a user bearer to `api.pasmello.dev /subscriptions/verify`.

## Three-repo map

| Repo | License | Contents |
|---|---|---|
| `pasmello` | MIT | web app, plugin spec, registry-client SDK, mello CLI |
| `mello` *(this repo)* | AGPL v3 + commercial | registry API, marketplace web UI, admin, infra |
| `pasmello-saas` | Private / commercial | hosted SaaS backend |

If a request wants to add CLI / plugin-spec / SDK work here: stop and
redirect to the pasmello repo.

## Stack

- **API:** Hono on Fly.io (TypeScript, Node ≥ 24)
- **Web:** SvelteKit 2 (Svelte 5) + Vite, `adapter-static`, deployed to Cloudflare Pages
- **DB:** Neon Postgres (serverless)
- **Storage:** Cloudflare R2 (zero egress), content-addressable keys
- **CDN:** Cloudflare in front of R2; long TTL for immutable zips, short TTL for metadata JSON
- **Auth:** GitHub OAuth (device flow for CLI) + email/password fallback; tokens bcrypt-hashed
- **Search:** Postgres `tsvector` Phase 1; Meilisearch hook for Phase 2
- **Monorepo:** pnpm workspaces + Makefile

## Structure

```
apps/api/                   Hono registry API (Fly.io)
apps/web/                   SvelteKit static marketplace UI (CF Pages)
packages/admin-core/        Moderation primitives used by apps/web
spec/                       Package envelope schema + vendored Pasmello schemas
infra/terraform/            Cloudflare + Fly provisioning
infra/scripts/              Analytics batch + maintenance
```

## Commands

```
make install        install all deps
make dev            local Postgres + MinIO + api (:8787) + web (:5173)
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
- API never serves zip bytes — always `302` to `cdn.pasmello.dev`
- Anonymous by default; auth only for writes + admin
- Rate limits enforced at the Cloudflare edge (not in application code)

### Day-1 guardrails (non-negotiable)

- Billing alerts at $20 / $50 / $100
- Fly spending cap; Neon free-tier auto-suspend
- Upload cap 50 MB per package
- Email-verified-before-publish (not before install)
- Admin takedown + feature flags live from launch
- Malware-scan hook in publish pipeline (stub in MVP; ClamAV/VirusTotal later)

## Conventions

- **Pasmello types are vendored, not depended on transitively.** The registry
  validates against JSON Schemas in `spec/pasmello-manifests/`, pinned to a
  specific Pasmello release. Bump the schema when Pasmello releases new types.
- **Never write to Postgres on download.** Download counts go through
  Cloudflare Analytics Engine and a daily batch into `download_stats_daily`.
- **Feature flags are the only legitimate way to disable a surface at runtime.**
  No env-var hot toggles, no conditional route mounting — the `admin/flags`
  table is the single source of truth.
- **Commit messages: use the exact message approved, nothing appended.** No
  `Co-Authored-By:` trailer unless the user explicitly asks for one.
