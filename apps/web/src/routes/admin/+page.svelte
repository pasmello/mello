<script lang="ts">
  import { onMount } from 'svelte';
  import { auth, makeClient } from '$lib/auth.ts';
  import { FLAG_DESCRIPTORS, ALL_FLAG_KEYS, type FlagKey } from '@mello/admin-core';

  let flags: Record<FlagKey, boolean> = $state({
    'publish.enabled': true,
    'download.enabled': true,
    'search.enabled': true,
    read_only: false,
  });
  let flagsLoading = $state(true);
  let flagsError: string | null = $state(null);

  let searchQ = $state('');
  let searchResults: Array<{ id: string; type: string; scope: string; name: string; description: string }> = $state([]);
  let searching = $state(false);

  async function loadFlags() {
    flagsLoading = true;
    try {
      const base = makeClient().baseUrl;
      const res = await fetch(`${base}/v1/admin/flags`, { credentials: 'include' });
      if (!res.ok) throw new Error(`flags HTTP ${res.status}`);
      const body = (await res.json()) as Record<FlagKey, boolean>;
      flags = { ...flags, ...body };
      flagsLoading = false;
    } catch (err) {
      flagsError = (err as Error).message;
      flagsLoading = false;
    }
  }

  async function toggleFlag(key: FlagKey) {
    const desc = FLAG_DESCRIPTORS[key];
    const next = !flags[key];
    if (desc.destructive) {
      if (!confirm(`${desc.label} → ${next ? 'ON' : 'OFF'}\n\n${desc.description}\n\nContinue?`)) return;
    }
    try {
      const base = makeClient().baseUrl;
      const res = await fetch(`${base}/v1/admin/flags`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [key]: next }),
      });
      if (!res.ok) throw new Error(`toggle HTTP ${res.status}`);
      flags = { ...flags, [key]: next };
    } catch (err) {
      flagsError = (err as Error).message;
    }
  }

  async function doSearch() {
    searching = true;
    try {
      const out = await makeClient().listPackages({ q: searchQ, pageSize: 25 });
      searchResults = out.packages.map((p) => ({
        id: p.id,
        type: p.type,
        scope: p.scope,
        name: p.name,
        description: p.description,
      }));
    } catch (err) {
      flagsError = (err as Error).message;
    } finally {
      searching = false;
    }
  }

  async function takedown(id: string, label: string) {
    const reason = prompt(`Takedown ${label}? Enter reason (required):`);
    if (!reason) return;
    try {
      const base = makeClient().baseUrl;
      const res = await fetch(`${base}/v1/admin/packages/${id}/takedown`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(`takedown HTTP ${res.status}`);
      alert('taken down');
      searchResults = searchResults.filter((p) => p.id !== id);
    } catch (err) {
      flagsError = (err as Error).message;
    }
  }

  onMount(() => {
    if (auth.status === 'authed' && auth.user?.role === 'admin') void loadFlags();
  });

  $effect(() => {
    if (auth.status === 'authed' && auth.user?.role === 'admin' && flagsLoading) {
      void loadFlags();
    }
  });
</script>

<svelte:head>
  <title>Admin · mello</title>
</svelte:head>

<h1>Admin</h1>

{#if auth.status === 'loading'}
  <p>Loading…</p>
{:else if auth.status === 'anon'}
  <p><a href={auth.githubLoginUrl('/admin')}>Sign in with GitHub →</a></p>
{:else if auth.user?.role !== 'admin'}
  <p class="error">Not an admin.</p>
{:else}
  <section>
    <h2>Feature flags</h2>
    {#if flagsLoading}
      <p>Loading flags…</p>
    {:else if flagsError}
      <p class="error">{flagsError}</p>
    {:else}
      <div class="flags">
        {#each ALL_FLAG_KEYS as key}
          {@const desc = FLAG_DESCRIPTORS[key]}
          <label class="flag">
            <input
              type="checkbox"
              checked={flags[key]}
              onchange={() => toggleFlag(key)}
            />
            <div>
              <strong>{desc.label}</strong>
              {#if desc.destructive}<span class="dest">destructive</span>{/if}
              <p class="muted">{desc.description}</p>
            </div>
          </label>
        {/each}
      </div>
    {/if}
  </section>

  <section>
    <h2>Takedown</h2>
    <form onsubmit={(e) => { e.preventDefault(); doSearch(); }}>
      <input type="search" bind:value={searchQ} placeholder="search packages…" />
      <button type="submit" class="btn">Search</button>
    </form>
    {#if searching}
      <p>Searching…</p>
    {:else if searchResults.length > 0}
      <table>
        <thead>
          <tr>
            <th>Package</th>
            <th>Type</th>
            <th>Description</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each searchResults as p}
            <tr>
              <td><a href={`/p/${p.type}/${p.scope}/${p.name}`}>@{p.scope}/{p.name}</a></td>
              <td>{p.type}</td>
              <td class="desc">{p.description}</td>
              <td>
                <button class="btn danger" type="button" onclick={() => takedown(p.id, `@${p.scope}/${p.name}`)}>
                  Take down
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
{/if}

<style>
  .muted { color: var(--pm-text-muted); }
  .error { color: #dc2626; }
  section {
    margin-bottom: 2rem;
    padding: 1rem;
    border: 1px solid var(--pm-border);
    border-radius: 8px;
    background: var(--pm-surface);
  }
  .flags { display: flex; flex-direction: column; gap: 0.75rem; }
  .flag {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.5rem;
    border: 1px solid var(--pm-border);
    border-radius: 6px;
  }
  .dest {
    margin-left: 0.5rem;
    font-size: 0.7rem;
    padding: 0.1rem 0.4rem;
    background: #fecaca;
    color: #991b1b;
    border-radius: 4px;
    text-transform: uppercase;
  }
  .flag p { margin: 0.25rem 0 0; font-size: 0.85rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { padding: 0.6rem 0.5rem; text-align: left; border-bottom: 1px solid var(--pm-border); }
  .desc { color: var(--pm-text-muted); font-size: 0.9rem; }
  form { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  input[type="search"] {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--pm-border);
    border-radius: 6px;
    background: var(--pm-surface);
    color: var(--pm-text);
  }
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
  .btn.danger { border-color: #dc2626; color: #dc2626; }
  .btn.danger:hover { background: #fef2f2; }
  a { color: var(--pm-accent); text-decoration: none; }
</style>
