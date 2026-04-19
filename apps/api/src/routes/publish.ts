import { Hono } from 'hono';
import { requireAuth, requireScope, type AuthedUser } from '../auth/tokens.ts';
import { requireFlag } from '../middleware/flags.ts';

export const publishRoutes = new Hono<{ Variables: { user: AuthedUser } }>();

publishRoutes.use('*', requireFlag('publish.enabled'));
publishRoutes.use('*', requireAuth);
publishRoutes.use('*', requireScope('publish'));

// POST /v1/publish
// Multipart: `zip` (package bytes) + the rest of the envelope is re-read
// from mello.package.json inside the zip (we don't trust a parallel JSON
// body — the zip is the source of truth).
//
// Pipeline (stub — implemented in build step 6 of the plan):
//   1. size check (≤ 50 MB)
//   2. unzip in memory, extract mello.package.json
//   3. validate envelope against spec/mello-package-v1.schema.json
//   4. validate nested manifest against spec/pasmello-manifests/<type>.schema.json
//   5. resolve author.github ↔ auth user (must match or user must be a co-owner)
//   6. verify email_verified_at on the author
//   7. compute sha256, upload to R2 at the content-addressable key
//   8. insert into packages + versions in a single transaction
//   9. invoke malware-scan hook (no-op in MVP)
publishRoutes.post('/', async (c) => {
  return c.json({ error: 'publish pipeline not yet implemented (MVP in-progress)' }, 501);
});
