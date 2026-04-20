// @mello/registry-client — typed HTTP wrapper for the mello registry API.
// Consumed by apps/web (and by any external tool that wants to talk to the
// API from JS). Apache 2.0.

import type { Envelope, PackageType } from '@mello/plugin-spec';

export interface ClientOptions {
  /** Base URL for the API. Default: https://registry.pasmello.com */
  baseUrl?: string;
  /** Bearer token for write endpoints. Web clients typically use cookies instead. */
  token?: string;
  /** Include credentials (cookies) on requests — required for session auth. */
  credentials?: RequestCredentials;
  /** Override the fetch implementation (useful for testing / SSR). */
  fetch?: typeof fetch;
}

export class RegistryError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'RegistryError';
  }
}

export interface PackageSummary {
  id: string;
  type: PackageType;
  scope: string;
  name: string;
  fullName: string;
  description: string;
  latestVersion: string | null;
  tier: 'free' | 'paid';
  updatedAt: string;
  keywords: string[];
}

export interface PackageVersion {
  version: string;
  sha256: string;
  sizeBytes: number;
  publishedAt: string;
  status: 'active' | 'yanked';
  yankedReason?: string | null;
}

export interface PackageDetail extends PackageSummary {
  versions: PackageVersion[];
  manifest: unknown;
  envelope: Envelope;
  readme?: string;
  homepage?: string | null;
  repository?: string | null;
  downloadUrl: string;
}

export interface ListParams {
  q?: string;
  type?: PackageType;
  scope?: string;
  sort?: 'updated' | 'created' | 'name';
  page?: number;
  pageSize?: number;
}

export interface MeUser {
  id: string;
  login: string;
  email: string | null;
  avatarUrl: string | null;
  role: 'user' | 'admin';
}

export interface Token {
  id: string;
  name: string;
  tokenPrefix: string | null;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export interface NewTokenResponse extends Token {
  token: string;
}

export class RegistryClient {
  readonly baseUrl: string;
  readonly token: string | undefined;
  readonly credentials: RequestCredentials;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? 'https://registry.pasmello.com').replace(/\/$/, '');
    this.token = opts.token;
    this.credentials = opts.credentials ?? 'include';
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      accept: 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    };
    if (this.token) {
      (headers as Record<string, string>)['authorization'] = `Bearer ${this.token}`;
    }
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: this.credentials,
    });
    if (res.status === 204) return undefined as T;
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
    const body = isJson ? await res.json() : await res.text();
    if (!res.ok) {
      const b = body as { error?: string; detail?: string };
      throw new RegistryError(
        res.status,
        b?.error ?? 'request_failed',
        b?.detail ?? `HTTP ${res.status}`,
        body,
      );
    }
    return body as T;
  }

  // ---- Read ----

  listPackages(params: ListParams = {}): Promise<{ packages: PackageSummary[]; page: number; pageSize: number; total: number }> {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.type) qs.set('type', params.type);
    if (params.scope) qs.set('scope', params.scope);
    if (params.sort) qs.set('sort', params.sort);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    const suffix = qs.toString() ? `?${qs}` : '';
    return this.req(`/v1/packages${suffix}`);
  }

  getPackage(type: PackageType, scope: string, name: string): Promise<PackageDetail> {
    return this.req(`/v1/packages/${type}/${scope}/${name}`);
  }

  getVersion(type: PackageType, scope: string, name: string, version: string): Promise<PackageDetail> {
    return this.req(`/v1/packages/${type}/${scope}/${name}/${version}`);
  }

  downloadUrl(type: PackageType, scope: string, name: string, version: string): string {
    return `${this.baseUrl}/v1/download/${type}/${scope}/${name}/${version}`;
  }

  pasmelloInstallUrl(params: { origin: string; downloadUrl: string }): string {
    const base = params.origin.replace(/\/$/, '');
    return `${base}/?install=${encodeURIComponent(params.downloadUrl)}`;
  }

  // ---- Account ----

  me(): Promise<MeUser> {
    return this.req('/v1/me');
  }

  myPackages(): Promise<{ packages: Array<PackageSummary & { ownerRole: string; status: string }> }> {
    return this.req('/v1/me/packages');
  }

  myTokens(): Promise<{ tokens: Token[] }> {
    return this.req('/v1/me/tokens');
  }

  createToken(body: { name: string; scopes?: string[]; expiresInDays?: number }): Promise<NewTokenResponse> {
    return this.req('/v1/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  revokeToken(id: string): Promise<{ ok: boolean }> {
    return this.req(`/v1/tokens/${id}`, { method: 'DELETE' });
  }

  logout(): Promise<{ ok: boolean }> {
    return this.req('/auth/logout', { method: 'POST' });
  }

  startGithubLogin(redirectTo = '/'): string {
    return `${this.baseUrl}/auth/github?redirect_to=${encodeURIComponent(redirectTo)}`;
  }

  // ---- Write ----

  async publish(zip: Blob | ArrayBuffer | Uint8Array): Promise<{
    ok: boolean;
    packageId: string;
    versionId: string;
    type: PackageType;
    scope: string;
    name: string;
    version: string;
    sha256: string;
    sizeBytes: number;
    downloadUrl: string;
  }> {
    const form = new FormData();
    const blob = zip instanceof Blob ? zip : new Blob([zip as ArrayBuffer], { type: 'application/zip' });
    form.append('zip', blob, 'package.zip');
    return this.req('/v1/publish', { method: 'POST', body: form });
  }

  yank(type: PackageType, scope: string, name: string, version: string, reason?: string): Promise<{ ok: boolean; latestVersion: string | null }> {
    return this.req(`/v1/packages/${type}/${scope}/${name}/yank/${version}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
  }

  unyank(type: PackageType, scope: string, name: string, version: string): Promise<{ ok: boolean; latestVersion: string | null }> {
    return this.req(`/v1/packages/${type}/${scope}/${name}/unyank/${version}`, { method: 'POST' });
  }

  listOwners(type: PackageType, scope: string, name: string): Promise<{ owners: Array<{ login: string; role: 'owner' | 'co-owner'; addedAt: string | null }> }> {
    return this.req(`/v1/packages/${type}/${scope}/${name}/owners`);
  }

  addOwner(type: PackageType, scope: string, name: string, login: string): Promise<{ ok: boolean }> {
    return this.req(`/v1/packages/${type}/${scope}/${name}/owners`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login }),
    });
  }

  removeOwner(type: PackageType, scope: string, name: string, login: string): Promise<{ ok: boolean }> {
    return this.req(`/v1/packages/${type}/${scope}/${name}/owners/${login}`, { method: 'DELETE' });
  }

  // ---- Device flow (used mostly by the Rust CLI; exposed here for completeness) ----

  startDeviceFlow(): Promise<{ device_code: string; user_code: string; verification_uri: string; interval: number; expires_in: number }> {
    return this.req('/auth/device/code', { method: 'POST' });
  }

  pollDeviceFlow(deviceCode: string, name = 'mello CLI'): Promise<{ token: string; login: string }> {
    return this.req('/auth/device/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_code: deviceCode, name }),
    });
  }
}

// Convenience: module-level default client bound to the production registry.
export const mello = new RegistryClient();
