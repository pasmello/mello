import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { PublishRejectError } from './extract.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const specRoot = resolve(__dirname, '..', '..', '..', '..', 'spec');

type PackageType = 'tool' | 'theme' | 'workflow';

async function loadSchema(path: string): Promise<unknown> {
  const text = await readFile(path, 'utf8');
  return JSON.parse(text);
}

let cached: Promise<{
  envelope: ValidateFunction;
  manifests: Record<PackageType, ValidateFunction>;
}> | null = null;

async function compile() {
  const ajv = new Ajv({ strict: false, allErrors: true });
  addFormats.default(ajv);

  const envelopeSchema = await loadSchema(`${specRoot}/mello-package-v1.schema.json`);
  const toolSchema = await loadSchema(`${specRoot}/pasmello-manifests/tool.schema.json`);
  const themeSchema = await loadSchema(`${specRoot}/pasmello-manifests/theme.schema.json`);
  const workflowSchema = await loadSchema(`${specRoot}/pasmello-manifests/workflow.schema.json`);

  return {
    envelope: ajv.compile(envelopeSchema as object),
    manifests: {
      tool: ajv.compile(toolSchema as object),
      theme: ajv.compile(themeSchema as object),
      workflow: ajv.compile(workflowSchema as object),
    },
  };
}

async function getValidators() {
  if (!cached) cached = compile();
  return cached;
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || errors.length === 0) return '';
  return errors
    .map((e) => `${e.instancePath || '<root>'} ${e.message ?? 'invalid'}`)
    .join('; ');
}

export interface ValidatedEnvelope {
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

export async function validateEnvelope(envelope: unknown): Promise<ValidatedEnvelope> {
  const { envelope: validate } = await getValidators();
  if (!validate(envelope)) {
    throw new PublishRejectError(
      'envelope_schema_violation',
      `envelope: ${formatErrors(validate.errors)}`,
    );
  }
  return envelope as ValidatedEnvelope;
}

export async function validateManifest(type: PackageType, manifest: unknown): Promise<void> {
  const { manifests } = await getValidators();
  const validate = manifests[type];
  if (!validate(manifest)) {
    throw new PublishRejectError(
      'manifest_schema_violation',
      `${type} manifest: ${formatErrors(validate.errors)}`,
    );
  }
}

// The envelope's author.github must match the authenticated user's login
// (case-insensitive), unless the user is a co-owner of an existing package
// with that (type, scope, name). The caller resolves co-ownership — this
// function just checks the simple identity.
export function authorMatchesUser(
  envelope: ValidatedEnvelope,
  userLogin: string,
): boolean {
  return envelope.author.github.toLowerCase() === userLogin.toLowerCase()
    && envelope.scope.toLowerCase() === userLogin.toLowerCase();
}
