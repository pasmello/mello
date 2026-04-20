import { createHash } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../env.ts';
import { sql } from '../db/client.ts';
import { packageKey, s3 } from '../r2/client.ts';
import { PublishRejectError } from './extract.ts';
import type { ValidatedEnvelope } from './validate.ts';

export interface StoreInput {
  user: { id: string; login: string };
  envelope: ValidatedEnvelope;
  manifest: unknown;
  description: string;
  keywords: string[];
  zipBytes: Uint8Array;
}

export interface StoredVersion {
  packageId: string;
  versionId: string;
  sha256: string;
  sizeBytes: number;
  r2Key: string;
  downloadUrl: string;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function storePackageVersion(input: StoreInput): Promise<StoredVersion> {
  const { user, envelope, manifest, description, keywords, zipBytes } = input;
  const sha256 = sha256Hex(zipBytes);
  const r2Key = packageKey({
    type: envelope.type,
    scope: envelope.scope,
    name: envelope.name,
    version: envelope.version,
    sha256,
  });

  // Upload to R2 FIRST. If the DB transaction later fails, we have an orphan
  // object — but the key is content-addressable so a retry will PUT to the
  // same key (idempotent) and GC can sweep unreferenced keys later.
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: r2Key,
      Body: zipBytes,
      ContentType: 'application/zip',
      ContentLength: zipBytes.byteLength,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  const result = await sql.begin(async (tx) => {
    // Find-or-insert the package row.
    const existing = await tx<
      Array<{ id: string; ownerId: string; status: string }>
    >`
      SELECT id, owner_id, status
      FROM packages
      WHERE type = ${envelope.type}
        AND scope = ${envelope.scope}
        AND name = ${envelope.name}
      FOR UPDATE
    `;

    let packageId: string;
    if (existing.length > 0) {
      const r = existing[0]!;
      if (r.status === 'taken_down') {
        throw new PublishRejectError('taken_down', 'package has been taken down');
      }
      packageId = r.id;

      const ownerCheck = await tx<Array<{ role: string }>>`
        SELECT role FROM package_owners
        WHERE package_id = ${packageId} AND user_id = ${user.id}
      `;
      if (r.ownerId !== user.id && ownerCheck.length === 0) {
        throw new PublishRejectError(
          'not_owner',
          `@${envelope.scope}/${envelope.name} is owned by another user`,
        );
      }

      await tx`
        UPDATE packages
          SET description = ${description},
              keywords = ${keywords as string[]},
              homepage = ${envelope.homepage ?? null},
              repository = ${envelope.repository ?? null},
              updated_at = now()
          WHERE id = ${packageId}
      `;
    } else {
      const rows = await tx<Array<{ id: string }>>`
        INSERT INTO packages (type, scope, name, owner_id, description, keywords, homepage, repository, latest_version)
        VALUES (
          ${envelope.type},
          ${envelope.scope},
          ${envelope.name},
          ${user.id},
          ${description},
          ${keywords as string[]},
          ${envelope.homepage ?? null},
          ${envelope.repository ?? null},
          ${envelope.version}
        )
        RETURNING id
      `;
      packageId = rows[0]!.id;

      await tx`
        INSERT INTO package_owners (package_id, user_id, role)
        VALUES (${packageId}, ${user.id}, 'owner')
      `;
    }

    // Insert the version. Unique constraint on (package_id, version) makes
    // republish-same-version a hard error. Content-addressable key means
    // identical bytes dedupe in R2 but the DB row is still rejected — that's
    // intentional so consumers can't silently get a re-uploaded build.
    const exists = await tx<Array<{ id: string }>>`
      SELECT id FROM versions
      WHERE package_id = ${packageId} AND version = ${envelope.version}
    `;
    if (exists.length > 0) {
      throw new PublishRejectError(
        'version_exists',
        `version ${envelope.version} already published`,
      );
    }

    const versionRows = await tx<Array<{ id: string }>>`
      INSERT INTO versions (
        package_id, version, sha256, size_bytes,
        manifest_json, envelope_json, r2_key,
        published_by
      ) VALUES (
        ${packageId},
        ${envelope.version},
        ${sha256},
        ${zipBytes.byteLength},
        ${JSON.stringify(manifest)}::JSONB,
        ${JSON.stringify(envelope)}::JSONB,
        ${r2Key},
        ${user.id}
      )
      RETURNING id
    `;
    const versionId = versionRows[0]!.id;

    // Dependencies are declared in the envelope; split the @scope/name
    // shape back out for storage so we can query without parsing strings.
    if (envelope.dependencies?.length) {
      for (const dep of envelope.dependencies) {
        const m = /^@([^/]+)\/(.+)$/.exec(dep.name);
        if (!m) continue;
        await tx`
          INSERT INTO version_dependencies
            (version_id, depends_on_type, depends_on_scope, depends_on_name, range)
          VALUES
            (${versionId}, ${dep.type}, ${m[1]!}, ${m[2]!}, ${dep.range})
        `;
      }
    }

    // Promote latest_version if this version sorts highest. For MVP we just
    // bump when the new version string is lexicographically greater than the
    // current one — semver-correct comparison can replace this later.
    await tx`
      UPDATE packages
        SET latest_version = ${envelope.version},
            updated_at = now()
        WHERE id = ${packageId}
          AND (latest_version IS NULL OR ${envelope.version} > latest_version)
    `;

    return { packageId, versionId };
  });

  return {
    packageId: result.packageId,
    versionId: result.versionId,
    sha256,
    sizeBytes: zipBytes.byteLength,
    r2Key,
    downloadUrl: `${env.CDN_BASE_URL.replace(/\/$/, '')}/${r2Key}`,
  };
}
