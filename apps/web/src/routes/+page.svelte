<script lang="ts">
  import { onMount } from 'svelte';
  import { listPackages } from '$lib/api.ts';
  import type { PackageSummary } from '$lib/types.ts';
  import PackageCard from '$lib/components/PackageCard.svelte';

  let q = $state('');
  let recent = $state<PackageSummary[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await listPackages({ sort: 'recent', pageSize: 12 });
      recent = res.items;
    } catch (e) {
      error = e instanceof Error ? e.message : 'failed to load';
    } finally {
      loading = false;
    }
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const query = q.trim();
    if (query) window.location.href = `/search?q=${encodeURIComponent(query)}`;
  }
</script>

<section class="hero">
  <h1>Share Pasmello tools, themes, and workflows.</h1>
  <p>mello is the open marketplace for the Pasmello ecosystem. Browse without an account.</p>
  <form onsubmit={submit}>
    <input
      type="search"
      placeholder="Search packages…"
      aria-label="Search packages"
      bind:value={q}
    />
    <button class="button primary" type="submit">Search</button>
  </form>
</section>

<section class="recent">
  <h2>Recent</h2>
  {#if loading}
    <p>Loading…</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else if recent.length === 0}
    <p>No packages yet. Be the first to <a href="/publish">publish</a>.</p>
  {:else}
    <div class="grid">
      {#each recent as pkg (pkg.fullName + ':' + pkg.type)}
        <PackageCard {pkg} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .hero {
    padding: 3rem 0 2rem;
    text-align: center;
  }
  .hero h1 {
    font-size: 2rem;
    margin: 0 0 0.5rem;
  }
  .hero p {
    color: var(--pm-text-muted);
    margin: 0 0 1.5rem;
  }
  .hero form {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }
  .hero input {
    width: 100%;
    max-width: 420px;
    padding: 0.65rem 0.85rem;
    border: 1px solid var(--pm-border);
    border-radius: var(--pm-radius-sm);
    background: var(--pm-surface);
    color: var(--pm-text);
  }
  .recent h2 {
    margin: 0 0 1rem;
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
