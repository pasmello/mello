import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../env.ts';
import { sql } from '../db/client.ts';
import {
  buildAuthorizeUrl,
  consumeOauthState,
  createOauthState,
  exchangeCodeForAccessToken,
  fetchGithubUser,
  pollDeviceFlow,
  startDeviceFlow,
  upsertUser,
} from '../auth/github.ts';
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  createSession,
  deleteSession,
  formatSessionCookie,
} from '../auth/sessions.ts';
import { rateLimit } from '../middleware/rateLimit.ts';

export const authRoutes = new Hono();

const cookieOpts = () => ({
  secure: env.SESSION_COOKIE_SECURE,
});

function parseSessionId(cookie: string | undefined): string | null {
  if (!cookie) return null;
  for (const part of cookie.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === SESSION_COOKIE_NAME) return rest.join('=');
  }
  return null;
}

// GET /auth/github — start web OAuth
authRoutes.get('/github', rateLimit('github-start', 60), async (c) => {
  const redirectTo = c.req.query('redirect_to') ?? '/';
  const state = await createOauthState(redirectTo);
  return c.redirect(buildAuthorizeUrl(state));
});

// GET /auth/github/callback — finish web OAuth, issue session cookie
authRoutes.get('/github/callback', rateLimit('github-callback', 30), async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code || !state) return c.json({ error: 'missing code or state' }, 400);
  const redirectTo = await consumeOauthState(state);
  if (!redirectTo) return c.json({ error: 'invalid or expired state' }, 400);

  try {
    const accessToken = await exchangeCodeForAccessToken(code);
    const ghUser = await fetchGithubUser(accessToken);
    const user = await upsertUser(ghUser);
    const session = await createSession(user.id);
    c.header(
      'Set-Cookie',
      formatSessionCookie(session.id, {
        ...cookieOpts(),
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    );
    const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/';
    return c.redirect(`${env.WEB_ORIGIN}${safeRedirect}`);
  } catch (err) {
    console.error('[auth/github/callback]', err);
    return c.json({ error: 'oauth failed' }, 500);
  }
});

// POST /auth/logout — invalidate session
authRoutes.post('/logout', async (c) => {
  const sid = parseSessionId(c.req.header('cookie'));
  if (sid) await deleteSession(sid);
  c.header('Set-Cookie', clearSessionCookie(cookieOpts()));
  return c.json({ ok: true });
});

// POST /auth/device/code — start CLI device flow
authRoutes.post('/device/code', rateLimit('device-code', 30), async (c) => {
  try {
    const flow = await startDeviceFlow();
    return c.json({
      device_code: flow.deviceCode,
      user_code: flow.userCode,
      verification_uri: flow.verificationUri,
      interval: flow.interval,
      expires_in: flow.expiresIn,
    });
  } catch (err) {
    console.error('[auth/device/code]', err);
    return c.json({ error: 'device flow unavailable' }, 500);
  }
});

// POST /auth/device/token — exchange completed device code for bearer token
const deviceTokenSchema = z.object({
  device_code: z.string().min(1),
  name: z.string().min(1).max(80).default('mello CLI'),
});
authRoutes.post('/device/token', rateLimit('device-token', 120), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = deviceTokenSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid body' }, 400);

  try {
    const result = await pollDeviceFlow(parsed.data.device_code, parsed.data.name);
    if (result.status === 'ok') {
      return c.json({ token: result.token, login: result.login });
    }
    if (result.status === 'pending') {
      return c.json({ error: 'authorization_pending' }, 428);
    }
    if (result.status === 'slow_down') {
      return c.json({ error: 'slow_down' }, 429);
    }
    if (result.status === 'denied') {
      return c.json({ error: 'access_denied' }, 403);
    }
    return c.json({ error: 'expired_token' }, 410);
  } catch (err) {
    console.error('[auth/device/token]', err);
    return c.json({ error: 'device flow failed' }, 500);
  }
});

// Periodic-ish cleanup for expired sessions + states. Called on every /me
// request — cheap and avoids needing a separate cron. Would move to a real
// cron once traffic warrants it.
export async function reapExpired(): Promise<void> {
  await sql`DELETE FROM sessions WHERE expires_at < now() - interval '1 day'`;
  await sql`DELETE FROM oauth_states WHERE expires_at < now() - interval '1 hour'`;
  await sql`DELETE FROM device_flows WHERE expires_at < now() - interval '1 day'`;
}
