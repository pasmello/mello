// Shared moderation primitives. Keep pure and side-effect-free — this
// package is imported by both the Node API and the static web app.

export type FlagKey =
  | 'publish.enabled'
  | 'download.enabled'
  | 'search.enabled'
  | 'read_only';

export const ALL_FLAG_KEYS: readonly FlagKey[] = [
  'publish.enabled',
  'download.enabled',
  'search.enabled',
  'read_only',
] as const;

export interface FlagDescriptor {
  key: FlagKey;
  label: string;
  description: string;
  /** When true, flipping this flag should require a typed confirmation. */
  destructive: boolean;
}

export const FLAG_DESCRIPTORS: Record<FlagKey, FlagDescriptor> = {
  'publish.enabled': {
    key: 'publish.enabled',
    label: 'Publish enabled',
    description: 'When off, /v1/publish returns 503 for all users.',
    destructive: false,
  },
  'download.enabled': {
    key: 'download.enabled',
    label: 'Downloads enabled',
    description: 'When off, download-redirect endpoints return 503.',
    destructive: true,
  },
  'search.enabled': {
    key: 'search.enabled',
    label: 'Search enabled',
    description: 'When off, /v1/packages?q= ignores the query param and returns 503.',
    destructive: false,
  },
  read_only: {
    key: 'read_only',
    label: 'Read-only mode',
    description: 'Blocks every non-GET request except /v1/admin/*. Global kill switch.',
    destructive: true,
  },
};

export function validateFlagValue(key: FlagKey, value: unknown): boolean {
  switch (key) {
    case 'publish.enabled':
    case 'download.enabled':
    case 'search.enabled':
    case 'read_only':
      return typeof value === 'boolean';
  }
}

export type TakedownReason =
  | 'malware'
  | 'trademark'
  | 'copyright'
  | 'dmca'
  | 'spam'
  | 'terms-violation'
  | 'other';

export const TAKEDOWN_REASONS: readonly TakedownReason[] = [
  'malware',
  'trademark',
  'copyright',
  'dmca',
  'spam',
  'terms-violation',
  'other',
];
