# Contributing to mello

Thanks for the interest! A few ground rules to make review smooth.

## Dev environment

```bash
# Node ≥ 24, pnpm ≥ 10, Docker (for local Postgres + MinIO), Rust (for the CLI)
make install
make dev    # brings up api (:8787), web (:5180), Postgres, MinIO
make migrate
```

Tests:

```bash
pnpm -r test                          # Node workspaces
cargo test -p mello --manifest-path apps/cli/Cargo.toml   # Rust CLI
```

## Repo layout

- `apps/api/` — Hono registry API (AGPL)
- `apps/web/` — SvelteKit marketplace UI (AGPL)
- `apps/cli/` — Rust CLI (Apache 2.0)
- `packages/plugin-spec/` — envelope + vendored Pasmello schemas (Apache 2.0)
- `packages/registry-client/` — typed API client (Apache 2.0)
- `packages/admin-core/` — moderation primitives (AGPL)
- `spec/` — JSON Schemas, single source of truth (Apache 2.0)
- `infra/` — Terraform + CF Workers (AGPL)

## Licensing

mello is dual-licensed by subtree. See LICENSING.md for the full table
and `LICENSE` / `LICENSE-APACHE` for the verbatim texts. By contributing
to mello, you agree that your contribution is licensed under the license
of the subtree you are modifying.

Do not copy AGPL-covered code into Apache-licensed subtrees. If unsure,
ask in the PR.

## Commit messages

We use conventional commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`).
Keep the subject line under ~72 chars and write the body as a few short
sentences explaining the "why" more than the "what".

## PRs

- One focused change per PR. Stacked PRs are welcome — note the base branch.
- Please add tests for anything non-trivial. For API changes the bar is an
  integration test; for Svelte the bar is a Playwright smoke if the UX moved.
- CI (`.github/workflows/ci.yml`) runs typecheck / build / test for all
  workspaces plus Rust fmt/clippy/test. All must pass before merge.

## Security

If you find a security issue, please email security@pasmello.com rather
than opening a public issue. See SECURITY.md.
