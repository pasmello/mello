import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/client.ts';
import { publicDownloadUrl } from '../r2/client.ts';
import { env } from '../env.ts';

export const packagesRoutes = new Hono();

const typeEnum = z.enum(['tool', 'theme', 'workflow']);
const scopeRe = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/;
const nameRe = /^[a-z0-9][a-z0-9._-]{0,63}$/;

// ---- GET /v1/packages ----------------------------------------------------
// List + search. Anonymous, open CORS, ≤ 50 results per page.
packagesRoutes.get('/', async (c) => {
  const query = z
    .object({
      q: z.string().max(128).optional(),
      type: typeEnum.optional(),
      scope: z.string().max(39).optional(),
      sort: z.enum(['recent', 'name']).default('recent'),
      page: z.coerce.number().int().min(1).max(200).default(1),
      pageSize: z.coerce.number().int().min(1).max(50).default(20),
    })
    .safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!query.success) return c.json({ error: query.error.issues }, 400);
  const { q, type, scope, sort, page, pageSize } = query.data;
  const offset = (page - 1) * pageSize;

  // We build the query in three independent pieces and UNION them via COALESCE
  // because postgres.js doesn't have a clean "optional WHERE" combinator.
  const rows = await sql<
    Array<{
      scope: string;
      name: string;
      type: 'tool' | 'theme' | 'workflow';
      latestVersion: string | null;
      description: string;
      tier: 'free' | 'paid';
      updatedAt: Date;
    }>
  >`
    SELECT scope, name, type, latest_version, description, tier, updated_at
    FROM packages
    WHERE status = 'active'
      ${type ? sql`AND type = ${type}` : sql``}
      ${scope ? sql`AND scope = ${scope}` : sql``}
      ${
        q
          ? sql`AND search_tsv @@ plainto_tsquery('english', ${q})`
          : sql``
      }
    ORDER BY ${sort === 'name' ? sql`scope ASC, name ASC` : sql`updated_at DESC`}
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  return c.json({
    items: rows.map((r) => ({
      type: r.type,
      scope: r.scope,
      name: r.name,
      fullName: `@${r.scope}/${r.name}`,
      latestVersion: r.latestVersion,
      description: r.description,
      tier: r.tier,
      updatedAt: r.updatedAt,
    })),
    page,
    pageSize,
  });
});

// ---- GET /v1/packages/:type/:scope/:name --------------------------------
packagesRoutes.get('/:type/:scope/:name', async (c) => {
  const params = parseParams(c.req.param());
  if (!params.ok) return c.json({ error: params.error }, 400);
  const { type, scope, name } = params.value;

  const pkg = await sql<
    Array<{
      id: string;
      latestVersion: string | null;
      description: string;
      tier: 'free' | 'paid';
      status: string;
      homepage: string | null;
      repository: string | null;
      keywords: string[];
      createdAt: Date;
      updatedAt: Date;
    }>
  >`
    SELECT id, latest_version, description, tier, status, homepage, repository, keywords, created_at, updated_at
    FROM packages
    WHERE type = ${type} AND scope = ${scope} AND name = ${name}
    LIMIT 1
  `;
  const p = pkg[0];
  if (!p) return c.json({ error: 'not found' }, 404);
  if (p.status === 'taken_down') return c.json({ error: 'gone' }, 410);

  const versions = await sql<
    Array<{
      version: string;
      sha256: string;
      sizeBytes: number;
      status: 'active' | 'yanked';
      publishedAt: Date;
    }>
  >`
    SELECT version, sha256, size_bytes, status, published_at
    FROM versions WHERE package_id = ${p.id}
    ORDER BY published_at DESC
  `;

  return c.json({
    type,
    scope,
    name,
    fullName: `@${scope}/${name}`,
    latestVersion: p.latestVersion,
    description: p.description,
    tier: p.tier,
    status: p.status,
    homepage: p.homepage,
    repository: p.repository,
    keywords: p.keywords,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    versions,
  });
});

// ---- GET /v1/packages/:type/:scope/:name/:version -----------------------
packagesRoutes.get('/:type/:scope/:name/:version', async (c) => {
  const params = parseParams(c.req.param(), { requireVersion: true });
  if (!params.ok) return c.json({ error: params.error }, 400);
  const { type, scope, name, version } = params.value as Required<typeof params.value>;

  const rows = await sql<
    Array<{
      manifestJson: unknown;
      envelopeJson: unknown;
      sha256: string;
      sizeBytes: number;
      r2Key: string;
      status: 'active' | 'yanked';
      publishedAt: Date;
      pkgStatus: string;
    }>
  >`
    SELECT v.manifest_json, v.envelope_json, v.sha256, v.size_bytes, v.r2_key,
           v.status, v.published_at, p.status AS pkg_status
    FROM versions v
    JOIN packages p ON p.id = v.package_id
    WHERE p.type = ${type} AND p.scope = ${scope} AND p.name = ${name}
      AND v.version = ${version}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return c.json({ error: 'not found' }, 404);
  if (r.pkgStatus === 'taken_down' || r.status === 'yanked') {
    return c.json({ error: 'gone' }, 410);
  }

  return c.json({
    type,
    scope,
    name,
    version,
    sha256: r.sha256,
    sizeBytes: r.sizeBytes,
    publishedAt: r.publishedAt,
    envelope: r.envelopeJson,
    manifest: r.manifestJson,
    downloadUrl: publicDownloadUrl(r.r2Key),
  });
});

