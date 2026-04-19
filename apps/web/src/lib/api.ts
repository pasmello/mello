import { env } from '$env/dynamic/public';
import type {
  PackageDetail,
  PackageSummary,
  PackageType,
  PackageVersionDetail,
} from './types.ts';

// Single entry point for the registry API. Lives in $lib so the embed
// components (under components/Embed/) can be re-mounted from pasmello-saas
// by injecting a different base URL — independence first.
const base = () => env.PUBLIC_API_BASE ?? 'http://localhost:8787';

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(base() + path, {
    ...init,
    headers: { accept: 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`API ${path} → HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface ListResponse {
  items: PackageSummary[];
  page: number;
  pageSize: number;
}

export function listPackages(params: {
  q?: string;
  type?: PackageType;
  scope?: string;
  sort?: 'recent' | 'name';
  page?: number;
  pageSize?: number;
} = {}): Promise<ListResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  return getJson<ListResponse>(`/v1/packages${qs.size ? '?' + qs : ''}`);
}

export function getPackage(
  type: PackageType,
  scope: string,
  name: string,
): Promise<PackageDetail> {
  return getJson<PackageDetail>(`/v1/packages/${type}/${scope}/${name}`);
}

export function getVersion(
  type: PackageType,
  scope: string,
  name: string,
  version: string,
): Promise<PackageVersionDetail> {
  return getJson<PackageVersionDetail>(
    `/v1/packages/${type}/${scope}/${name}/${version}`,
  );
}

export function downloadUrl(
  type: PackageType,
  scope: string,
  name: string,
  version: string,
): string {
  return `${base()}/v1/packages/${type}/${scope}/${name}/${version}/download`;
}

export function pasmelloInstallUrl(
  pasmelloOrigin: string,
  cdnDownloadUrl: string,
): string {
  return `${pasmelloOrigin.replace(/\/$/, '')}/?install=${encodeURIComponent(cdnDownloadUrl)}`;
}
