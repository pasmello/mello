<script lang="ts">
  import {
    validatePackageZip,
    envelopeAdvisories,
    toolPermissionAdvisories,
    type Envelope,
    type ValidationIssue,
    type Advisory,
  } from '@mello/plugin-spec';
  import { RegistryError } from '@mello/registry-client';
  import { auth, makeClient, currentPasmelloOrigin } from '$lib/auth.ts';

  type Status = 'idle' | 'parsing' | 'ready' | 'uploading' | 'done' | 'error';

  let status: Status = $state('idle');
  let errorMsg: string | null = $state(null);
  let issues: ValidationIssue[] = $state([]);
  let advisories: Advisory[] = $state([]);
  let envelope: Envelope | null = $state(null);
  let manifest: unknown = $state(null);
  let zipBytes: Uint8Array | null = $state(null);
  let zipSize = $state(0);
  let sha256: string | null = $state(null);
  let uploadPct = $state(0);
  let result: {
    type: string;
    scope: string;
    name: string;
    version: string;
    downloadUrl: string;
  } | null = $state(null);

  let fileInput: HTMLInputElement | undefined = $state();
  let dragActive = $state(false);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    if (!file) return;
    reset();
    status = 'parsing';
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      zipBytes = bytes;
      zipSize = bytes.byteLength;
      const extract = await validatePackageZip(bytes);
      if (extract.envelope) envelope = extract.envelope;
      if (extract.manifest) manifest = extract.manifest;
      issues = extract.issues;
      if (!extract.ok || !extract.envelope) {
        status = 'error';
        errorMsg = 'package is invalid — see issues below';
        return;
      }
      const env = extract.envelope;
      advisories = [
        ...envelopeAdvisories(env, bytes.byteLength),
        ...(env.type === 'tool' && manifest && typeof manifest === 'object'
          ? toolPermissionAdvisories(manifest as never)
          : []),
      ];
      sha256 = await computeSha256(bytes);
      status = 'ready';
    } catch (err) {
      status = 'error';
      errorMsg = (err as Error).message;
    }
  }

  async function computeSha256(bytes: Uint8Array): Promise<string> {
    const ab: ArrayBuffer = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
      ? (bytes.buffer as ArrayBuffer)
      : (bytes.slice().buffer as ArrayBuffer);
    const hash = await crypto.subtle.digest('SHA-256', ab);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function publish() {
    if (!zipBytes || !envelope) return;
    status = 'uploading';
    uploadPct = 0;
    try {
      const client = makeClient();
      const blob = new Blob([zipBytes.slice().buffer as ArrayBuffer], { type: 'application/zip' });
      const form = new FormData();
      form.append('zip', blob, 'package.zip');
      const res = await new Promise<{ ok: boolean; status: number; body: unknown }>(
        (resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${client.baseUrl}/v1/publish`);
          xhr.withCredentials = true;
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) uploadPct = Math.round((e.loaded / e.total) * 100);
          };
          xhr.onload = () => {
            let body: unknown;
            try {
              body = JSON.parse(xhr.responseText);
            } catch {
              body = xhr.responseText;
            }
            resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body });
          };
          xhr.onerror = () => reject(new Error('network error'));
          xhr.send(form);
        },
      );
      if (!res.ok) {
        const body = res.body as { error?: string; detail?: string; reasons?: string[] };
        throw new RegistryError(
          res.status,
          body?.error ?? 'publish_failed',
          body?.detail ?? `HTTP ${res.status}`,
          body,
        );
      }
      const out = res.body as {
        type: string; scope: string; name: string; version: string; downloadUrl: string;
      };
      result = out;
      status = 'done';
    } catch (err) {
      status = 'error';
      if (err instanceof RegistryError) {
        const detail = err.body as { reasons?: string[] };
        const reasons = detail?.reasons?.length ? `: ${detail.reasons.join('; ')}` : '';
        errorMsg = `${err.code}${reasons} — ${err.message}`;
      } else {
        errorMsg = (err as Error).message;
      }
    }
  }

  function reset() {
    status = 'idle';
    errorMsg = null;
    issues = [];
    advisories = [];
    envelope = null;
    manifest = null;
    zipBytes = null;
    zipSize = 0;
    sha256 = null;
    uploadPct = 0;
    result = null;
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragActive = false;
    handleFiles(e.dataTransfer?.files ?? null);
  }
</script>

<svelte:head>
  <title>Publish · mello</title>
</svelte:head>

<h1>Publish</h1>

{#if auth.status === 'loading'}
  <p>Checking session…</p>
{:else if auth.status === 'anon'}
  <p>
    You need to be signed in to publish.
    <a href={auth.githubLoginUrl('/publish')}>Sign in with GitHub →</a>
  </p>
{:else}
  <p class="muted">
    Drop a built package zip here. The envelope and nested manifest are validated client-side before upload.
    The CLI (<code>mello publish</code>) uses the same endpoint — use whichever fits your workflow.
  </p>

  {#if status === 'done' && result}
    <div class="done">
      <h2>Published!</h2>
      <p>
        <strong>{result.type}: @{result.scope}/{result.name}@{result.version}</strong>
      </p>
      <div class="actions">
        <a class="btn primary" href={`/p/${result.type}/${result.scope}/${result.name}`}>View package</a>
        <a class="btn" href={`${currentPasmelloOrigin()}/?install=${encodeURIComponent(result.downloadUrl)}`} target="_blank" rel="noopener">Open in Pasmello</a>
        <button class="btn ghost" type="button" onclick={reset}>Publish another</button>
      </div>
    </div>
  {:else}
    <div
      class="drop"
      class:active={dragActive}
      ondragover={(e) => { e.preventDefault(); dragActive = true; }}
      ondragleave={() => (dragActive = false)}
      ondrop={onDrop}
      onclick={() => fileInput?.click()}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput?.click(); }}
      role="button"
      tabindex="0"
    >
      <input
        bind:this={fileInput}
        type="file"
        accept=".zip,application/zip"
        onchange={(e) => handleFiles((e.target as HTMLInputElement).files)}
        style="display: none"
      />
      <p class="lead">Drop a .zip here or click to select</p>
      <p class="muted sm">Max 20 MB · Must contain <code>mello.package.json</code> + the nested Pasmello manifest</p>
    </div>

    {#if status === 'parsing'}
      <p>Parsing…</p>
    {/if}

    {#if issues.length > 0}
      <div class="issues">
        <h3>Validation errors</h3>
        <ul>
          {#each issues as issue}
            <li><code>{issue.path}</code> — {issue.message}</li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if envelope}
      <section class="preview">
        <h3>Preview</h3>
        <dl>
          <dt>Type</dt><dd>{envelope.type}</dd>
          <dt>Package</dt><dd>@{envelope.scope}/{envelope.name}</dd>
          <dt>Version</dt><dd>{envelope.version}</dd>
          <dt>Description</dt><dd>{envelope.description}</dd>
          <dt>Author</dt><dd>{envelope.author.github}</dd>
          <dt>License</dt><dd>{envelope.license}</dd>
          <dt>Size</dt><dd>{(zipSize / 1024).toFixed(1)} KB</dd>
          {#if sha256}
            <dt>sha256</dt><dd class="mono">{sha256}</dd>
          {/if}
        </dl>

        {#if advisories.length > 0}
          <h4>Advisories</h4>
          <ul class="advisories">
            {#each advisories as adv}
              <li class="adv-{adv.level}">{adv.message}</li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    {#if errorMsg}
      <div class="error">
        <h3>Error</h3>
        <p>{errorMsg}</p>
      </div>
    {/if}

    {#if status === 'ready' && envelope}
      <div class="actions">
        <button class="btn primary" type="button" onclick={publish}>Publish</button>
        <button class="btn ghost" type="button" onclick={reset}>Cancel</button>
      </div>
    {/if}

    {#if status === 'uploading'}
      <div class="progress">
        <div class="progress-bar" style={`width: ${uploadPct}%`}></div>
        <span>{uploadPct}%</span>
      </div>
    {/if}
  {/if}
{/if}

<style>
  .muted { color: var(--pm-text-muted); }
  .sm { font-size: 0.85rem; }
  .mono {
    font-family: ui-monospace, Menlo, monospace;
    font-size: 0.8rem;
    word-break: break-all;
  }
  code {
    font-family: ui-monospace, Menlo, monospace;
    padding: 0.05rem 0.3rem;
    background: var(--pm-surface-2);
    border-radius: 4px;
  }
  .drop {
    margin: 1rem 0;
    padding: 3rem 1rem;
    border: 2px dashed var(--pm-border);
    border-radius: 12px;
    text-align: center;
    cursor: pointer;
    transition: border-color 120ms ease, background 120ms ease;
  }
  .drop:hover, .drop.active {
    border-color: var(--pm-accent);
    background: var(--pm-surface-2);
  }
  .lead {
    font-size: 1.1rem;
    font-weight: 600;
  }
  .issues, .error {
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid #f87171;
    border-radius: 8px;
    background: rgba(248, 113, 113, 0.08);
  }
  .issues h3, .error h3 {
    margin-top: 0;
    color: #dc2626;
  }
  .preview {
    margin: 1rem 0;
    padding: 1rem;
    border: 1px solid var(--pm-border);
    border-radius: 8px;
    background: var(--pm-surface);
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.5rem 1rem;
    margin: 0;
  }
  dt { color: var(--pm-text-muted); }
  dd { margin: 0; }
  .advisories { margin: 0.5rem 0 0; padding-left: 1.2rem; }
  .adv-warn { color: var(--pm-warning, #d97706); }
  .adv-info { color: var(--pm-text-muted); }
  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
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
  .btn.primary {
    background: var(--pm-accent);
    color: white;
    border-color: var(--pm-accent);
  }
  .btn.ghost {
    background: transparent;
  }
  .progress {
    margin-top: 1rem;
    height: 8px;
    background: var(--pm-surface-2);
    border-radius: 999px;
    overflow: hidden;
    position: relative;
  }
  .progress-bar {
    height: 100%;
    background: var(--pm-accent);
    transition: width 80ms linear;
  }
  .progress span {
    position: absolute;
    top: -1.25rem;
    right: 0;
    font-size: 0.8rem;
  }
  .done {
    margin: 2rem 0;
    padding: 2rem;
    border: 1px solid var(--pm-success, #16a34a);
    border-radius: 12px;
    background: rgba(22, 163, 74, 0.08);
  }
</style>
