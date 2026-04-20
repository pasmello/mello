<script lang="ts">
  import { page } from '$app/state';
  import { auth } from '$lib/auth.ts';
  import { onMount } from 'svelte';

  let redirectTo = $state('/');

  onMount(() => {
    redirectTo = page.url.searchParams.get('redirect_to') ?? '/';
    if (auth.status === 'authed') {
      window.location.href = redirectTo;
    }
  });

  function loginHref(): string {
    return auth.githubLoginUrl(redirectTo);
  }
</script>

<svelte:head>
  <title>Login · mello</title>
</svelte:head>

<div class="login">
  <h1>Sign in to mello</h1>
  <p class="muted">
    mello uses GitHub OAuth. Your package scope is your GitHub login, and signing in lets you publish, yank, and manage ownership.
  </p>
  <a class="gh-button" href={loginHref()}>
    <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"></path>
    </svg>
    Continue with GitHub
  </a>
  <p class="muted sm">
    Prefer the CLI? Run <code>mello login</code> — it uses the same GitHub device flow.
  </p>
</div>

<style>
  .login {
    max-width: 32rem;
    margin: 3rem auto;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .muted {
    color: var(--pm-text-muted);
  }
  .sm {
    font-size: 0.85rem;
  }
  code {
    font-family: ui-monospace, Menlo, monospace;
    padding: 0.05rem 0.3rem;
    background: var(--pm-surface-2);
    border-radius: 4px;
  }
  .gh-button {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    justify-content: center;
    padding: 0.7rem 1.2rem;
    background: #24292f;
    color: white;
    border-radius: 8px;
    font-weight: 600;
    text-decoration: none;
    transition: background 120ms ease;
  }
  .gh-button:hover {
    background: #1b1f23;
  }
</style>
