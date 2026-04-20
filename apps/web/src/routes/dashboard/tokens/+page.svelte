<script lang="ts">
  import { onMount } from 'svelte';
  import { auth, makeClient } from '$lib/auth.ts';
  import type { Token, NewTokenResponse } from '@mello/registry-client';

  let tokens: Token[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);
  let newName = $state('');
  let newScopes = $state<string[]>(['publish']);
  let newExpiryDays = $state<number | ''>('');
  let fresh: NewTokenResponse | null = $state(null);

  async function load() {
    loading = true;
    try {
      const out = await makeClient().myTokens();
      tokens = out.tokens;
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
    if (auth.status === 'authed' && tokens.length === 0 && loading) void load();
  });

  async function createToken(e: SubmitEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const out = await makeClient().createToken({
        name: newName.trim(),
        scopes: newScopes,
        expiresInDays: typeof newExpiryDays === 'number' ? newExpiryDays : undefined,
      });
      fresh = out;
      newName = '';
      await load();
    } catch (err) {
      error = (err as Error).message;
    }
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this token? This cannot be undone.')) return;
    try {
      await makeClient().revokeToken(id);
      await load();
    } catch (err) {
      error = (err as Error).message;
    }
  }

  function toggleScope(s: string) {
    newScopes = newScopes.includes(s)
      ? newScopes.filter((x) => x !== s)
      : [...newScopes, s];
  }
</script>

<svelte:head>
  <title>API tokens · mello</title>
</svelte:head>

<h1>API tokens</h1>
<p class="muted">
  Tokens are used by the CLI and by CI to publish, yank, and manage ownership.
  A token is shown <em>once</em> at creation — copy it immediately.
</p>

{#if auth.status !== 'authed'}
  <p><a href={auth.githubLoginUrl('/dashboard/tokens')}>Sign in →</a></p>
{:else}
  <section class="new">
    <h2>Create token</h2>
    <form onsubmit={createToken}>
      <label>
        Name
        <input type="text" bind:value={newName} placeholder="CI for @alice/clock" required maxlength="80" />
      </label>
      <fieldset>
        <legend>Scopes</legend>
        {#each ['publish', 'yank', 'manage'] as s}
          <label class="scope">
            <input type="checkbox" checked={newScopes.includes(s)} onchange={() => toggleScope(s)} />
            {s}
          </label>
        {/each}
      </fieldset>
      <label>
        Expires (days, optional)
        <input type="number" min="1" max="365" bind:value={newExpiryDays} placeholder="no expiration" />
      </label>
      <button type="submit" class="btn primary">Create</button>
    </form>
  </section>

  {#if fresh}
    <div class="fresh">
      <h3>Token created — copy now</h3>
      <p>Name: <strong>{fresh.name}</strong></p>
      <pre><code>{fresh.token}</code></pre>
      <button class="btn" type="button" onclick={() => (fresh = null)}>Dismiss</button>
    </div>
  {/if}

  <h2>Your tokens</h2>
  {#if loading}
    <p>Loading…</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else if tokens.length === 0}
    <p class="muted">No tokens yet.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Prefix</th>
          <th>Scopes</th>
          <th>Created</th>
          <th>Last used</th>
          <th>Expires</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each tokens as t}
          <tr>
            <td>{t.name}</td>
            <td class="mono">{t.tokenPrefix ?? '—'}…</td>
            <td>{t.scopes.join(', ')}</td>
            <td>{new Date(t.createdAt).toLocaleDateString()}</td>
            <td>{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : '—'}</td>
            <td>{t.expiresAt ? new Date(t.expiresAt).toLocaleDateString() : 'never'}</td>
            <td><button class="btn ghost" type="button" onclick={() => revoke(t.id)}>Revoke</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
{/if}

<style>
  .muted { color: var(--pm-text-muted); }
  .error { color: #dc2626; }
  .mono { font-family: ui-monospace, Menlo, monospace; font-size: 0.85rem; }
  .new {
    margin: 2rem 0;
    padding: 1rem;
    border: 1px solid var(--pm-border);
    border-radius: 8px;
    background: var(--pm-surface);
  }
  form {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-end;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.85rem;
  }
  label input[type="text"], label input[type="number"] {
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--pm-border);
    border-radius: 6px;
    background: var(--pm-surface);
    color: var(--pm-text);
  }
  fieldset {
    border: none;
    padding: 0;
    display: flex;
    gap: 0.75rem;
  }
  .scope {
    flex-direction: row;
    align-items: center;
    gap: 0.3rem;
  }
  .fresh {
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid var(--pm-success, #16a34a);
    border-radius: 8px;
    background: rgba(22, 163, 74, 0.08);
  }
  .fresh pre {
    padding: 0.75rem;
    background: var(--pm-surface-2);
    border-radius: 6px;
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
  }
  th, td {
    padding: 0.5rem;
    text-align: left;
    border-bottom: 1px solid var(--pm-border);
  }
  .btn {
    padding: 0.4rem 0.8rem;
    border: 1px solid var(--pm-border);
    border-radius: 6px;
    background: var(--pm-surface);
    color: var(--pm-text);
    cursor: pointer;
    font-size: 0.85rem;
  }
  .btn.primary {
    background: var(--pm-accent);
    color: white;
    border-color: var(--pm-accent);
  }
  .btn.ghost {
    background: transparent;
  }
</style>
