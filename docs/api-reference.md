# API reference

Base URL: `https://registry.pasmello.com`. All endpoints are CORS-open
(`Access-Control-Allow-Origin: *`) and return JSON unless otherwise noted.
File bytes never pass through this server — downloads 302 to `cdn.pasmello.com`.

## Conventions

- Authentication: either a `Cookie: mello_session=...` (set by the web OAuth
  callback, HttpOnly) OR `Authorization: Bearer mello_tok_...` for CLI/CI.
- Content-Type: `application/json` for request bodies unless noted.
- Error shape: `{ "error": "<code>", "detail": "<human>" }` with an
  appropriate HTTP status.
- Rate limits are enforced at the Cloudflare edge: anon 60/min/IP,
  authed 300/min/token, publish 10/hour/user (API also enforces a
  per-IP counter as defense-in-depth).

## Public (no auth)

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/packages?q=&type=&scope=&sort=&page=&pageSize=` | Search/list. `q` is Postgres tsvector. |
| GET | `/v1/packages/:type/:scope/:name` | Summary + version list. |
| GET | `/v1/packages/:type/:scope/:name/:version` | Envelope + nested manifest + download URL. |
| GET | `/v1/packages/:type/:scope/:name/:version/download` | 302 → `cdn.pasmello.com/...`. |
| GET | `/v1/packages/:type/:scope/:name/:version/verify-access` | Returns `{tier: "free"}` in MVP. |

## Auth

| Method | Path | Notes |
|---|---|---|
| GET | `/auth/github?redirect_to=/` | Web OAuth redirect. |
| GET | `/auth/github/callback?code=&state=` | OAuth callback — sets session cookie, redirects. |
| POST | `/auth/logout` | Invalidates the session. |
| POST | `/auth/device/code` | CLI device-flow start. |
| POST | `/auth/device/token` | CLI device-flow poll — returns token or `428 authorization_pending`. |

## Account (auth required)

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/me` | Current user. |
| GET | `/v1/me/packages` | Packages you own or co-own. |
| GET | `/v1/me/tokens` | Your API tokens (no secrets — prefix only). |
| POST | `/v1/tokens` | Create a token. Secret returned **once**. |
| DELETE | `/v1/tokens/:id` | Revoke. |

## Write (auth required; token needs `publish` scope)

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/publish` | `multipart/form-data` with field `zip`, or raw `application/zip` body. Max 20 MB. Returns `{packageId, versionId, sha256, downloadUrl, ...}`. |
| POST | `/v1/packages/:type/:scope/:name/yank/:version` | Body `{reason?}`. Owner or co-owner. |
| POST | `/v1/packages/:type/:scope/:name/unyank/:version` | Restore. |
| GET | `/v1/packages/:type/:scope/:name/owners` | List owners + co-owners. |
| POST | `/v1/packages/:type/:scope/:name/owners` | Body `{login}`. Primary owner only. |
| DELETE | `/v1/packages/:type/:scope/:name/owners/:login` | Primary owner only. |
| POST | `/v1/packages/:type/:scope/:name/transfer` | Body `{login}`. Old owner becomes co-owner. |

## Admin (role-gated)

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/admin/packages/:id/takedown` | Takedown. Sets `status='taken_down'`. |
| POST | `/v1/admin/flags` | Toggle feature flags (`publish.enabled`, `download.enabled`, `search.enabled`, `read_only`). |

## Error codes (publish)

| Code | HTTP | Meaning |
|---|---|---|
| `archive_too_large` | 413 | Zip exceeds 20 MB. |
| `invalid_zip` | 400 | Not a valid zip archive. |
| `missing_envelope` | 400 | `mello.package.json` not at root. |
| `missing_manifest` | 400 | `{type}.manifest.json` not at root. |
| `invalid_envelope_json` / `invalid_manifest_json` | 400 | JSON parse failure. |
| `invalid_type` | 400 | `envelope.type` not one of `tool|theme|workflow`. |
| `envelope_schema_violation` | 400 | Envelope failed schema validation. |
| `manifest_schema_violation` | 400 | Nested manifest failed schema validation. |
| `archive_unsafe` | 400 | Symlinks / zip-slip / forbidden binaries. |
| `author_mismatch` | 403 | `envelope.scope` ≠ auth user AND user is not a co-owner. |
| `not_owner` | 403 | You're not an owner of this package. |
| `taken_down` | 403 | Package was taken down by admins. |
| `version_exists` | 409 | That version was already published (immutable). |
| `malware_detected` | 400 | Scan hook returned non-clean. |
