import { Hono } from 'hono';
import { requireAuth, requireScope, type AuthedUser } from '../auth/tokens.ts';
import { requireFlag } from '../middleware/flags.ts';
import { rateLimit } from '../middleware/rateLimit.ts';
import { MAX_ARCHIVE_BYTES, PublishRejectError, extractPackage } from '../publish/extract.ts';
import { auditArchive } from '../publish/safety.ts';
import { validateEnvelope, validateManifest, authorMatchesUser } from '../publish/validate.ts';
import { sql } from '../db/client.ts';
import { scanArchive } from '../publish/scan.ts';
import { storePackageVersion } from '../publish/store.ts';

export const publishRoutes = new Hono<{ Variables: { user: AuthedUser } }>();

publishRoutes.use('*', requireFlag('publish.enabled'));
publishRoutes.use('*', requireAuth);
publishRoutes.use('*', rateLimit('publish', 10));

// Session auth grants all scopes; token auth needs explicit 'publish'.
publishRoutes.use('*', async (c, next) => {
  const user = c.get('user');
  if (!user.scopes.includes('publish')) {
    return c.json({ error: 'token missing publish scope' }, 403);
  }
  return requireScope('publish')(c, next);
});

// Check if auth user is a co-owner of (type, scope, name) beyond the simple
// author-identity rule. Publishers need to match either scope OR be granted
// co-owner rights.
async function isCoOwner(
  userId: string,
  type: string,
  scope: string,
  name: string,
): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM packages p
    LEFT JOIN package_owners po ON po.package_id = p.id AND po.user_id = ${userId}
    WHERE p.type = ${type} AND p.scope = ${scope} AND p.name = ${name}
      AND (p.owner_id = ${userId} OR po.user_id IS NOT NULL)
    LIMIT 1
  `;
  return rows.length > 0;
}

publishRoutes.post('/', async (c) => {
  const user = c.get('user');

  // Pre-flight size check from Content-Length header.
  const claimedLen = Number(c.req.header('content-length') ?? '0');
  if (claimedLen && claimedLen > MAX_ARCHIVE_BYTES * 1.1) {
    return c.json(
      { error: 'archive_too_large', maxBytes: MAX_ARCHIVE_BYTES },
      413,
    );
  }

  // Accept either multipart/form-data with field `zip`, or a raw
  // application/zip body. Web publish uses multipart; CLI can use either.
  const contentType = c.req.header('content-type') ?? '';
  let zipBytes: Uint8Array;
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await c.req.formData();
      const zip = form.get('zip');
      if (!(zip instanceof Blob)) {
        return c.json({ error: 'missing zip form field' }, 400);
      }
      zipBytes = new Uint8Array(await zip.arrayBuffer());
    } else {
      const buf = await c.req.arrayBuffer();
      zipBytes = new Uint8Array(buf);
    }
  } catch (err) {
    return c.json({ error: 'failed to read body', detail: (err as Error).message }, 400);
  }

  if (zipBytes.byteLength === 0) {
    return c.json({ error: 'empty body' }, 400);
  }

  try {
    const pkg = await extractPackage(zipBytes);
    const envelope = await validateEnvelope(pkg.envelope);
    await validateManifest(envelope.type, pkg.manifest);

    // Author identity check OR co-ownership check.
    if (!authorMatchesUser(envelope, user.login)) {
      const allowed = await isCoOwner(
        user.id,
        envelope.type,
        envelope.scope,
        envelope.name,
      );
      if (!allowed) {
        return c.json(
          {
            error: 'author_mismatch',
            detail: `envelope scope "${envelope.scope}" does not match your GitHub login "${user.login}" and you are not a co-owner`,
          },
          403,
        );
      }
    }

    const safety = await auditArchive(pkg.zip);
    if (!safety.ok) {
      return c.json(
        { error: 'archive_unsafe', reasons: safety.reasons },
        400,
      );
    }

    const scan = await scanArchive(zipBytes);
    if (!scan.clean) {
      return c.json({ error: 'malware_detected', detections: scan.detections ?? [] }, 400);
    }

    const stored = await storePackageVersion({
      user: { id: user.id, login: user.login },
      envelope,
      manifest: pkg.manifest,
      description: envelope.description,
      keywords: envelope.keywords ?? [],
      zipBytes,
    });

    return c.json(
      {
        ok: true,
        packageId: stored.packageId,
        versionId: stored.versionId,
        type: envelope.type,
        scope: envelope.scope,
        name: envelope.name,
        version: envelope.version,
        sha256: stored.sha256,
        sizeBytes: stored.sizeBytes,
        downloadUrl: stored.downloadUrl,
      },
      201,
    );
  } catch (err) {
    if (err instanceof PublishRejectError) {
      const status = err.code === 'version_exists'
        ? 409
        : err.code === 'archive_too_large'
          ? 413
          : err.code === 'not_owner' || err.code === 'taken_down'
            ? 403
            : 400;
      return c.json({ error: err.code, detail: err.message }, status);
    }
    console.error('[publish]', err);
    return c.json({ error: 'publish_failed' }, 500);
  }
});
