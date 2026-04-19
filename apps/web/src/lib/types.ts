export type PackageType = 'tool' | 'theme' | 'workflow';

export interface PackageSummary {
  type: PackageType;
  scope: string;
  name: string;
  fullName: string;
  latestVersion: string | null;
  description: string;
  tier: 'free' | 'paid';
  updatedAt: string;
}

export interface PackageVersion {
  version: string;
  sha256: string;
  sizeBytes: number;
  status: 'active' | 'yanked';
  publishedAt: string;
}

export interface PackageDetail extends PackageSummary {
  status: 'active' | 'yanked' | 'taken_down';
  homepage: string | null;
  repository: string | null;
  keywords: string[];
  createdAt: string;
  versions: PackageVersion[];
}

// Matches pasmello/packages/shared/src/tool.ts (vendored).
export interface ToolPermissions {
  network: string[];
  storage: 'none' | 'read' | 'read-write';
  clipboard: 'none' | 'read' | 'read-write';
  notifications: boolean;
  camera: boolean;
  geolocation: boolean;
}

export interface ToolManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  entry: string;
  permissions: ToolPermissions;
  actions: Record<string, { description: string; inputs: Record<string, string>; outputs: Record<string, string> }>;
}

export interface PackageVersionDetail {
  type: PackageType;
  scope: string;
  name: string;
  version: string;
  sha256: string;
  sizeBytes: number;
  publishedAt: string;
  envelope: unknown;
  manifest: ToolManifest | Record<string, unknown>;
  downloadUrl: string;
}
