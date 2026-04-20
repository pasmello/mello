<svelte:head>
  <title>Privacy · mello</title>
</svelte:head>

<h1>Privacy</h1>

<p class="muted">
  Last updated: 2026-04-21. Placeholder — replace with legally-reviewed text before launch.
</p>

<section>
  <h2>What we collect</h2>
  <ul>
    <li>
      <strong>GitHub account data:</strong> login, numeric id, email, avatar. We read this
      once at sign-in and whenever you refresh your profile.
    </li>
    <li>
      <strong>Session cookie:</strong> a random opaque id tied to your user row. HttpOnly,
      Secure, SameSite=Lax. Cleared on logout.
    </li>
    <li>
      <strong>API tokens:</strong> stored as sha256 hashes. We show the first 8 chars so you
      can identify them in dashboards, but we cannot recover the raw token.
    </li>
    <li>
      <strong>Download analytics:</strong> aggregate counts per package per day, derived from
      CDN request logs. No per-user or per-IP data is persisted.
    </li>
    <li>
      <strong>Server logs:</strong> request method, path, status, duration, user/token id if
      authenticated. Retained for operational debugging and security response; rotated within 30 days.
    </li>
  </ul>
</section>

<section>
  <h2>What we do not collect</h2>
  <ul>
    <li>No tracking pixels, ad networks, or third-party analytics beyond error tracking.</li>
    <li>No persistent per-IP records outside short-lived rate-limit buckets.</li>
  </ul>
</section>

<section>
  <h2>Third parties</h2>
  <ul>
    <li>GitHub — OAuth provider.</li>
    <li>Cloudflare — CDN + Pages hosting + edge rate limiting.</li>
    <li>Fly.io — API hosting.</li>
    <li>Neon — Postgres hosting.</li>
    <li>Sentry — error tracking (request metadata, stack traces; no request bodies).</li>
  </ul>
</section>

<section>
  <h2>Your rights</h2>
  <p>
    You can delete your account by emailing <a href="mailto:admin@pasmello.com">admin@pasmello.com</a>.
    We'll remove your user row, API tokens, and sessions. Published packages remain
    (they're immutable and other users may depend on them) unless you ask us to take specific versions down.
  </p>
</section>

<style>
  .muted { color: var(--pm-text-muted); font-size: 0.9rem; }
  section { margin: 1.5rem 0; }
  section h2 { margin-bottom: 0.5rem; }
</style>
