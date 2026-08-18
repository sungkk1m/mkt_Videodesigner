import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    // Stamped into the ?debug report. A deployed static site is served through a
    // CDN and an already-cached index.html keeps loading the previous bundle, so
    // without this there is no way to tell an unchanged behaviour from an
    // unchanged build.
    __BUILD_ID__: JSON.stringify(
      process.env.GITHUB_SHA?.slice(0, 7) ?? 'local',
    ),
  },
});
