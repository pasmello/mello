// Auth store. Session lives in an HttpOnly cookie the API sets during the
// OAuth callback; we never see the cookie value. We detect login state by
// calling /v1/me — if it returns a user, we're authed. Logout POSTs
// /auth/logout and clears the cached user.

import { RegistryClient, RegistryError, type MeUser } from '@mello/registry-client';
import { env } from '$env/dynamic/public';

export const apiBase = (): string =>
  env.PUBLIC_API_URL ?? env.PUBLIC_API_BASE ?? 'http://localhost:8787';

export function makeClient(token?: string): RegistryClient {
  return new RegistryClient({
    baseUrl: apiBase(),
    token,
    credentials: 'include',
  });
}

interface AuthState {
  status: 'loading' | 'anon' | 'authed';
  user: MeUser | null;
  error: string | null;
}

const state: AuthState = $state({ status: 'loading', user: null, error: null });

export const auth = {
  get status() {
    return state.status;
  },
  get user() {
    return state.user;
  },
  get error() {
    return state.error;
  },
  async load(): Promise<void> {
    const client = makeClient();
    try {
      const me = await client.me();
      state.status = 'authed';
      state.user = me;
      state.error = null;
    } catch (err) {
      if (err instanceof RegistryError && err.status === 401) {
        state.status = 'anon';
        state.user = null;
        state.error = null;
      } else {
        state.status = 'anon';
        state.user = null;
        state.error = (err as Error).message;
      }
    }
  },
  async logout(): Promise<void> {
    try {
      await makeClient().logout();
    } catch {
      // Best-effort — server cleanup may fail but we still clear local state.
    }
    state.status = 'anon';
    state.user = null;
  },
  githubLoginUrl(redirectTo: string): string {
    return makeClient().startGithubLogin(redirectTo);
  },
};

export function currentPasmelloOrigin(): string {
  return env.PUBLIC_PASMELLO_ORIGIN ?? 'https://pasmello.com';
}
