import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from './client.ts';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

async function run(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const applied = new Set<string>(
    (await sql<{ filename: string }[]>`SELECT filename FROM schema_migrations`).map(
      (r) => r.filename,
    ),
  );

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const body = await readFile(join(migrationsDir, file), 'utf8');
    console.log(`[migrate] applying ${file}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (filename) VALUES (${file})`;
    });
  }

  console.log('[migrate] done');
  await sql.end();
}

run().catch((err) => {
  console.error('[migrate] failed', err);
  process.exit(1);
});