// ---- GET /v1/packages/:type/:scope/:name/:version/verify-access ---------
// MVP: every free-tier package is accessible. The paid path is scaffolded
// so the SaaS wiring is a drop-in change later, not a protocol change.
packagesRoutes.get('/:type/:scope/:name/:version/verify-access', async (c) => {
  const params = parseParams(c.req.param(), { requireVersion: true });
  if (!params.ok) return c.json({ error: params.error }, 400);
  const { type, scope, name, version } = params.value as Required<typeof params.value>;

  const rows = await sql<
    Array<{
      tier: 'free' | 'paid';
      r2Key: string;
      pkgStatus: string;
      vStatus: 'active' | 'yanked';
    }>
  >`
    SELECT p.tier, v.r2_key, p.status AS pkg_status, v.status AS v_status
    FROM versions v JOIN packages p ON p.id = v.package_id
    WHERE p.type = ${type} AND p.scope = ${scope} AND p.name = ${name}
      AND v.version = ${version}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return c.json({ error: 'not found' }, 404);
  if (r.pkgStatus === 'taken_down' || r.vStatus === 'yanked') {
    return c.json({ error: 'gone' }, 410);
  }

  if (r.tier === 'free') {
    return c.json({ tier: 'free', downloadUrl: publicDownloadUrl(r.r2Key) });
  }

  // r.tier === 'paid'
  if (!env.PASMELLO_SAAS_VERIFY_URL) {
    return c.json({ error: 'paid packages require SaaS integration' }, 501);
  }
  const bearer = c.req.header('authorization');
  if (!bearer) {
    return c.json({ error: 'authentication required', upgrade: env.PASMELLO_SAAS_VERIFY_URL }, 402);
  }
  // TODO: forward bearer to PASMELLO_SAAS_VERIFY_URL and mint a short-TTL
  // signed URL on success. Tracked as plan step 12 (deferred past MVP).
  return c.json({ error: 'not implemented' }, 501);
});

// ---- GET /v1/packages/:type/:scope/:name/:version/download --------------
// Not in the plan's API table, but convenient. Same effect as /v1/download
// (which lives in the same file for symmetry).
packagesRoutes.get('/:type/:scope/:name/:version/download', downloadHandler);

export async function downloadHandler(c: Parameters<Parameters<typeof packagesRoutes.get>[1]>[0]) {
  const params = parseParams(c.req.param(), { requireVersion: true });
  if (!params.ok) return c.json({ error: params.error }, 400);
  const { type, scope, name, version } = params.value as Required<typeof params.value>;

  const rows = await sql<
    Array<{ r2Key: string; pkgStatus: string; vStatus: 'active' | 'yanked' }>
  >`
    SELECT v.r2_key, p.status AS pkg_status, v.status AS v_status
    FROM versions v JOIN packages p ON p.id = v.package_id
    WHERE p.type = ${type} AND p.scope = ${scope} AND p.name = ${name}
      AND v.version = ${version}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return c.json({ error: 'not found' }, 404);
  if (r.pkgStatus === 'taken_down' || r.vStatus === 'yanked') {
    return c.json({ error: 'gone' }, 410);
  }
  return c.redirect(publicDownloadUrl(r.r2Key), 302);
}

// ---- helpers ------------------------------------------------------------
function parseParams(
  raw: Record<string, string>,
  opts: { requireVersion?: boolean } = {},
):
  | { ok: true; value: { type: 'tool' | 'theme' | 'workflow'; scope: string; name: string; version?: string } }
  | { ok: false; error: string } {
  const type = typeEnum.safeParse(raw.type);
  if (!type.success) return { ok: false, error: 'invalid type' };
  const scope = (raw.scope ?? '').toLowerCase();
  const name = (raw.name ?? '').toLowerCase();
  if (!scopeRe.test(scope)) return { ok: false, error: 'invalid scope' };
  if (!nameRe.test(name)) return { ok: false, error: 'invalid name' };
  const version = raw.version;
  if (opts.requireVersion && !version) return { ok: false, error: 'version required' };
  return { ok: true, value: { type: type.data, scope, name, version } };
}
