import { describe, expect, it } from 'vitest';
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  formatSessionCookie,
  newSessionId,
} from '../auth/sessions.ts';

describe('auth/sessions', () => {
  it('newSessionId produces distinct base64url strings', () => {
    const a = newSessionId();
    const b = newSessionId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('formatSessionCookie includes HttpOnly + SameSite=Lax by default', () => {
    const c = formatSessionCookie('abc', { secure: true, maxAgeSeconds: 60 });
    expect(c).toContain(`${SESSION_COOKIE_NAME}=abc`);
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Secure');
    expect(c).toContain('Max-Age=60');
    expect(c).toContain('Path=/');
  });

  it('clearSessionCookie sets Max-Age=0', () => {
    const c = clearSessionCookie({ secure: false });
    expect(c).toContain('Max-Age=0');
    expect(c).not.toContain('Secure');
  });
});
