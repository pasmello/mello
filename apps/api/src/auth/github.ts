import { randomBytes } from 'node:crypto';
import { sql } from '../db/client.ts';
import { env } from '../env.ts';
import { newApiToken } from './tokens.ts';

const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN = 'https://github.com/login/oauth/access_token';
const GITHUB_USER = 'https://api.github.com/user';
const GITHUB_DEVICE_CODE = 'https://github.com/login/device/code';
const GITHUB_DEVICE_TOKEN = 'https://github.com/login/oauth/access_token';

const DEVICE_FLOW_TTL_MS = 15 * 60 * 1000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

interface GithubUser {
  id: number;
  login: string;
  email: string | null;
  avatar_url: string;
}

function requireGithubCreds(): { clientId: string; clientSecret: string } {
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not configured');
  }
  return { clientId, clientSecret };
}

// ---- web OAuth flow (session cookie) ----

export async function createOauthState(redirectTo: string): Promise<string> {
  const state = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);
  await sql`
    INSERT INTO oauth_states (state, redirect_to, expires_at)
    VALUES (${state}, ${redirectTo}, ${expiresAt})
  `;
  return state;
}

export async function consumeOauthState(state: string): Promise<string | null> {
  const rows = await sql<Array<{ redirectTo: string }>>`
    DELETE FROM oauth_states
    WHERE state = ${state} AND expires_at > now()
    RETURNING redirect_to
  `;
  return rows[0]?.redirectTo ?? null;
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId } = requireGithubCreds();
  const callback = env.GITHUB_OAUTH_CALLBACK_URL ?? `${env.WEB_ORIGIN}/auth/github/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback,
    scope: 'read:user user:email',
    state,
    allow_signup: 'true',
  });
  return `${GITHUB_AUTHORIZE}?${params}`;
}

export async function exchangeCodeForAccessToken(code: string): Promise<string> {
  const { clientId, clientSecret } = requireGithubCreds();
  const res = await fetch(GITHUB_TOKEN, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });
  if (!res.ok) throw new Error(`github token exchange failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(data.error ?? 'no access_token in response');
  return data.access_token;
}

export async function fetchGithubUser(accessToken: string): Promise<GithubUser> {
  const res = await fetch(GITHUB_USER, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'mello-registry',
    },
  });
  if (!res.ok) throw new Error(`github /user failed: ${res.status}`);
  return (await res.json()) as GithubUser;
}

// Upsert the user row, returning the local uuid. Promotes login to admin
// role based on ADMIN_LOGINS env var.
export async function upsertUser(gh: GithubUser): Promise<{ id: string; login: string; role: 'user' | 'admin' }> {
  const login = gh.login.toLowerCase();
  const role = env.ADMIN_LOGINS.includes(login) ? 'admin' : 'user';
  const rows = await sql<Array<{ id: string; login: string; role: 'user' | 'admin' }>>`
    INSERT INTO users (github_id, login, email, avatar_url, role)
    VALUES (${gh.id}, ${login}, ${gh.email}, ${gh.avatar_url}, ${role})
    ON CONFLICT (github_id) DO UPDATE
      SET login = EXCLUDED.login,
          email = EXCLUDED.email,
          avatar_url = EXCLUDED.avatar_url,
          role = EXCLUDED.role,
          updated_at = now()
    RETURNING id, login, role
  `;
  const r = rows[0];
  if (!r) throw new Error('upsert user returned no rows');
  return r;
}

// ---- device flow (CLI) ----

interface DeviceFlowStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  expiresIn: number;
}

export async function startDeviceFlow(): Promise<DeviceFlowStart> {
  const { clientId } = requireGithubCreds();
  const res = await fetch(GITHUB_DEVICE_CODE, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      scope: 'read:user user:email',
    }),
  });
  if (!res.ok) throw new Error(`github device/code failed: ${res.status}`);
  const data = (await res.json()) as {
    device_code: string;
    user_code: string;
    verification_uri: string;
    expires_in: number;
    interval: number;
  };
  const expiresAt = new Date(Date.now() + Math.min(data.expires_in * 1000, DEVICE_FLOW_TTL_MS));
  await sql`
    INSERT INTO device_flows (device_code, user_code, verification_uri, interval_seconds, expires_at)
    VALUES (${data.device_code}, ${data.user_code}, ${data.verification_uri}, ${data.interval}, ${expiresAt})
  `;
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    interval: data.interval,
    expiresIn: data.expires_in,
  };
}

export type DevicePollResult =
  | { status: 'pending' }
  | { status: 'slow_down' }
  | { status: 'expired' }
  | { status: 'denied' }
  | { status: 'ok'; token: string; login: string };

export async function pollDeviceFlow(deviceCode: string, tokenName: string): Promise<DevicePollResult> {
  const rows = await sql<Array<{ expiresAt: Date }>>`
    SELECT expires_at FROM device_flows
    WHERE device_code = ${deviceCode}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return { status: 'expired' };
  if (row.expiresAt.getTime() < Date.now()) return { status: 'expired' };

  const { clientId } = requireGithubCreds();
  const res = await fetch(GITHUB_DEVICE_TOKEN, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });
  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
  };

  if (data.error === 'authorization_pending') return { status: 'pending' };
  if (data.error === 'slow_down') return { status: 'slow_down' };
  if (data.error === 'expired_token') return { status: 'expired' };
  if (data.error === 'access_denied') return { status: 'denied' };
  if (!data.access_token) return { status: 'pending' };

  const ghUser = await fetchGithubUser(data.access_token);
  const user = await upsertUser(ghUser);
  const token = newApiToken();
  await sql`
    INSERT INTO api_tokens (user_id, token_hash, token_prefix, name, scopes)
    VALUES (${user.id}, ${token.hash}, ${token.prefix}, ${tokenName}, ARRAY['publish', 'yank', 'manage']::TEXT[])
  `;
  await sql`
    UPDATE device_flows
      SET approved_user_id = ${user.id}, redeemed_at = now()
      WHERE device_code = ${deviceCode}
  `;
  return { status: 'ok', token: token.raw, login: user.login };
}
