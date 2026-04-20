import { randomBytes } from 'node:crypto';
import { sql } from '../db/client.ts';

const SESSION_TTL_DAYS = 30;
const SESSION_ID_BYTES = 32;
export const SESSION_COOKIE_NAME = 'mello_session';

export function newSessionId(): string {
  return randomBytes(SESSION_ID_BYTES).toString('base64url');
}

export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const id = newSessionId();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await sql`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (${id}, ${userId}, ${expiresAt})
  `;
  return { id, expiresAt };
}

export async function deleteSession(id: string): Promise<void> {
  await sql`DELETE FROM sessions WHERE id = ${id}`;
}

export async function refreshSession(id: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await sql`
    UPDATE sessions SET expires_at = ${expiresAt} WHERE id = ${id}
  `;
}

export interface CookieOptions {
  secure?: boolean;
  maxAgeSeconds?: number;
  sameSite?: 'Lax' | 'Strict' | 'None';
}

export function formatSessionCookie(id: string, opts: CookieOptions = {}): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${id}`,
    'HttpOnly',
    'Path=/',
    `SameSite=${opts.sameSite ?? 'Lax'}`,
  ];
  if (opts.secure ?? true) parts.push('Secure');
  if (opts.maxAgeSeconds !== undefined) parts.push(`Max-Age=${opts.maxAgeSeconds}`);
  return parts.join('; ');
}

export function clearSessionCookie(opts: CookieOptions = {}): string {
  return formatSessionCookie('', { ...opts, maxAgeSeconds: 0 });
}
