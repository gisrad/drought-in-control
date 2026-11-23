import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

export default defineConfig({
  base: '/kekeringan',
  trailingSlash: 'always',
  output: 'static',
  integrations: [svelte()],
});
