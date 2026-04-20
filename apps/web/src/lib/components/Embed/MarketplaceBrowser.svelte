<script lang="ts">
  // Embed entry point. pasmello-saas mounts this inside pasmello.com so the
  // SaaS frontend reuses the same browser UI without any backend coupling —
  // calls go client-side to registry.pasmello.com. Independence is preserved:
  // if this component is rendered against a self-built pasmello, the same
  // component works without modification.

  import { onMount } from 'svelte';
  import { listPackages } from '$lib/api.ts';
  import type { PackageSummary, PackageType } from '$lib/types.ts';
  import PackageCard from '$lib/components/PackageCard.svelte';

  let {
    type,
    pageSize = 12,
  }: {
    type?: PackageType;
    pageSize?: number;
  } = $props();

  let items = $state<PackageSummary[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await listPackages({ type, pageSize });
      items = res.items;
    } catch (e) {
      error = e instanceof Error ? e.message : 'failed';
    } finally {
      loading = false;
    }
  });
</script>

<div class="embed">
  {#if loading}
    <p>Loading…</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else}
    <div class="grid">
      {#each items as pkg (pkg.fullName + ':' + pkg.type)}
        <PackageCard {pkg} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .embed {
    font-family: var(--pm-font-sans, system-ui);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1rem;
  }
  .error {
    color: var(--pm-danger);
  }
</style>
