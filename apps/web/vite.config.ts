import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    // 5173 is Pasmello's default dev port. mello web claims 5180 so both
    // can run side-by-side and so stray Pasmello instances (which may
    // cascade 5173→5174→...) don't collide with us.
    port: 5180,
    strictPort: true,
  },
});
