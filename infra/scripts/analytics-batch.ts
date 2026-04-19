// Daily batch: roll up Cloudflare Analytics Engine events into
// download_stats_daily so detail pages can show a count without ever
// hitting Postgres on the download path.
//
// Expected env:
//   DATABASE_URL
//   CLOUDFLARE_ACCOUNT_ID
//   CLOUDFLARE_API_TOKEN
//   CF_ANALYTICS_DATASET  (e.g. `mello_downloads`)
//
// This is a stub. Implementation lands with build order step 9.

async function main(): Promise<void> {
  console.log('[analytics-batch] not yet implemented');
}

main().catch((err) => {
  console.error('[analytics-batch] failed', err);
  process.exit(1);
});
