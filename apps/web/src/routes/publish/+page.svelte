<script lang="ts">
  // Browser publish fallback + token management. Full implementation lands
  // with the publish pipeline (build order step 6). For MVP bootstrapping
  // this page just points authors at the CLI.
</script>

<h2>Publish</h2>
<p>
  Packages are published with the <code>mello</code> CLI (ships in the
  <a href="https://github.com/pasmello/pasmello">pasmello</a> repo):
</p>
<pre><code>curl -fsSL get.pasmello.dev | sh
mello login
mello init tool
mello pack
mello publish</code></pre>
<p>
  A browser-based publish flow is planned but not yet available.
</p>
