// @mello/plugin-spec — envelope schema + vendored Pasmello manifests + validators.
//
// Consumed by:
//   - apps/api   — full publish-pipeline validation
//   - apps/web   — client-side drag-drop publish preview
//   - packages/registry-client — as a type source
//
// Distributed under Apache 2.0 so plugin authors and third-party tooling can
// vendor it without copyleft obligations.

import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import JSZip from 'jszip';

import envelopeSchema from '../../../spec/mello-package-v1.schema.json' with { type: 'json' };
import toolSchema from '../../../spec/pasmello-manifests/tool.schema.json' with { type: 'json' };
import themeSchema from '../../../spec/pasmello-manifests/theme.schema.json' with { type: 'json' };
import workflowSchema from '../../../spec/pasmello-manifests/workflow.schema.json' with { type: 'json' };

export { envelopeSchema, toolSchema, themeSchema, workflowSchema };

export type PackageType = 'tool' | 'theme' | 'workflow';

export interface Envelope {
  melloSpecVersion: '1';
  type: PackageType;
  scope: string;
  name: string;
  version: string;
  description: string;
  author: { github: string; name?: string; url?: string };
  license: string;
  readme?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  pasmelloPluginSpecVersion?: string;
  dependencies?: Array<{ type: PackageType; name: string; range: string }>;
}

export interface ToolPermissions {
  network: string[];
  storage: 'none' | 'read' | 'read-write';
  clipboard: 'none' | 'read' | 'read-write';
  notifications: boolean;
  camera: boolean;
  geolocation: boolean;
}

let ajvCache: { envelope: ValidateFunction; manifests: Record<PackageType, ValidateFunction> } | null = null;

function compilers() {
  if (ajvCache) return ajvCache;
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats.default(ajv);
  ajvCache = {
    envelope: ajv.compile(envelopeSchema as object),
    manifests: {
      tool: ajv.compile(toolSchema as object),
      theme: ajv.compile(themeSchema as object),
      workflow: ajv.compile(workflowSchema as object),
    },
  };
  return ajvCache;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

function mapErrors(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  if (!errors) return [];
  return errors.map((e) => ({
    path: e.instancePath || '<root>',
    message: e.message ?? 'invalid',
  }));
}

export interface EnvelopeValidation {
  ok: boolean;
  envelope?: Envelope;
  issues: ValidationIssue[];
}

export function validateEnvelope(input: unknown): EnvelopeValidation {
  const { envelope } = compilers();
  if (!envelope(input)) {
    return { ok: false, issues: mapErrors(envelope.errors) };
  }
  return { ok: true, envelope: input as Envelope, issues: [] };
}

export interface ManifestValidation {
  ok: boolean;
  issues: ValidationIssue[];
}

export function validateManifest(type: PackageType, input: unknown): ManifestValidation {
  const { manifests } = compilers();
  const fn = manifests[type];
  if (!fn(input)) return { ok: false, issues: mapErrors(fn.errors) };
  return { ok: true, issues: [] };
}

export interface PackageExtract {
  ok: boolean;
  envelope?: Envelope;
  manifest?: unknown;
  readme?: string;
  issues: ValidationIssue[];
}

// Full client-side validation: opens the zip, extracts the envelope and
// nested manifest, and validates both against their schemas. Used by the
// web /publish drag-drop flow for live preview; the API side re-validates
// server-side in case the client lied.
export async function validatePackageZip(bytes: Uint8Array | ArrayBuffer | Blob): Promise<PackageExtract> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes as never);
  } catch (err) {
    return { ok: false, issues: [{ path: '<root>', message: `not a valid zip: ${(err as Error).message}` }] };
  }

  const envelopeFile = zip.file('mello.package.json');
  if (!envelopeFile) {
    return { ok: false, issues: [{ path: '<root>', message: 'mello.package.json not found' }] };
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(await envelopeFile.async('string'));
  } catch (err) {
    return { ok: false, issues: [{ path: 'mello.package.json', message: `invalid JSON: ${(err as Error).message}` }] };
  }

  const envValidation = validateEnvelope(envelope);
  if (!envValidation.ok || !envValidation.envelope) {
    return { ok: false, issues: envValidation.issues };
  }
  const env = envValidation.envelope;

  const manifestFile = zip.file(`${env.type}.manifest.json`);
  if (!manifestFile) {
    return {
      ok: false,
      envelope: env,
      issues: [{ path: '<root>', message: `${env.type}.manifest.json not found` }],
    };
  }

  let manifest: unknown;
  try {
    manifest = JSON.parse(await manifestFile.async('string'));
  } catch (err) {
    return {
      ok: false,
      envelope: env,
      issues: [{ path: `${env.type}.manifest.json`, message: `invalid JSON: ${(err as Error).message}` }],
    };
  }

  const mfValidation = validateManifest(env.type, manifest);
  if (!mfValidation.ok) {
    return { ok: false, envelope: env, manifest, issues: mfValidation.issues };
  }

  const readmeFile = zip.file(env.readme ?? 'README.md');
  const readme = readmeFile ? await readmeFile.async('string') : undefined;

  return { ok: true, envelope: env, manifest, readme, issues: [] };
}

// Non-schema advisory checks: surface warnings we want the user to see in
// the preview panel, not refuse on.
export interface Advisory {
  level: 'warn' | 'info';
  message: string;
}

export function envelopeAdvisories(envelope: Envelope, zipSizeBytes: number): Advisory[] {
  const out: Advisory[] = [];
  if (zipSizeBytes > 10 * 1024 * 1024) {
    out.push({ level: 'warn', message: `zip is ${Math.round(zipSizeBytes / (1024 * 1024))} MB — consider shrinking` });
  }
  if (!envelope.description || envelope.description.trim().length < 20) {
    out.push({ level: 'info', message: 'description is very short — users will have trouble discovering this package' });
  }
  if (!envelope.keywords?.length) {
    out.push({ level: 'info', message: 'no keywords — packages with keywords rank higher in search' });
  }
  if (!envelope.repository) {
    out.push({ level: 'info', message: 'no repository URL — consider adding one so users can report issues' });
  }
  return out;
}

export function toolPermissionAdvisories(manifest: { permissions?: ToolPermissions }): Advisory[] {
  const p = manifest.permissions;
  if (!p) return [];
  const out: Advisory[] = [];
  if (p.network.length === 0) {
    out.push({ level: 'info', message: 'no network permissions requested' });
  } else if (p.network.some((o) => o === '*')) {
    out.push({ level: 'warn', message: 'permissions.network contains "*" — this tool can reach any origin' });
  }
  if (p.storage === 'read-write') {
    out.push({ level: 'warn', message: 'tool can read AND write OPFS storage' });
  }
  if (p.camera || p.geolocation) {
    out.push({
      level: 'warn',
      message: `tool requests ${[p.camera && 'camera', p.geolocation && 'geolocation'].filter(Boolean).join(' + ')} access`,
    });
  }
  return out;
}
