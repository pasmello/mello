# Licensing

mello is licensed **per subtree** — different pieces of the repo carry
different licenses so each can be adopted on the terms that make sense for
that piece. The subtree tree is the canonical source; when in doubt, check
the `LICENSE` file in the nearest containing directory.

## Per-subtree summary

| Subtree | License |
|---|---|
| `apps/api/`, `apps/web/`, `packages/admin-core/`, `infra/` | **AGPL v3** (`LICENSE`) with commercial dual-license option |
| `apps/cli/` | **Apache 2.0** (`apps/cli/LICENSE`, full text at `LICENSE-APACHE`) |
| `packages/plugin-spec/` | **Apache 2.0** (`packages/plugin-spec/LICENSE`) |
| `packages/registry-client/` | **Apache 2.0** (`packages/registry-client/LICENSE`) |
| `spec/` | **Apache 2.0** (`spec/LICENSE`) |

## AGPL v3 — server + admin + infra

The registry API, marketplace web UI, admin/moderation tooling, and
infrastructure-as-code are licensed under the
[GNU Affero General Public License v3.0](./LICENSE).

**Why AGPL:** public-good registries (PyPI / Warehouse, crates.io,
RubyGems.org) are conventionally open source. AGPL prevents a commercial
competitor from running a proprietary fork as a service while keeping the
code genuinely open.

### Commercial dual-license option

Organizations that need to operate a private / proprietary derivative of
the server components (for example, an enterprise self-hosted deployment
that cannot comply with the AGPL's source-distribution requirements) can
acquire a commercial license from the maintainers. Contact
**admin@pasmello.com**.

## Apache 2.0 — CLI + TS packages + schemas

The Rust CLI, TypeScript client packages, and package envelope schemas are
licensed under the [Apache License 2.0](./LICENSE-APACHE). Anyone can
install, vendor, modify, and redistribute these pieces without a copyleft
obligation — the goal is to keep plugin authoring and tooling friction-free.

## FAQ

### Can I publish a plugin to mello without inheriting AGPL?

**Yes.** Your plugin runs in a separate process (Pasmello's sandboxed
iframe). Publishing a package doesn't make your package a derivative
work of the registry, and our CLI / SDK / envelope schema are Apache 2.0
so your tooling can depend on them freely.

### Can I run my own copy of the registry?

**Yes** — under AGPL, for any purpose, including hosting it for your team
or the public. You must pass the AGPL's source-availability obligation on
to your users if you modify the server and expose it over a network.

### Can I fork the registry and sell it as a hosted service?

**Only under the AGPL**, which requires you to release your modifications.
If your business model can't accommodate that, contact us about a
commercial license.

### Can I copy code between subtrees?

**Respect the direction:** pulling Apache-licensed code *into* an AGPL
subtree is fine. Pulling AGPL code *into* an Apache subtree is not — it
would effectively relicense the AGPL portion, which we can't do. If you
find yourself wanting to do this, open an issue first.

### Where do I sign the CLA?

There is no CLA. Your contribution is licensed under the license of the
subtree you're modifying (see `CONTRIBUTING.md`).

## Sibling repos

- `pasmello` (MIT) — the Pasmello app itself, plugin spec, plugin-author ergonomics
- `pasmello-saas` (private, commercial) — hosted SaaS backend; a client of mello
