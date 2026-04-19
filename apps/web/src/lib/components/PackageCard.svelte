<script lang="ts">
  import type { PackageSummary } from '$lib/types.ts';

  let { pkg }: { pkg: PackageSummary } = $props();
</script>

<a class="card" href={`/p/${pkg.type}/${pkg.scope}/${pkg.name}`}>
  <div class="head">
    <span class="type-badge type-{pkg.type}">{pkg.type}</span>
    {#if pkg.tier === 'paid'}
      <span class="tier-badge">paid</span>
    {/if}
  </div>
  <div class="title">{pkg.fullName}</div>
  <div class="desc">{pkg.description || '—'}</div>
  <div class="foot">
    <span>v{pkg.latestVersion ?? '?'}</span>
    <span>{new Date(pkg.updatedAt).toLocaleDateString()}</span>
  </div>
</a>

<style>
  .card {
    display: block;
    padding: 1rem;
    border: 1px solid var(--pm-border);
    border-radius: var(--pm-radius);
    background: var(--pm-surface);
    color: var(--pm-text);
    text-decoration: none;
    transition: border-color 120ms ease;
  }
  .card:hover {
    border-color: var(--pm-accent);
  }
  .head {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .type-badge {
    font-size: 0.7rem;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    background: var(--pm-surface-2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--pm-text-muted);
  }
  .type-tool { color: var(--pm-accent); }
  .type-theme { color: var(--pm-warning); }
  .type-workflow { color: var(--pm-success); }
  .tier-badge {
    font-size: 0.7rem;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    background: var(--pm-warning);
    color: white;
    text-transform: uppercase;
  }
  .title {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  .desc {
    color: var(--pm-text-muted);
    font-size: 0.9rem;
    min-height: 2.4em;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .foot {
    display: flex;
    justify-content: space-between;
    margin-top: 0.75rem;
    color: var(--pm-text-muted);
    font-size: 0.8rem;
  }
</style>
