# CLI reference

`mello` is the Rust CLI that publishes and manages packages on the mello
registry. It lives at `apps/cli/` in this repo (Apache 2.0).

## Install

```bash
curl -fsSL https://get.pasmello.com | sh
```

The script pulls a pre-built binary from the latest GitHub Release and
verifies it against `manifest.sha256`. Default install path is
`~/.local/bin/mello`; override with `MELLO_INSTALL_DIR`.

## Configuration

Precedence (highest wins):

1. `--registry <url>` flag
2. `MELLO_REGISTRY_URL` env var
3. `~/.config/mello/config.toml` → `registry = "…"`
4. Default: `https://registry.pasmello.com`

Tokens are stored in the OS keychain (`keyring` crate) with a 0600 file
fallback at `~/.config/mello/credentials-<slug>` if the keychain isn't
available.

## Commands

### `mello login`

GitHub device flow. Opens your browser to github.com, shows a short code,
and stores the resulting `mello_tok_`-prefixed token.

### `mello logout`

Removes stored credentials for the current registry.

### `mello whoami`

Prints the currently authenticated user.

### `mello init [--type tool|theme|workflow] [--name NAME]`

Scaffolds a new package in the current directory.

### `mello validate [PATH]`

Packs + validates without uploading. Useful for CI — exits non-zero if
anything's wrong.

### `mello publish [--yes] [PATH]`

Packs the working directory, computes sha256, and uploads to
`/v1/publish`. Prompts for confirmation unless `--yes` is passed.

### `mello yank <COORD> <VERSION> [--reason "..."]`

Marks a version unavailable. Coord shape: `<type>:@<scope>/<name>`, e.g.
`tool:@alice/clock`.

## `.melloignore`

Works like `.gitignore`. Default excludes: `.git`, `.github`,
`node_modules`, `target`, `.DS_Store`, `.env`, `.env.*`, `*.log`.

## Troubleshooting

- **"not logged in"** — run `mello login` (or set `MELLO_TOKEN`).
- **"author_mismatch"** — your envelope's `scope` must equal your GitHub
  login, unless an existing owner has added you as a co-owner.
- **"version_exists"** — bump the version; mello versions are immutable.
- **"archive_too_large"** — 20 MB cap; check what's being packed with
  `mello validate`.
