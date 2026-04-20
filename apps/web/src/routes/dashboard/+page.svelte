<script lang="ts">
  import { onMount } from 'svelte';
  import { auth, makeClient } from '$lib/auth.ts';

  interface Row {
    id: string;
    type: string;
    scope: string;
    name: string;
    latestVersion: string | null;
    description: string;
    status: string;
    updatedAt: string;
    ownerRole: string;
  }

  let rows: Row[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);

  async function load() {
    loading = true;
    try {
      const client = makeClient();
      const out = await client.myPackages();
      rows = out.packages as Row[];
      loading = false;
    } catch (err) {
      error = (err as Error).message;
      loading = false;
    }
  }

  onMount(() => {
    if (auth.status === 'authed') void load();
  });

  $effect(() => {
    if (auth.status === 'authed' && rows.length === 0 && loading) void load();
  });

  async function logout() {
    await auth.logout();
    window.location.href = '/';
  }
</script>

<svelte:head>
  <title>Dashboard · mello</title>
</svelte:head>

<h1>Dashboard</h1>

{#if auth.status === 'loading'}
  <p>Loading…</p>
{:else if auth.status === 'anon'}
  <p>
    <a href={auth.githubLoginUrl('/dashboard')}>Sign in with GitHub →</a>
  </p>
{:else}
  <div class="header-row">
    <div>
      <p class="muted">Signed in as <strong>@{auth.user?.login}</strong></p>
    </div>
    <div class="top-actions">
      <a class="btn" href="/dashboard/tokens">API tokens</a>
      <a class="btn primary" href="/publish">Publish new</a>
      <button class="btn ghost" type="button" onclick={logout}>Log out</button>
    </div>
  </div>

  <h2>Your packages</h2>
  {#if loading}
    <p>Loading…</p>
  {:else if error}
    <p class="error">Failed: {error}</p>
  {:else if rows.length === 0}
    <p class="muted">No packages yet. <a href="/publish">Publish one →</a></p>
  {:else}
    <table class="packages">
      <thead>
        <tr>
          <th>Package</th>
          <th>Type</th>
          <th>Version</th>
          <th>Status</th>
          <th>Role</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as p}
          <tr>
            <td>
              <a href={`/p/${p.type}/${p.scope}/${p.name}`}>
                @{p.scope}/{p.name}
              </a>
            </td>
            <td><span class="type">{p.type}</span></td>
            <td>{p.latestVersion ?? '—'}</td>
            <td>{p.status}</td>
            <td>{p.ownerRole ?? 'owner'}</td>
            <td>{new Date(p.updatedAt).toLocaleDateString()}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
{/if}

<style>
  .muted { color: var(--pm-text-muted); }
  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 1rem 0 2rem;
  }
  .top-actions { display: flex; gap: 0.5rem; }
  .btn {
    padding: 0.5rem 1rem;
    border: 1px solid var(--pm-border);
    border-radius: 6px;
    background: var(--pm-surface);
    color: var(--pm-text);
    cursor: pointer;
    text-decoration: none;
    font-size: 0.9rem;
  }
  .btn.primary {
    background: var(--pm-accent);
    color: white;
    border-color: var(--pm-accent);
  }
  .btn.ghost {
    background: transparent;
  }
  .packages {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
  }
  .packages th, .packages td {
    text-align: left;
    padding: 0.6rem 0.5rem;
    border-bottom: 1px solid var(--pm-border);
  }
  .packages a {
    color: var(--pm-accent);
    text-decoration: none;
  }
  .type {
    font-size: 0.75rem;
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    background: var(--pm-surface-2);
    color: var(--pm-text-muted);
  }
  .error { color: #dc2626; }
</style>
