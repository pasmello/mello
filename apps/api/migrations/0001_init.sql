-- mello initial schema
-- Design notes:
--   * Versions are immutable after publish. `status='yanked'` hides a version
--     from resolution without deleting history.
--   * Packages are keyed by (type, scope, name) — three package types can
--     share a name within a scope.
--   * Download counts are NEVER written on the hot path. The batch job in
--     infra/scripts/ rolls CF Analytics Engine data into download_stats_daily.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_id       BIGINT UNIQUE,
  login           TEXT NOT NULL UNIQUE,
  email           TEXT UNIQUE,
  email_verified_at TIMESTAMPTZ,
  password_hash   TEXT,
  role            TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE api_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  scopes          TEXT[] NOT NULL DEFAULT ARRAY['publish']::TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ
);
CREATE INDEX api_tokens_user_id_idx ON api_tokens(user_id) WHERE revoked_at IS NULL;

CREATE TABLE packages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type            TEXT NOT NULL CHECK (type IN ('tool', 'theme', 'workflow')),
  scope           TEXT NOT NULL,
  name            TEXT NOT NULL,
  owner_id        UUID NOT NULL REFERENCES users(id),
  latest_version  TEXT,
  description     TEXT NOT NULL DEFAULT '',
  tier            TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid')),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'yanked', 'taken_down')),
  keywords        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  homepage        TEXT,
  repository      TEXT,
  search_tsv      TSVECTOR,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (type, scope, name)
);
CREATE INDEX packages_search_idx ON packages USING GIN (search_tsv);
CREATE INDEX packages_type_idx ON packages (type) WHERE status = 'active';
CREATE INDEX packages_updated_idx ON packages (updated_at DESC) WHERE status = 'active';

CREATE TABLE package_owners (
  package_id      UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'co-owner' CHECK (role IN ('owner', 'co-owner')),
  added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (package_id, user_id)
);

CREATE TABLE versions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id      UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  version         TEXT NOT NULL,
  sha256          TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL,
  manifest_json   JSONB NOT NULL,
  envelope_json   JSONB NOT NULL,
  r2_key          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'yanked')),
  published_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by    UUID NOT NULL REFERENCES users(id),
  UNIQUE (package_id, version)
);
CREATE INDEX versions_package_idx ON versions (package_id, published_at DESC);

CREATE TABLE version_dependencies (
  version_id      UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  depends_on_type TEXT NOT NULL CHECK (depends_on_type IN ('tool', 'theme', 'workflow')),
  depends_on_scope TEXT NOT NULL,
  depends_on_name TEXT NOT NULL,
  range           TEXT NOT NULL,
  PRIMARY KEY (version_id, depends_on_type, depends_on_scope, depends_on_name)
);

CREATE TABLE download_stats_daily (
  package_id      UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  count           BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (package_id, date)
);

CREATE TABLE feature_flags (
  key             TEXT PRIMARY KEY,
  value           JSONB NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES users(id)
);

-- Seed default flags: everything open.
INSERT INTO feature_flags (key, value) VALUES
  ('publish.enabled',  'true'::JSONB),
  ('download.enabled', 'true'::JSONB),
  ('search.enabled',   'true'::JSONB),
  ('read_only',        'false'::JSONB)
ON CONFLICT (key) DO NOTHING;

-- Keep search_tsv in sync with the text columns.
CREATE OR REPLACE FUNCTION packages_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('simple', coalesce(NEW.scope, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(NEW.keywords, ARRAY[]::TEXT[]), ' ')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER packages_tsv_trg
  BEFORE INSERT OR UPDATE OF scope, name, description, keywords
  ON packages
  FOR EACH ROW EXECUTE FUNCTION packages_tsv_update();
