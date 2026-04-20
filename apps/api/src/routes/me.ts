import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/client.ts';
import { requireAuth, newApiToken, type AuthedUser } from '../auth/tokens.ts';
import { rateLimit } from '../middleware/rateLimit.ts';

export const meRoutes = new Hono<{ Variables: { user: AuthedUser } }>();

meRoutes.use('*', requireAuth);

meRoutes.get('/', async (c) => {
  const user = c.get('user');
  const rows = await sql<
    Array<{ id: string; login: string; email: string | null; avatarUrl: string | null; role: string }>
  >`
    SELECT id, login, email, avatar_url, role
    FROM users WHERE id = ${user.id}
  `;
  const r = rows[0];
  if (!r) return c.json({ error: 'user not found' }, 404);
  return c.json({
    id: r.id,
    login: r.login,
    email: r.email,
    avatarUrl: r.avatarUrl,
    role: r.role,
  });
});

meRoutes.get('/packages', async (c) => {
  const user = c.get('user');
  const rows = await sql<
    Array<{
      id: string;
      type: string;
      scope: string;
      name: string;
      latestVersion: string | null;
      description: string;
      status: string;
      updatedAt: Date;
      ownerRole: string;
    }>
  >`
    SELECT p.id, p.type, p.scope, p.name, p.latest_version, p.description,
           p.status, p.updated_at,
           CASE WHEN p.owner_id = ${user.id} THEN 'owner' ELSE po.role END as owner_role
    FROM packages p
    LEFT JOIN package_owners po
      ON po.package_id = p.id AND po.user_id = ${user.id}
    WHERE p.owner_id = ${user.id} OR po.user_id = ${user.id}
    ORDER BY p.updated_at DESC
  `;
  return c.json({ packages: rows });
});

meRoutes.get('/tokens', async (c) => {
  const user = c.get('user');
  const rows = await sql<
    Array<{
      id: string;
      name: string;
      tokenPrefix: string | null;
      scopes: string[];
      createdAt: Date;
      lastUsedAt: Date | null;
      expiresAt: Date | null;
    }>
  >`
    SELECT id, name, token_prefix, scopes, created_at, last_used_at, expires_at
    FROM api_tokens
    WHERE user_id = ${user.id} AND revoked_at IS NULL
    ORDER BY created_at DESC
  `;
  return c.json({ tokens: rows });
});

export const tokensRoutes = new Hono<{ Variables: { user: AuthedUser } }>();

tokensRoutes.use('*', requireAuth);

const createTokenSchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.enum(['publish', 'yank', 'manage'])).default(['publish']),
  expiresInDays: z.number().int().positive().max(365).optional(),
});

tokensRoutes.post('/', rateLimit('token-create', 10), async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  const parsed = createTokenSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
  const { name, scopes, expiresInDays } = parsed.data;
  const token = newApiToken();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;
  const rows = await sql<Array<{ id: string; createdAt: Date }>>`
    INSERT INTO api_tokens (user_id, token_hash, token_prefix, name, scopes, expires_at)
    VALUES (${user.id}, ${token.hash}, ${token.prefix}, ${name}, ${scopes as string[]}, ${expiresAt})
    RETURNING id, created_at
  `;
  const r = rows[0];
  if (!r) return c.json({ error: 'token insert failed' }, 500);
  return c.json({
    id: r.id,
    name,
    token: token.raw,
    prefix: token.prefix,
    scopes,
    createdAt: r.createdAt,
    expiresAt,
  });
});

tokensRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const rows = await sql`
    UPDATE api_tokens
      SET revoked_at = now()
      WHERE id = ${id}::UUID AND user_id = ${user.id} AND revoked_at IS NULL
      RETURNING id
  `;
  if (rows.length === 0) return c.json({ error: 'token not found' }, 404);
  return c.json({ ok: true });
});
