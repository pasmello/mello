import { S3Client } from '@aws-sdk/client-s3';
import { env } from '../env.ts';

// R2 exposes an S3-compatible API. In prod S3_ENDPOINT points at
// https://<account>.r2.cloudflarestorage.com; in dev it points at MinIO.
export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

// Content-addressable layout. Callers must have already validated that
// type/scope/name/version match the published row.
export function packageKey(params: {
  type: string;
  scope: string;
  name: string;
  version: string;
  sha256: string;
}): string {
  const { type, scope, name, version, sha256 } = params;
  return `packages/${type}/${scope}/${name}/${version}/${sha256}.zip`;
}

// Public CDN URL. The bucket is fronted by cdn.pasmello.com in prod.
export function publicDownloadUrl(r2Key: string): string {
  return `${env.CDN_BASE_URL.replace(/\/$/, '')}/${r2Key}`;
}
