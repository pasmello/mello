import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/client.ts';
import { requireAuth, type AuthedUser } from '../auth/tokens.ts';

export const ownersRoutes = new Hono<{ Variables: { user: AuthedUser } }>();

ownersRoutes.use('*', requireAuth);

const paramSchema = z.object({
  type: z.enum(['tool', 'theme', 'workflow']),
  scope: z.string().min(1),
  name: z.string().min(1),
});

const addBodySchema = z.object({
  login: z.string().min(1).max(39),
  role: z.enum(['co-owner']).default('co-owner'),
});

// Only the primary owner (packages.owner_id) can grant/revoke co-ownership.
// Co-owners can publish + yank but cannot alter the owner list.
async function assertPrimaryOwner(
  userId: string,
  type: string,
  scope: string,
  name: string,
): Promise<string | null> {
  const rows = await sql<Array<{ id: string }>>`
    SELECT id FROM packages
    WHERE type = ${type} AND scope = ${scope} AND name = ${name}
      AND owner_id = ${userId}
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

// GET /v1/packages/:type/:scope/:name/owners — list owners
ownersRoutes.get('/:type/:scope/:name/owners', async (c) => {
  const parsed = paramSchema.safeParse({
    type: c.req.param('type'),
    scope: c.req.param('scope'),
    name: c.req.param('name'),
  });
  if (!parsed.success) return c.json({ error: 'invalid params' }, 400);
  const { type, scope, name } = parsed.data;

  const rows = await sql<
    Array<{ login: string; role: 'owner' | 'co-owner'; addedAt: Date | null }>
  >`
    SELECT u.login,
           CASE WHEN p.owner_id = u.id THEN 'owner' ELSE po.role END as role,
           po.added_at
    FROM packages p
    LEFT JOIN package_owners po ON po.package_id = p.id
    LEFT JOIN users u ON u.id = COALESCE(po.user_id, p.owner_id)
    WHERE p.type = ${type} AND p.scope = ${scope} AND p.name = ${name}
    ORDER BY (CASE WHEN p.owner_id = u.id THEN 0 ELSE 1 END), po.added_at NULLS LAST
  `;
  if (rows.length === 0) return c.json({ error: 'package not found' }, 404);
  return c.json({ owners: rows });
});

// POST /v1/packages/:type/:scope/:name/owners — add co-owner by login
ownersRoutes.post('/:type/:scope/:name/owners', async (c) => {
  const user = c.get('user');
  const parsed = paramSchema.safeParse({
    type: c.req.param('type'),
    scope: c.req.param('scope'),
    name: c.req.param('name'),
  });
  if (!parsed.success) return c.json({ error: 'invalid params' }, 400);
  const body = await c.req.json().catch(() => null);
  const parsedBody = addBodySchema.safeParse(body);
  if (!parsedBody.success) return c.json({ error: 'invalid body' }, 400);

  const { type, scope, name } = parsed.data;
  const packageId = await assertPrimaryOwner(user.id, type, scope, name);
  if (!packageId) return c.json({ error: 'not the primary owner' }, 403);

  const login = parsedBody.data.login.toLowerCase();
  const users = await sql<Array<{ id: string }>>`
    SELECT id FROM users WHERE login = ${login} LIMIT 1
  `;
  if (users.length === 0) return c.json({ error: 'user not found' }, 404);
  const coOwnerId = users[0]!.id;

  if (coOwnerId === user.id) {
    return c.json({ error: 'cannot add yourself as co-owner' }, 400);
  }

  await sql`
    INSERT INTO package_owners (package_id, user_id, role)
    VALUES (${packageId}, ${coOwnerId}, ${parsedBody.data.role})
    ON CONFLICT (package_id, user_id) DO NOTHING
  `;
  return c.json({ ok: true });
});

// DELETE /v1/packages/:type/:scope/:name/owners/:login — remove co-owner
ownersRoutes.delete('/:type/:scope/:name/owners/:login', async (c) => {
  const user = c.get('user');
  const parsed = paramSchema.safeParse({
    type: c.req.param('type'),
    scope: c.req.param('scope'),
    name: c.req.param('name'),
  });
  if (!parsed.success) return c.json({ error: 'invalid params' }, 400);
  const login = c.req.param('login')?.toLowerCase();
  if (!login) return c.json({ error: 'invalid login' }, 400);

  const { type, scope, name } = parsed.data;
  const packageId = await assertPrimaryOwner(user.id, type, scope, name);
  if (!packageId) return c.json({ error: 'not the primary owner' }, 403);

  const rows = await sql`
    DELETE FROM package_owners po
    USING users u
    WHERE po.package_id = ${packageId}
      AND po.user_id = u.id
      AND u.login = ${login}
    RETURNING po.user_id
  `;
  if (rows.length === 0) return c.json({ error: 'co-owner not found' }, 404);
  return c.json({ ok: true });
});

// POST /v1/packages/:type/:scope/:name/transfer — transfer primary ownership
const transferSchema = z.object({ login: z.string().min(1).max(39) });
ownersRoutes.post('/:type/:scope/:name/transfer', async (c) => {
  const user = c.get('user');
  const parsed = paramSchema.safeParse({
    type: c.req.param('type'),
    scope: c.req.param('scope'),
    name: c.req.param('name'),
  });
  if (!parsed.success) return c.json({ error: 'invalid params' }, 400);
  const body = await c.req.json().catch(() => null);
  const parsedBody = transferSchema.safeParse(body);
  if (!parsedBody.success) return c.json({ error: 'invalid body' }, 400);

  const { type, scope, name } = parsed.data;
  const packageId = await assertPrimaryOwner(user.id, type, scope, name);
  if (!packageId) return c.json({ error: 'not the primary owner' }, 403);

  const targetLogin = parsedBody.data.login.toLowerCase();
  const users = await sql<Array<{ id: string }>>`
    SELECT id FROM users WHERE login = ${targetLogin} LIMIT 1
  `;
  if (users.length === 0) return c.json({ error: 'user not found' }, 404);
  const newOwnerId = users[0]!.id;

  await sql.begin(async (tx) => {
    await tx`UPDATE packages SET owner_id = ${newOwnerId}, updated_at = now() WHERE id = ${packageId}`;
    await tx`
      INSERT INTO package_owners (package_id, user_id, role)
      VALUES (${packageId}, ${user.id}, 'co-owner')
      ON CONFLICT (package_id, user_id) DO UPDATE SET role = 'co-owner'
    `;
    await tx`
      DELETE FROM package_owners
      WHERE package_id = ${packageId} AND user_id = ${newOwnerId}
    `;
  });

  return c.json({ ok: true });
});
