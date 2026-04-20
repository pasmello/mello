-- 0002: drop password auth, add sessions, extend api_tokens + versions
--
-- Rationale: mello uses GitHub OAuth only. Web clients hold an opaque
-- session id in an HttpOnly cookie; programmatic clients (CLI, CI) hold a
-- `mello_tok_`-prefixed bearer token. We never collect passwords, so the
-- email-verification dance is gone.

ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Opaque session ids. `id` IS the cookie value — so it must be high-entropy
-- random at issue time. 30-day rolling expiry; we refresh on use.
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

-- api_tokens: preserve existing rows, just add new metadata columns.
-- token_prefix = first 8 chars of the raw token (shown in dashboards so
-- users can tell which token is which without seeing the secret).
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS token_prefix TEXT;
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- GitHub device-flow state. The client polls with `device_code`; once the
-- user completes verification we stamp `approved_user_id` and the poller
-- trades it for a token.
CREATE TABLE IF NOT EXISTS device_flows (
  device_code         TEXT PRIMARY KEY,
  user_code           TEXT NOT NULL,
  verification_uri    TEXT NOT NULL,
  interval_seconds    INT NOT NULL DEFAULT 5,
  expires_at          TIMESTAMPTZ NOT NULL,
  approved_user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_flows_user_code_idx ON device_flows (user_code);

-- Versions needed richer lifecycle tracking for yank.
ALTER TABLE versions ADD COLUMN IF NOT EXISTS yanked_at TIMESTAMPTZ;
ALTER TABLE versions ADD COLUMN IF NOT EXISTS yanked_reason TEXT;

-- Download stats keyed by (package, version, date) — matches reference §7
-- and lets us surface per-version trend data later.
ALTER TABLE download_stats_daily ADD COLUMN IF NOT EXISTS version_id UUID
  REFERENCES versions(id) ON DELETE SET NULL;
ALTER TABLE download_stats_daily DROP CONSTRAINT IF EXISTS download_stats_daily_pkey;
ALTER TABLE download_stats_daily ADD PRIMARY KEY (package_id, version_id, date);

-- Per-IP abuse counter — CF edge is the primary line, this is defense in depth
-- for OAuth callback + token creation + publish. Buckets are 1-minute windows.
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  ip            INET NOT NULL,
  bucket        TEXT NOT NULL,
  count         INT NOT NULL DEFAULT 0,
  window_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ip, bucket)
);
CREATE INDEX IF NOT EXISTS auth_rate_limits_window_idx ON auth_rate_limits (window_start);

-- OAuth state → nonce we issue on /auth/github, validate on callback.
CREATE TABLE IF NOT EXISTS oauth_states (
  state         TEXT PRIMARY KEY,
  redirect_to   TEXT NOT NULL DEFAULT '/',
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
