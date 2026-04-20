import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/client.ts';
import { requireAuth, type AuthedUser } from '../auth/tokens.ts';
import { requireFlag } from '../middleware/flags.ts';
import { maxSemver } from '../util/semver.ts';

export const yankRoutes = new Hono<{ Variables: { user: AuthedUser } }>();

yankRoutes.use('*', requireFlag('publish.enabled'));
yankRoutes.use('*', requireAuth);

const paramSchema = z.object({
  type: z.enum(['tool', 'theme', 'workflow']),
  scope: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
});

const bodySchema = z.object({
  reason: z.string().max(500).optional(),
});

async function assertOwnership(
  userId: string,
  type: string,
  scope: string,
  name: string,
): Promise<{ packageId: string; latestVersion: string | null } | null> {
  const rows = await sql<
    Array<{ id: string; latestVersion: string | null; ownerId: string }>
  >`
    SELECT p.id, p.latest_version, p.owner_id
    FROM packages p
    LEFT JOIN package_owners po ON po.package_id = p.id AND po.user_id = ${userId}
    WHERE p.type = ${type} AND p.scope = ${scope} AND p.name = ${name}
      AND (p.owner_id = ${userId} OR po.user_id IS NOT NULL)
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return { packageId: rows[0]!.id, latestVersion: rows[0]!.latestVersion };
}

// POST /v1/packages/:type/:scope/:name/yank/:version
yankRoutes.post('/:type/:scope/:name/yank/:version', async (c) => {
  const user = c.get('user');
  const parsed = paramSchema.safeParse({
    type: c.req.param('type'),
    scope: c.req.param('scope'),
    name: c.req.param('name'),
    version: c.req.param('version'),
  });
  if (!parsed.success) return c.json({ error: 'invalid params' }, 400);

  const body = await c.req.json().catch(() => ({}));
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) return c.json({ error: 'invalid body' }, 400);

  const { type, scope, name, version } = parsed.data;
  const pkg = await assertOwnership(user.id, type, scope, name);
  if (!pkg) return c.json({ error: 'package not found or not yours' }, 404);

  const reason = parsedBody.data.reason ?? null;

  const yankResult = await sql.begin(async (tx) => {
    const updated = await tx<Array<{ id: string }>>`
      UPDATE versions
        SET status = 'yanked',
            yanked_at = now(),
            yanked_reason = ${reason}
        WHERE package_id = ${pkg.packageId}
          AND version = ${version}
          AND status = 'active'
        RETURNING id
    `;
    if (updated.length === 0) return { versionFound: false };

    // Recompute latest_version semver-correctly in JS — SQL string ordering
    // would put 0.10.0 below 0.2.0.
    const active = await tx<Array<{ version: string }>>`
      SELECT version FROM versions
      WHERE package_id = ${pkg.packageId} AND status = 'active'
    `;
    const newLatest = maxSemver(active.map((r) => r.version));
    await tx`
      UPDATE packages SET latest_version = ${newLatest}, updated_at = now()
      WHERE id = ${pkg.packageId}
    `;
    return { versionFound: true, newLatest };
  });

  if (!yankResult.versionFound) {
    return c.json({ error: 'version not found or already yanked' }, 404);
  }
  return c.json({ ok: true, latestVersion: yankResult.newLatest });
});

// POST /v1/packages/:type/:scope/:name/unyank/:version — restore a yank
yankRoutes.post('/:type/:scope/:name/unyank/:version', async (c) => {
  const user = c.get('user');
  const parsed = paramSchema.safeParse({
    type: c.req.param('type'),
    scope: c.req.param('scope'),
    name: c.req.param('name'),
    version: c.req.param('version'),
  });
  if (!parsed.success) return c.json({ error: 'invalid params' }, 400);

  const { type, scope, name, version } = parsed.data;
  const pkg = await assertOwnership(user.id, type, scope, name);
  if (!pkg) return c.json({ error: 'package not found or not yours' }, 404);

  const updated = await sql<Array<{ id: string }>>`
    UPDATE versions
      SET status = 'active',
          yanked_at = NULL,
          yanked_reason = NULL
      WHERE package_id = ${pkg.packageId}
        AND version = ${version}
        AND status = 'yanked'
      RETURNING id
  `;
  if (updated.length === 0) return c.json({ error: 'version not yanked' }, 404);

  const active = await sql<Array<{ version: string }>>`
    SELECT version FROM versions
    WHERE package_id = ${pkg.packageId} AND status = 'active'
  `;
  const newLatest = maxSemver(active.map((r) => r.version));
  await sql`
    UPDATE packages SET latest_version = ${newLatest}, updated_at = now()
    WHERE id = ${pkg.packageId}
  `;
  return c.json({ ok: true, latestVersion: newLatest });
});
