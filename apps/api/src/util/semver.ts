// Minimal semver 2.0.0 comparator. Just enough for "is A newer than B" and
// "find the highest active version". We don't need range resolution here —
// that's the CLI/host's job.

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

interface Parsed {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

function parse(v: string): Parsed | null {
  const m = SEMVER_RE.exec(v);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split('.') : [],
  };
}

function compareIdentifier(a: string, b: string): number {
  const an = /^\d+$/.test(a) ? Number(a) : null;
  const bn = /^\d+$/.test(b) ? Number(b) : null;
  if (an !== null && bn !== null) return an - bn;
  if (an !== null) return -1; // numeric < alphanumeric per semver §11
  if (bn !== null) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function comparePrerelease(a: string[], b: string[]): number {
  // Per semver: no prerelease > has prerelease.
  if (a.length === 0 && b.length === 0) return 0;
  if (a.length === 0) return 1;
  if (b.length === 0) return -1;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const c = compareIdentifier(a[i]!, b[i]!);
    if (c !== 0) return c;
  }
  return a.length - b.length;
}

/** Returns -1 | 0 | 1. Invalid versions fall back to string compare. */
export function compareSemver(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return a < b ? -1 : a > b ? 1 : 0;
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  return comparePrerelease(pa.prerelease, pb.prerelease);
}

/** Returns the newest version string from a list, or null when empty. */
export function maxSemver(versions: string[]): string | null {
  if (versions.length === 0) return null;
  let best = versions[0]!;
  for (let i = 1; i < versions.length; i++) {
    if (compareSemver(versions[i]!, best) > 0) best = versions[i]!;
  }
  return best;
}
