# mello package format — spec

Single source of truth for the package format mello validates on
publish. The Rust CLI (in the `pasmello` repo) vendors these schemas and
validates locally before upload.

## Files

- `mello-package-v1.schema.json` — envelope schema (`mello.package.json`
  at the root of every published zip)
- `pasmello-manifests/tool.schema.json` — nested `tool.manifest.json`
- `pasmello-manifests/theme.schema.json` — nested `theme.manifest.json`
- `pasmello-manifests/workflow.schema.json` — nested `workflow.manifest.json`

The Pasmello-manifest schemas are **vendored** — they are versioned copies
synced from `pasmello/packages/plugin-spec` at a specific release tag. Do
not edit these files directly; bump the pin and re-sync from upstream.

## Validation order

1. Validate `mello.package.json` against `mello-package-v1.schema.json`
2. Based on envelope `type`, validate the nested manifest against the
   matching schema under `pasmello-manifests/`

## License

This directory is licensed under Apache 2.0 (see repo `LICENSE-APACHE`)
so plugin tooling and alternative clients can freely validate and
produce mello packages without copyleft burden.
