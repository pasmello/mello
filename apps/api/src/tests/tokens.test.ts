import { describe, expect, it } from 'vitest';
import { TOKEN_PREFIX, hashToken, newApiToken } from '../auth/tokens.ts';

describe('auth/tokens', () => {
  it('newApiToken returns a prefixed raw token and matching hash', () => {
    const { raw, hash, prefix } = newApiToken();
    expect(raw.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(hash).toBe(hashToken(raw));
    expect(hash).toHaveLength(64);
  });

  it('token prefix exposes mello_tok_ + 8 chars', () => {
    const { prefix } = newApiToken();
    expect(prefix.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(prefix.length).toBe(TOKEN_PREFIX.length + 8);
  });

  it('two tokens have different raw bytes and hashes', () => {
    const a = newApiToken();
    const b = newApiToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });

  it('hashToken is deterministic', () => {
    expect(hashToken('hello')).toBe(hashToken('hello'));
  });
});
