<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { env } from '$env/dynamic/public';
  import { getPackage, getVersion, pasmelloInstallUrl } from '$lib/api.ts';
  import type { PackageDetail, PackageVersionDetail, PackageType, ToolManifest } from '$lib/types.ts';
  import PermissionAudit from '$lib/components/PermissionAudit.svelte';

  let pkg = $state<PackageDetail | null>(null);
  let version = $state<PackageVersionDetail | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    const { type, scope, name } = $page.params as { type: PackageType; scope: string; name: string };
    try {
      pkg = await getPackage(type, scope, name);
      if (pkg.latestVersion) {
        version = await getVersion(type, scope, name, pkg.latestVersion);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'failed to load';
    }
  });

  const pasmelloOrigin = () => env.PUBLIC_PASMELLO_ORIGIN ?? 'https://pasmello.com';
  const installHref = $derived(version ? pasmelloInstallUrl(pasmelloOrigin(), version.downloadUrl) : '#');
  const isTool = $derived(pkg?.type === 'tool' && version !== null);
</script>

{#if error}
  <p class="error">{error}</p>
{:else if !pkg}
  <p>Loading…</p>
{:else}
  <header class="pkg-head">
    <div>
      <div class="breadcrumb">
        <span class="type-badge type-{pkg.type}">{pkg.type}</span>
        <code>{pkg.fullName}</code>
        {#if pkg.latestVersion}
          <span class="version">v{pkg.latestVersion}</span>
        {/if}
      </div>
      <p class="desc">{pkg.description}</p>
    </div>
    <div class="actions">
      {#if pkg.status === 'active' && version}
        <a class="button primary" href={installHref}>Open in Pasmello</a>
      {:else}
        <button class="button" disabled>Unavailable</button>
      {/if}
    </div>
  </header>

  {#if isTool && version}
    <PermissionAudit manifest={version.manifest as ToolManifest} />
  {/if}

  <section class="versions">
    <h3>Versions</h3>
    <ul>
      {#each pkg.versions as v (v.version)}
        <li>
          <code>{v.version}</code>
          <span class="muted">{new Date(v.publishedAt).toLocaleDateString()}</span>
          {#if v.status === 'yanked'}
            <span class="warn">yanked</span>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .pkg-head {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.25rem;
  }
  .version {
    font-family: var(--pm-font-mono);
    color: var(--pm-text-muted);
    font-size: 0.9rem;
  }
  .type-badge {
    font-size: 0.7rem;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    background: var(--pm-surface-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--pm-text-muted);
  }
  .type-tool { color: var(--pm-accent); }
  .type-theme { color: var(--pm-warning); }
  .type-workflow { color: var(--pm-success); }
  .desc {
    color: var(--pm-text-muted);
    margin: 0.5rem 0 0;
  }
  .versions h3 {
    margin: 2rem 0 0.75rem;
  }
  .versions ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .versions li {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.45rem 0;
    border-bottom: 1px solid var(--pm-border);
  }
  .muted {
    color: var(--pm-text-muted);
    font-size: 0.85rem;
  }
  .warn {
    color: var(--pm-warning);
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .error { color: var(--pm-danger); }
</style>
