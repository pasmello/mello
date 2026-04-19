import { cors } from 'hono/cors';

// All mello endpoints are CORS-open: the CLI, self-built pasmello
// instances, and the SaaS frontend must all be able to call us from the
// browser. Auth is bearer-token based; credentials are not used cross-site,
// so `credentials: false` is safe and correct.
export const corsMiddleware = cors({
  origin: '*',
  allowHeaders: ['authorization', 'content-type'],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['x-ratelimit-remaining', 'x-ratelimit-reset'],
  maxAge: 600,
});
