import { describe, expect, it } from 'vitest';
import { compareSemver, maxSemver } from '../util/semver.ts';

describe('compareSemver', () => {
  it('numeric components compare numerically', () => {
    expect(compareSemver('0.10.0', '0.2.0')).toBeGreaterThan(0);
    expect(compareSemver('2.0.0', '10.0.0')).toBeLessThan(0);
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
  });

  it('prerelease is lower than no prerelease', () => {
    expect(compareSemver('1.0.0-alpha', '1.0.0')).toBeLessThan(0);
    expect(compareSemver('1.0.0', '1.0.0-alpha')).toBeGreaterThan(0);
  });

  it('compares prerelease identifiers', () => {
    expect(compareSemver('1.0.0-alpha.1', '1.0.0-alpha.2')).toBeLessThan(0);
    expect(compareSemver('1.0.0-alpha.10', '1.0.0-alpha.2')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
    expect(compareSemver('1.0.0-alpha.1', '1.0.0-alpha.beta')).toBeLessThan(0);
  });

  it('ignores build metadata for ordering', () => {
    // semver §10: build metadata must be ignored when comparing. We match
    // that behavior by stripping it in the regex.
    expect(compareSemver('1.0.0+meta', '1.0.0+other')).toBe(0);
  });

  it('invalid versions fall back to string compare', () => {
    expect(compareSemver('abc', 'xyz')).toBeLessThan(0);
  });
});

describe('maxSemver', () => {
  it('returns the highest version', () => {
    expect(maxSemver(['0.1.0', '0.10.0', '0.2.0', '0.9.9'])).toBe('0.10.0');
  });

  it('prefers release over prerelease of the same triple', () => {
    expect(maxSemver(['1.0.0-rc.1', '1.0.0', '1.0.0-alpha'])).toBe('1.0.0');
  });

  it('returns null for empty input', () => {
    expect(maxSemver([])).toBeNull();
  });
});
