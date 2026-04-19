# Licensing

mello uses a dual-license model.

## Core service — AGPL v3

The registry API, marketplace web UI, admin/moderation tooling, and
infrastructure configuration are licensed under the
[GNU Affero General Public License v3.0](./LICENSE).

This covers:
- `apps/api/` — registry API server
- `apps/web/` — marketplace web UI
- `packages/admin-core/` — moderation primitives
- `infra/` — infrastructure as code

**Why AGPL:** registries are conventionally open source
([PyPI/Warehouse](https://github.com/pypi/warehouse),
[crates.io](https://github.com/rust-lang/crates.io),
[RubyGems.org](https://github.com/rubygems/rubygems.org)). AGPL prevents a
commercial competitor from running a proprietary fork as a service while
keeping the code genuinely open.

## Package envelope spec — Apache 2.0

The package format specification (`spec/`) is licensed under the
[Apache License 2.0](./LICENSE-APACHE).

This covers:
- `spec/mello-package-v1.schema.json` — envelope schema
- `spec/pasmello-manifests/` — vendored JSON Schemas for Pasmello manifests

Plugin authors, tooling authors, and alternative clients must be free to
validate and produce valid mello packages without any copyleft burden.

## Commercial dual-license option

For organizations that need to operate a private / proprietary derivative
of the registry (for example, an enterprise self-hosted deployment that
cannot comply with the AGPL's source-distribution requirements), a
commercial license is available. Contact the maintainers.

## What this means

| You want to... | Under AGPL | Under commercial license |
|---|---|---|
| Run the registry as-is for a public marketplace | ✅ (attribute + keep source open) | N/A |
| Self-host for your organization, unmodified | ✅ (no AGPL trigger if no external users) | N/A |
| Modify and offer as a hosted service | ✅ (must release modifications) | ✅ (no source-release obligation) |
| Ship a proprietary fork | ❌ | ✅ |
| Build a Pasmello plugin and publish to a mello registry | ✅ (plugin is not a derivative — runs in a separate sandbox) | N/A |

## Contributing

Contributions to AGPL-licensed directories are under AGPL v3. Contributions
to `spec/` are under Apache 2.0. The license of the directory you're
contributing to determines which applies.

Sibling repos:
- `pasmello` (MIT) — the Pasmello app itself, plugin spec, CLI, SDK
- `pasmello-saas` (private, commercial) — hosted SaaS backend
