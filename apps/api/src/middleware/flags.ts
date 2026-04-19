import type { MiddlewareHandler } from 'hono';
import { sql } from '../db/client.ts';

type FlagCache = { value: Record<string, unknown>; expiresAt: number };
let cache: FlagCache | null = null;
const TTL_MS = 5_000;

export async function getFlags(): Promise<Record<string, unknown>> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  const rows = await sql<{ key: string; value: unknown }[]>`
    SELECT key, value FROM feature_flags
  `;
  const value: Record<string, unknown> = {};
  for (const r of rows) value[r.key] = r.value;
  cache = { value, expiresAt: now + TTL_MS };
  return value;
}

export function invalidateFlagCache(): void {
  cache = null;
}

// Short-circuit surfaces at the flag level. `read_only: true` blocks every
// POST/DELETE except /v1/admin/*. Individual flags like `publish.enabled`
// guard their specific route group.
export function requireFlag(key: string): MiddlewareHandler {
  return async (c, next) => {
    const flags = await getFlags();
    if (flags[key] === false) {
      return c.json({ error: `feature ${key} is disabled` }, 503);
    }
    await next();
  };
}

export const readOnlyGate: MiddlewareHandler = async (c, next) => {
  const method = c.req.method;
  if (method === 'GET' || method === 'OPTIONS') return next();
  const path = c.req.path;
  if (path.startsWith('/v1/admin/')) return next();
  const flags = await getFlags();
  if (flags['read_only'] === true) {
    return c.json({ error: 'registry is in read-only mode' }, 503);
  }
  await next();
};
