<script lang="ts">
  import '../lib/styles/tokens.css';
  import '../lib/styles/global.css';

  let { children } = $props();
</script>

<div class="shell">
  <header class="shell-header">
    <a class="brand" href="/">mello</a>
    <nav class="shell-nav">
      <a href="/search?type=tool">Tools</a>
      <a href="/search?type=theme">Themes</a>
      <a href="/search?type=workflow">Workflows</a>
    </nav>
    <div class="shell-actions">
      <a href="/dashboard" class="ghost">Dashboard</a>
    </div>
  </header>
  <main class="shell-main">
    {@render children()}
  </main>
  <footer class="shell-footer">
    <span>mello — AGPL v3</span>
    <span>
      <a href="https://pasmello.dev">pasmello.dev</a>
      ·
      <a href="/about">about</a>
    </span>
  </footer>
</div>

<style>
  .shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .shell-header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--pm-border);
    background: var(--pm-surface);
  }
  .brand {
    font-weight: 700;
    font-size: 1.25rem;
    color: var(--pm-accent);
    text-decoration: none;
  }
  .shell-nav {
    display: flex;
    gap: 1rem;
  }
  .shell-nav a {
    color: var(--pm-text-muted);
    text-decoration: none;
  }
  .shell-nav a:hover {
    color: var(--pm-text);
  }
  .shell-actions {
    margin-left: auto;
  }
  .shell-actions .ghost {
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--pm-border);
    border-radius: 6px;
    color: var(--pm-text);
    text-decoration: none;
  }
  .shell-main {
    flex: 1;
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }
  .shell-footer {
    display: flex;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--pm-border);
    color: var(--pm-text-muted);
    font-size: 0.875rem;
  }
  .shell-footer a {
    color: inherit;
  }
</style>
