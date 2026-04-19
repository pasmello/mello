<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { listPackages } from '$lib/api.ts';
  import type { PackageSummary, PackageType } from '$lib/types.ts';
  import PackageCard from '$lib/components/PackageCard.svelte';

  let q = $state('');
  let type = $state<PackageType | ''>('');
  let items = $state<PackageSummary[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  async function runSearch() {
    loading = true;
    error = null;
    try {
      const res = await listPackages({
        q: q || undefined,
        type: type || undefined,
      });
      items = res.items;
    } catch (e) {
      error = e instanceof Error ? e.message : 'failed to load';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    const u = $page.url;
    q = u.searchParams.get('q') ?? '';
    type = (u.searchParams.get('type') as PackageType) ?? '';
    runSearch();
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    runSearch();
  }
</script>

<form class="filters" onsubmit={submit}>
  <input
    type="search"
    placeholder="Search packages…"
    bind:value={q}
    aria-label="Search query"
  />
  <select bind:value={type} aria-label="Package type">
    <option value="">All types</option>
    <option value="tool">Tools</option>
    <option value="theme">Themes</option>
    <option value="workflow">Workflows</option>
  </select>
  <button class="button primary" type="submit">Search</button>
</form>

{#if loading}
  <p>Loading…</p>
{:else if error}
  <p class="error">{error}</p>
{:else if items.length === 0}
  <p>No results.</p>
{:else}
  <div class="grid">
    {#each items as pkg (pkg.fullName + ':' + pkg.type)}
      <PackageCard {pkg} />
    {/each}
  </div>
{/if}

<style>
  .filters {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }
  .filters input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--pm-border);
    border-radius: var(--pm-radius-sm);
    background: var(--pm-surface);
    color: var(--pm-text);
  }
  .filters select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--pm-border);
    border-radius: var(--pm-radius-sm);
    background: var(--pm-surface);
    color: var(--pm-text);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1rem;
  }
  .error {
    color: var(--pm-danger);
  }
</style>
