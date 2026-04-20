import { describe, expect, it } from 'vitest';
import { envelopeAdvisories, toolPermissionAdvisories, validateEnvelope, validateManifest } from './index.ts';

const valid = {
  melloSpecVersion: '1',
  type: 'tool',
  scope: 'alice',
  name: 'clock',
  version: '0.1.0',
  description: 'a clock',
  author: { github: 'alice' },
  license: 'MIT',
};

const toolManifest = {
  id: 'clock',
  name: 'Clock',
  version: '0.1.0',
  description: 'displays the time',
  entry: 'dist/index.html',
  permissions: {
    network: ['*'],
    storage: 'read-write',
    clipboard: 'none',
    notifications: false,
    camera: true,
    geolocation: false,
  },
  actions: {},
};

describe('validateEnvelope', () => {
  it('accepts a valid envelope', () => {
    const res = validateEnvelope(valid);
    expect(res.ok).toBe(true);
    expect(res.envelope?.name).toBe('clock');
  });

  it('rejects invalid envelope', () => {
    const res = validateEnvelope({ type: 'tool' });
    expect(res.ok).toBe(false);
    expect(res.issues.length).toBeGreaterThan(0);
  });
});

describe('validateManifest', () => {
  it('accepts a valid tool manifest', () => {
    const res = validateManifest('tool', toolManifest);
    expect(res.ok).toBe(true);
  });
});

describe('envelopeAdvisories', () => {
  it('warns on tiny description + missing keywords/repository', () => {
    const adv = envelopeAdvisories(valid as never, 1024);
    expect(adv.some((a) => a.message.includes('description'))).toBe(true);
    expect(adv.some((a) => a.message.includes('keywords'))).toBe(true);
    expect(adv.some((a) => a.message.includes('repository'))).toBe(true);
  });
});

describe('toolPermissionAdvisories', () => {
  it('flags wildcard network, read-write storage, camera', () => {
    const adv = toolPermissionAdvisories(toolManifest as never);
    expect(adv.some((a) => a.message.includes('network'))).toBe(true);
    expect(adv.some((a) => a.message.includes('storage'))).toBe(true);
    expect(adv.some((a) => a.message.includes('camera'))).toBe(true);
  });
});
