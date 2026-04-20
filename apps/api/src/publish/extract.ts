import JSZip from 'jszip';

export const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024; // 20 MB — reference §6.7

export interface ExtractedPackage {
  envelope: unknown;
  manifest: unknown;
  envelopeRaw: string;
  manifestRaw: string;
  zipBytes: Uint8Array;
  sizeBytes: number;
  zip: JSZip;
  readme?: string;
}

export class PublishRejectError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PublishRejectError';
  }
}

function manifestFilenameFor(type: string): string {
  return `${type}.manifest.json`;
}

export async function extractPackage(zipBytes: Uint8Array): Promise<ExtractedPackage> {
  if (zipBytes.byteLength > MAX_ARCHIVE_BYTES) {
    throw new PublishRejectError(
      'archive_too_large',
      `archive ${zipBytes.byteLength} bytes exceeds ${MAX_ARCHIVE_BYTES}`,
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBytes);
  } catch (err) {
    throw new PublishRejectError('invalid_zip', `not a valid zip: ${(err as Error).message}`);
  }

  const envelopeFile = zip.file('mello.package.json');
  if (!envelopeFile) {
    throw new PublishRejectError('missing_envelope', 'mello.package.json not found at zip root');
  }
  const envelopeRaw = await envelopeFile.async('string');
  let envelope: { type?: string; readme?: string };
  try {
    envelope = JSON.parse(envelopeRaw) as typeof envelope;
  } catch (err) {
    throw new PublishRejectError(
      'invalid_envelope_json',
      `mello.package.json is not valid JSON: ${(err as Error).message}`,
    );
  }

  const type = envelope.type;
  if (type !== 'tool' && type !== 'theme' && type !== 'workflow') {
    throw new PublishRejectError(
      'invalid_type',
      `envelope.type must be one of tool|theme|workflow (got ${String(type)})`,
    );
  }

  const manifestName = manifestFilenameFor(type);
  const manifestFile = zip.file(manifestName);
  if (!manifestFile) {
    throw new PublishRejectError('missing_manifest', `${manifestName} not found at zip root`);
  }
  const manifestRaw = await manifestFile.async('string');
  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch (err) {
    throw new PublishRejectError(
      'invalid_manifest_json',
      `${manifestName} is not valid JSON: ${(err as Error).message}`,
    );
  }

  let readme: string | undefined;
  const readmePath = envelope.readme ?? 'README.md';
  const readmeFile = zip.file(readmePath);
  if (readmeFile) {
    readme = await readmeFile.async('string');
  }

  return {
    envelope,
    manifest,
    envelopeRaw,
    manifestRaw,
    zipBytes,
    sizeBytes: zipBytes.byteLength,
    zip,
    readme,
  };
}
