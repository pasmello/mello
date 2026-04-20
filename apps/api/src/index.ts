import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { env } from './env.ts';
import { corsMiddleware } from './middleware/cors.ts';
import { readOnlyGate } from './middleware/flags.ts';
import { packagesRoutes } from './routes/packages.ts';
import { publishRoutes } from './routes/publish.ts';
import { authRoutes } from './routes/auth.ts';
import { adminRoutes } from './routes/admin.ts';
import { meRoutes, tokensRoutes } from './routes/me.ts';

const app = new Hono();

app.use('*', logger());
app.use('*', corsMiddleware);
app.use('*', readOnlyGate);

app.get('/', (c) =>
  c.json({
    name: 'mello',
    version: 1,
    docs: 'https://market.pasmello.com/docs',
  }),
);

app.get('/healthz', (c) => c.json({ ok: true }));

app.route('/auth', authRoutes);
app.route('/v1/packages', packagesRoutes);
app.route('/v1/publish', publishRoutes);
app.route('/v1/admin', adminRoutes);
app.route('/v1/me', meRoutes);
app.route('/v1/tokens', tokensRoutes);

app.notFound((c) => c.json({ error: 'not found' }, 404));

app.onError((err, c) => {
  console.error('[api] unhandled error', err);
  return c.json({ error: 'internal error' }, 500);
});

serve({ fetch: app.fetch, port: env.PORT, hostname: env.HOST }, (info) => {
  console.log(`[api] listening on ${info.address}:${info.port}`);
});
