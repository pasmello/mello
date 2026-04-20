import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { MAX_ARCHIVE_BYTES, PublishRejectError, extractPackage } from '../publish/extract.ts';
import { auditArchive } from '../publish/safety.ts';
import { validateEnvelope, validateManifest, authorMatchesUser } from '../publish/validate.ts';
import { sha256Hex } from '../publish/store.ts';

async function expectRejectCode(p: Promise<unknown>, code: string): Promise<void> {
  let err: unknown;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(PublishRejectError);
  expect((err as PublishRejectError).code).toBe(code);
}

function validEnvelope(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    melloSpecVersion: '1',
    type: 'tool',
    scope: 'alice',
    name: 'clock',
    version: '0.1.0',
    description: 'a clock',
    author: { github: 'alice' },
    license: 'MIT',
    ...overrides,
  };
}

function validToolManifest(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'clock',
    name: 'Clock',
    version: '0.1.0',
    description: 'displays the time',
    entry: 'dist/index.html',
    permissions: {
      network: [],
      storage: 'none',
      clipboard: 'none',
      notifications: false,
      camera: false,
      geolocation: false,
    },
    actions: {},
    ...overrides,
  };
}

async function buildZip(contents: Record<string, string | Uint8Array>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [path, body] of Object.entries(contents)) {
    zip.file(path, body as string);
  }
  const out = await zip.generateAsync({ type: 'uint8array' });
  return out;
}

describe('publish/extract', () => {
  it('extracts envelope + tool manifest', async () => {
    const zip = await buildZip({
      'mello.package.json': JSON.stringify(validEnvelope()),
      'tool.manifest.json': JSON.stringify(validToolManifest()),
      'dist/index.html': '<!doctype html><html></html>',
    });
    const pkg = await extractPackage(zip);
    expect(pkg.sizeBytes).toBe(zip.byteLength);
    expect((pkg.envelope as { name: string }).name).toBe('clock');
    expect((pkg.manifest as { id: string }).id).toBe('clock');
  });

  it('rejects when archive exceeds size cap', async () => {
    const fake = new Uint8Array(MAX_ARCHIVE_BYTES + 1);
    await expectRejectCode(extractPackage(fake), 'archive_too_large');
  });

  it('rejects missing mello.package.json', async () => {
    const zip = await buildZip({ 'tool.manifest.json': '{}' });
    await expectRejectCode(extractPackage(zip), 'missing_envelope');
  });

  it('rejects missing nested manifest', async () => {
    const zip = await buildZip({
      'mello.package.json': JSON.stringify(validEnvelope()),
    });
    await expectRejectCode(extractPackage(zip), 'missing_manifest');
  });

  it('rejects envelope with bad JSON', async () => {
    const zip = await buildZip({ 'mello.package.json': '{not json' });
    await expectRejectCode(extractPackage(zip), 'invalid_envelope_json');
  });

  it('rejects unknown envelope type', async () => {
    const zip = await buildZip({
      'mello.package.json': JSON.stringify(validEnvelope({ type: 'skill' })),
    });
    await expectRejectCode(extractPackage(zip), 'invalid_type');
  });
});

describe('publish/safety', () => {
  it('passes a clean zip', async () => {
    const zip = await buildZip({
      'mello.package.json': JSON.stringify(validEnvelope()),
      'tool.manifest.json': JSON.stringify(validToolManifest()),
      'dist/index.html': '<!doctype html>',
    });
    const pkg = await extractPackage(zip);
    const report = await auditArchive(pkg.zip);
    expect(report.ok).toBe(true);
  });

  // Note: JSZip's file() API normalizes `../foo` and absolute paths on
  // insert, so we can't construct an in-test traversal zip through the
  // normal API. The path-traversal branch of auditArchive is covered via
  // real malicious-zip fixtures in the integration suite once we have one.

  it('rejects ELF executables', async () => {
    const elf = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0, 0, 0, 0]);
    const zip = await buildZip({
      'mello.package.json': JSON.stringify(validEnvelope()),
      'tool.manifest.json': JSON.stringify(validToolManifest()),
      'dist/payload': elf,
    });
    const pkg = await extractPackage(zip);
    const report = await auditArchive(pkg.zip);
    expect(report.ok).toBe(false);
    expect(report.reasons.some((r) => r.includes('ELF'))).toBe(true);
  });
});

describe('publish/validate', () => {
  it('accepts a valid envelope', async () => {
    const env = await validateEnvelope(validEnvelope());
    expect(env.name).toBe('clock');
  });

  it('rejects envelope missing required fields', async () => {
    await expectRejectCode(validateEnvelope({ type: 'tool' }), 'envelope_schema_violation');
  });

  it('rejects envelope with scope that is not a valid github login', async () => {
    await expectRejectCode(
      validateEnvelope(validEnvelope({ scope: 'Alice' })),
      'envelope_schema_violation',
    );
  });

  it('accepts a valid tool manifest', async () => {
    await expect(validateManifest('tool', validToolManifest())).resolves.toBeUndefined();
  });

  it('rejects tool manifest missing permissions', async () => {
    const { permissions: _, ...without } = validToolManifest();
    await expectRejectCode(validateManifest('tool', without), 'manifest_schema_violation');
  });

  it('authorMatchesUser is case-insensitive and requires scope match', async () => {
    const env = await validateEnvelope(validEnvelope({ author: { github: 'Alice' } }));
    expect(authorMatchesUser(env, 'alice')).toBe(true);
    expect(authorMatchesUser(env, 'bob')).toBe(false);
  });
});

describe('publish/store sha256Hex', () => {
  it('returns hex-encoded sha256', () => {
    const out = sha256Hex(new TextEncoder().encode('hello'));
    expect(out).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });
});
