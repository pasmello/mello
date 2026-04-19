import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db/client.ts';
import { requireAuth, requireAdmin, type AuthedUser } from '../auth/tokens.ts';
import { invalidateFlagCache } from '../middleware/flags.ts';

export const adminRoutes = new Hono<{ Variables: { user: AuthedUser } }>();

adminRoutes.use('*', requireAuth);
adminRoutes.use('*', requireAdmin);

adminRoutes.post('/packages/:id/takedown', async (c) => {
  const id = c.req.param('id');
  const rows = await sql`
    UPDATE packages SET status = 'taken_down', updated_at = now()
    WHERE id = ${id}
    RETURNING id
  `;
  if (rows.length === 0) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

adminRoutes.post('/flags', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  const parsed = z.record(z.string(), z.unknown()).safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
  for (const [key, value] of Object.entries(parsed.data)) {
    await sql`
      INSERT INTO feature_flags (key, value, updated_by)
      VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${user.id})
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_at = now(),
            updated_by = EXCLUDED.updated_by
    `;
  }
  invalidateFlagCache();
  return c.json({ ok: true });
});
