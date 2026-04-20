import type { MiddlewareHandler } from 'hono';
import { sql } from '../db/client.ts';

// Defense-in-depth for auth endpoints. Cloudflare edge is the primary line
// (applied via Terraform). This keeps us safe if a request bypasses CF or
// during local dev. Buckets are 1-minute windows.
//
// Usage:
//   app.post('/auth/device/code', rateLimit('device-code', 30), handler)
//   app.get('/auth/github/callback', rateLimit('github-callback', 20), handler)

const WINDOW_MS = 60_000;

function clientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0'
  );
}

export function rateLimit(bucket: string, limit: number): MiddlewareHandler {
  return async (c, next) => {
    const ip = clientIp(c.req.raw.headers);
    const windowStart = new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS);

    const rows = await sql<Array<{ count: number }>>`
      INSERT INTO auth_rate_limits (ip, bucket, count, window_start)
      VALUES (${ip}::INET, ${bucket}, 1, ${windowStart})
      ON CONFLICT (ip, bucket) DO UPDATE
        SET count = CASE
          WHEN auth_rate_limits.window_start < ${windowStart} THEN 1
          ELSE auth_rate_limits.count + 1
        END,
        window_start = CASE
          WHEN auth_rate_limits.window_start < ${windowStart} THEN ${windowStart}
          ELSE auth_rate_limits.window_start
        END
      RETURNING count
    `;
    const count = rows[0]?.count ?? 0;
    if (count > limit) {
      c.header('Retry-After', '60');
      return c.json({ error: 'rate limit exceeded' }, 429);
    }
    await next();
  };
}
