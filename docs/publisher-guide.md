# Publisher Guide

How to package and publish a Pasmello plugin on mello.

## 1. Install the CLI

```bash
curl -fsSL https://get.pasmello.com | sh
mello --version
```

Or install from source — `cargo install --path apps/cli` from a checkout.

## 2. Log in

```bash
mello login
```

This opens your browser to GitHub, shows a short code, and stores a
`mello_tok_`-prefixed token in your OS keychain. Alternative flow: visit
`market.pasmello.com` → Login → Dashboard → Tokens → create a token and
point the CLI at it via `MELLO_TOKEN=… mello publish`.

## 3. Scaffold a package

```bash
mkdir my-clock && cd my-clock
mello init --type tool --name clock
```

That writes:

- `mello.package.json` — the envelope (see below)
- `tool.manifest.json` — the Pasmello-native manifest
- `README.md` — shown on the package detail page

## 4. Fill out the manifests

**`mello.package.json`** (envelope — consumed by the registry):

```json
{
  "melloSpecVersion": "1",
  "type": "tool",
  "scope": "alice",
  "name": "clock",
  "version": "0.1.0",
  "description": "Displays the current time.",
  "author": { "github": "alice" },
  "license": "MIT"
}
```

**`tool.manifest.json`** (consumed by Pasmello when it installs the tool):

```json
{
  "id": "clock",
  "name": "Clock",
  "version": "0.1.0",
  "description": "Displays the current time.",
  "entry": "dist/index.html",
  "permissions": {
    "network": [],
    "storage": "none",
    "clipboard": "none",
    "notifications": false,
    "camera": false,
    "geolocation": false
  },
  "actions": {}
}
```

Build your tool's assets into the path referenced by `entry` (e.g.
`dist/index.html`).

## 5. Validate

```bash
mello validate
```

Catches missing fields, unknown types, oversize archives, missing entry.

## 6. Publish

```bash
mello publish
```

The CLI packs your working directory into a zip (respecting
`.melloignore`), computes the sha256, and uploads to
`registry.pasmello.com`. On success it prints the CDN URL and the
`/p/...` detail page URL.

## 7. Install it

Anyone can now install your package by:

- Clicking "Open in Pasmello" on
  `https://market.pasmello.com/p/tool/alice/clock` — this opens
  `https://pasmello.com/?install=<cdn-url>`, which triggers Pasmello's
  first-run install handler
- Or, from a custom Pasmello origin, `https://<your-origin>/?install=<cdn-url>`

## 8. Yank if something's wrong

```bash
mello yank tool:@alice/clock 0.1.0 --reason "breaks in Safari"
```

Yanked versions stay downloadable for reproducibility but disappear from
search, and `mello` clients refuse to resolve them for new installs.

## 9. Ownership

Add a co-owner so they can publish under the same scope:

```
mello owners add    tool:@alice/clock bob
mello owners list   tool:@alice/clock
mello owners remove tool:@alice/clock bob
```

Only the primary owner can add/remove co-owners. Co-owners can publish
and yank but can't change the owner list.
