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

// Tokens are opaque random bytes prefixed with `mello_tok_` so leaked tokens
// are trivially grep-able in logs and source. We store only the sha256, never
// the raw bytes. The first 8 chars of the raw token are stored separately as
// `token_prefix` for dashboard display.
export const TOKEN_PREFIX = 'mello_tok_';
const TOKEN_DISPLAY_PREFIX_LENGTH = 8;

export interface NewToken {
  raw: string;
  hash: string;
  prefix: string;
}

export function newApiToken(): NewToken {
  const raw = TOKEN_PREFIX + randomBytes(32).toString('base64url');
  return {
    raw,
    hash: hashToken(raw),
    prefix: raw.slice(0, TOKEN_PREFIX.length + TOKEN_DISPLAY_PREFIX_LENGTH),
  };
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

async function lookupBearer(raw: string): Promise<AuthedUser | null> {
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
      AND (t.expires_at IS NULL OR t.expires_at > now())
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  void sql`UPDATE api_tokens SET last_used_at = now() WHERE id = ${r.id}`;
  return { id: r.userId, login: r.login, role: r.role, tokenId: r.id, scopes: r.scopes };
}

// Sessions produce AuthedUser with an empty scopes array — session auth implies
// full user capabilities (publish, yank, manage tokens, etc.), but admin routes
// still check role separately.
async function lookupSession(sessionId: string): Promise<AuthedUser | null> {
  const rows = await sql<
    Array<{ userId: string; login: string; role: 'user' | 'admin' }>
  >`
    SELECT s.user_id, u.login, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ${sessionId}
      AND s.expires_at > now()
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.userId,
    login: r.login,
    role: r.role,
    tokenId: `session:${sessionId.slice(0, 8)}`,
    scopes: ['publish', 'yank', 'manage', 'admin'],
  };
}

function parseSessionCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === 'mello_session') return rest.join('=');
  }
  return null;
}

export const requireAuth: MiddlewareHandler<{ Variables: { user: AuthedUser } }> = async (
  c,
  next,
) => {
  const bearer = c.req.header('authorization');
  if (bearer?.toLowerCase().startsWith('bearer ')) {
    const user = await lookupBearer(bearer.slice(7).trim());
    if (user) {
      c.set('user', user);
      return next();
    }
    return c.json({ error: 'invalid token' }, 401);
  }
  const sid = parseSessionCookie(c.req.header('cookie'));
  if (sid) {
    const user = await lookupSession(sid);
    if (user) {
      c.set('user', user);
      return next();
    }
  }
  return c.json({ error: 'authentication required' }, 401);
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
