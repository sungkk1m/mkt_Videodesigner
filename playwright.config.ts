import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    channel: 'chrome',
    headless: true,
  },
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4173',
      port: 4173,
      reuseExistingServer: true,
    },
    {
      // Production build served under a repository-style subpath, so the
      // GitHub Pages layout is verified before anything is deployed.
      command: 'npm run build && node scripts/serve-dist-subpath.mjs',
      port: 4190,
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
