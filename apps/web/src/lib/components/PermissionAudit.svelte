<script lang="ts">
  import type { ToolManifest } from '$lib/types.ts';

  let { manifest }: { manifest: ToolManifest } = $props();
  const p = $derived(manifest.permissions);

  type Severity = 'info' | 'warn' | 'danger';
  type Row = { label: string; value: string; severity: Severity; note?: string };

  const rows = $derived<Row[]>([
    {
      label: 'Storage (OPFS)',
      value: p.storage,
      severity: p.storage === 'read-write' ? 'warn' : p.storage === 'read' ? 'info' : 'info',
    },
    {
      label: 'Clipboard',
      value: p.clipboard,
      severity: p.clipboard === 'read-write' ? 'warn' : p.clipboard === 'read' ? 'info' : 'info',
    },
    {
      label: 'Notifications',
      value: p.notifications ? 'allowed' : 'no',
      severity: p.notifications ? 'info' : 'info',
    },
    {
      label: 'Camera',
      value: p.camera ? 'allowed' : 'no',
      severity: p.camera ? 'danger' : 'info',
    },
    {
      label: 'Geolocation',
      value: p.geolocation ? 'allowed' : 'no',
      severity: p.geolocation ? 'warn' : 'info',
    },
  ]);
</script>

<section class="audit">
  <h3>Permissions</h3>
  <p class="hint">
    Pasmello enforces every entry here at the sandbox boundary. Anything not listed is blocked.
  </p>

  <table>
    <tbody>
      {#each rows as row (row.label)}
        <tr class="sev-{row.severity}">
          <th>{row.label}</th>
          <td><code>{row.value}</code></td>
        </tr>
      {/each}
    </tbody>
  </table>

  <h4>Network allowlist</h4>
  {#if p.network.length === 0}
    <p class="muted">No outbound network access.</p>
  {:else}
    <ul class="origins">
      {#each p.network as origin}
        <li><code>{origin}</code></li>
      {/each}
    </ul>
  {/if}

  {#if Object.keys(manifest.actions ?? {}).length > 0}
    <h4>Actions exposed to workflows</h4>
    <ul class="actions">
      {#each Object.entries(manifest.actions) as [name, a] (name)}
        <li>
          <code>{name}</code> — <span>{a.description}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .audit {
    border: 1px solid var(--pm-border);
    border-radius: var(--pm-radius);
    padding: 1rem 1.25rem;
    margin: 1.5rem 0;
    background: var(--pm-surface);
  }
  .audit h3 {
    margin: 0 0 0.25rem;
  }
  .audit h4 {
    margin: 1rem 0 0.5rem;
    font-size: 0.95rem;
  }
  .hint {
    color: var(--pm-text-muted);
    margin: 0 0 1rem;
    font-size: 0.9rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    text-align: left;
    padding: 0.35rem 0.5rem;
    border-bottom: 1px solid var(--pm-border);
  }
  th {
    font-weight: 500;
    color: var(--pm-text-muted);
    width: 40%;
  }
  tr.sev-warn td code {
    color: var(--pm-warning);
  }
  tr.sev-danger td code {
    color: var(--pm-danger);
  }
  .origins,
  .actions {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .origins li,
  .actions li {
    padding: 0.25rem 0;
  }
  .muted {
    color: var(--pm-text-muted);
  }
</style>
