// Client-only SPA — the API is a separate service, and auth tokens live in
// the browser. Disabling SSR avoids hydrating with stale server state.
export const ssr = false;
export const prerender = false;
export const trailingSlash = 'never';
