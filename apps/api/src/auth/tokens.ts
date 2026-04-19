import { createHash, randomBytes } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { sql } from '../db/client.ts';

export interface AuthedUser {
  id: string;
  login: string;
  role: 'user' | 'admin';
  tokenId: string;
  scopes: string[];
}

// Tokens are opaque random bytes prefixed with `mpk_` so leaked tokens are
// trivially grep-able in logs and source. We store only the sha256, never
// the raw bytes.
const TOKEN_PREFIX = 'mpk_';

export function newApiToken(): { raw: string; hash: string } {
  const raw = TOKEN_PREFIX + randomBytes(32).toString('base64url');
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

async function lookup(raw: string): Promise<AuthedUser | null> {
  if (!raw.startsWith(TOKEN_PREFIX)) return null;
  const hash = hashToken(raw);
  const rows = await sql<
    Array<{ id: string; userId: string; login: string; role: 'user' | 'admin'; scopes: string[] }>
  >`
    SELECT t.id, t.user_id, t.scopes, u.login, u.role
    FROM api_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ${hash}
      AND t.revoked_at IS NULL
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  // Fire-and-forget last_used_at update; don't block the request.
  void sql`UPDATE api_tokens SET last_used_at = now() WHERE id = ${r.id}`;
  return { id: r.userId, login: r.login, role: r.role, tokenId: r.id, scopes: r.scopes };
}

export const requireAuth: MiddlewareHandler<{ Variables: { user: AuthedUser } }> = async (
  c,
  next,
) => {
  const header = c.req.header('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) {
    return c.json({ error: 'missing bearer token' }, 401);
  }
  const raw = header.slice(7).trim();
  const user = await lookup(raw);
  if (!user) return c.json({ error: 'invalid token' }, 401);
  c.set('user', user);
  await next();
};

export const requireAdmin: MiddlewareHandler<{ Variables: { user: AuthedUser } }> = async (
  c,
  next,
) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') return c.json({ error: 'admin only' }, 403);
  await next();
};

export function requireScope(
  scope: string,
): MiddlewareHandler<{ Variables: { user: AuthedUser } }> {
  return async (c, next) => {
    const user = c.get('user');
    if (!user?.scopes.includes(scope)) {
      return c.json({ error: `missing required scope: ${scope}` }, 403);
    }
    await next();
  };
}
