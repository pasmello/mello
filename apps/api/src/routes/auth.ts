import { Hono } from 'hono';

export const authRoutes = new Hono();

// Route stubs — full auth flow is build order step 5 of the plan.
// - POST /v1/auth/github/device           — device-flow start
// - POST /v1/auth/github/device/poll      — poll for completion
// - POST /v1/auth/register                — email + password (bcrypt)
// - POST /v1/auth/login                   — email + password
// - POST /v1/auth/tokens                  — create API token
// - DELETE /v1/auth/tokens/:id            — revoke

authRoutes.post('/github/device', (c) => c.json({ error: 'not implemented' }, 501));
authRoutes.post('/github/device/poll', (c) => c.json({ error: 'not implemented' }, 501));
authRoutes.post('/register', (c) => c.json({ error: 'not implemented' }, 501));
authRoutes.post('/login', (c) => c.json({ error: 'not implemented' }, 501));
authRoutes.post('/tokens', (c) => c.json({ error: 'not implemented' }, 501));
authRoutes.delete('/tokens/:id', (c) => c.json({ error: 'not implemented' }, 501));
