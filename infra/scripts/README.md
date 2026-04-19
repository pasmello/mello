# Maintenance scripts

Cron scripts run on Fly.io (separate `machines` instance) or via GitHub
Actions on schedule. None of these should ever touch the hot path.

- `analytics-batch.ts` — once per day, pull download counts from
  Cloudflare Analytics Engine and upsert into `download_stats_daily`.
- (future) `token-gc.ts` — purge revoked API tokens older than 90 days.
- (future) `version-stats.ts` — compute per-version download deltas.
