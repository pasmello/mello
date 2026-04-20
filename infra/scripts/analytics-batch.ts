// Daily batch: roll up Cloudflare Analytics Engine events into
// download_stats_daily so detail pages can show a count without ever
// hitting Postgres on the download path.
//
// Expected env:
//   DATABASE_URL
//   CLOUDFLARE_ACCOUNT_ID
//   CLOUDFLARE_API_TOKEN
//   CF_ANALYTICS_DATASET  (default: mello_downloads)
//
// Runs daily via .github/workflows/analytics-cron.yml. Idempotent — re-running
// for the same day recomputes counts and upserts.

import postgres from 'postgres';

const DATASET = process.env.CF_ANALYTICS_DATASET ?? 'mello_downloads';
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

interface Row {
  package_ref: string;
  day: string;
  downloads: number;
}

async function queryAnalytics(date: string): Promise<Row[]> {
  if (!ACCOUNT || !TOKEN) throw new Error('CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN not set');
  // blob1 = type, blob2 = scope, blob3 = name, blob4 = version
  const sql = `
    SELECT
      index1 AS package_ref,
      formatDateTime(timestamp, '%Y-%m-%d') AS day,
      SUM(_sample_interval) AS downloads
    FROM ${DATASET}
    WHERE timestamp >= toDateTime('${date} 00:00:00')
      AND timestamp <  toDateTime('${date} 00:00:00') + INTERVAL '1' DAY
    GROUP BY package_ref, day
  `;
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/analytics_engine/sql`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'text/plain',
    },
    body: sql,
  });
  if (!res.ok) {
    throw new Error(`CF Analytics SQL failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { data?: Row[] };
  return body.data ?? [];
}

async function upsert(rows: Row[]): Promise<number> {
  if (!DATABASE_URL) throw new Error('DATABASE_URL not set');
  if (rows.length === 0) return 0;
  const sql = postgres(DATABASE_URL, { transform: { column: { from: 'camel' as const } } });

  try {
    let written = 0;
    for (const row of rows) {
      // row.package_ref = "tool:scope/name" — resolve to package_id.
      const match = /^([^:]+):([^/]+)\/(.+)$/.exec(row.package_ref);
      if (!match) continue;
      const [, type, scope, name] = match;
      const found = await sql<Array<{ id: string }>>`
        SELECT id FROM packages
        WHERE type = ${type!} AND scope = ${scope!} AND name = ${name!}
        LIMIT 1
      `;
      const packageId = found[0]?.id;
      if (!packageId) continue;
      await sql`
        INSERT INTO download_stats_daily (package_id, version_id, date, count)
        VALUES (${packageId}, NULL, ${row.day}::DATE, ${row.downloads})
        ON CONFLICT (package_id, version_id, date) DO UPDATE
          SET count = EXCLUDED.count
      `;
      written++;
    }
    return written;
  } finally {
    await sql.end();
  }
}

function yesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const day = process.argv[2] ?? yesterday();
  console.log(`[analytics-batch] aggregating for ${day}`);
  const rows = await queryAnalytics(day);
  const written = await upsert(rows);
  console.log(`[analytics-batch] wrote ${written} rows`);
}

main().catch((err) => {
  console.error('[analytics-batch] failed', err);
  process.exit(1);
});
