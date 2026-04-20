// cdn.pasmello.com Worker. Logs each package download to Analytics Engine
// and serves the corresponding R2 object.
//
// URL shape: /packages/{type}/{scope}/{name}/{version}/{sha256}.zip
//
// Matching that template gives us all the dimensions we need without an
// extra lookup against Postgres. The daily batch in infra/scripts/ pulls
// these events and aggregates into download_stats_daily.

interface Env {
  PACKAGES: R2Bucket;
  DOWNLOADS: AnalyticsEngineDataset;
}

const PACKAGE_PATH = /^\/packages\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/([0-9a-f]{64})\.zip$/;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('method not allowed', { status: 405 });
    }

    const key = url.pathname.replace(/^\//, '');
    const match = url.pathname.match(PACKAGE_PATH);
    if (!match) {
      // Non-package paths — still serve if they exist (docs, manifest.sha256, etc.)
      return serveObject(env, key, req);
    }

    const [, type, scope, name, version, sha] = match;

    try {
      env.DOWNLOADS.writeDataPoint({
        blobs: [
          type ?? '',
          scope ?? '',
          name ?? '',
          version ?? '',
          sha ?? '',
          req.headers.get('cf-ipcountry') ?? 'XX',
          req.headers.get('user-agent')?.slice(0, 128) ?? '',
        ],
        indexes: [`${type}:${scope}/${name}`],
      });
    } catch (err) {
      console.error('analytics write failed', err);
    }

    return serveObject(env, key, req);
  },
};

async function serveObject(env: Env, key: string, req: Request): Promise<Response> {
  const obj = req.method === 'HEAD'
    ? await env.PACKAGES.head(key)
    : await env.PACKAGES.get(key);
  if (!obj) return new Response('not found', { status: 404 });

  const headers = new Headers();
  headers.set('content-type', 'application/zip');
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  const etag = (obj as { httpEtag?: string }).httpEtag;
  if (etag) headers.set('etag', etag);

  if (req.method === 'HEAD' || !('body' in obj)) {
    return new Response(null, { headers });
  }
  const body = (obj as R2ObjectBody).body;
  return new Response(body, { headers });
}
