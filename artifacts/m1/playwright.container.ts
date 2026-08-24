// Playwright config for THIS container only. Not the project's config.
//
// The committed `playwright.config.ts` asks for `channel: 'chrome'` — real
// Google Chrome, which is not installed here and cannot be (the network policy
// blocks dl.google.com). This points Playwright at the Chromium that ships with
// the image instead.
//
// Chromium has no H.264 encoder or decoder, so every spec that uploads an MP4
// fixture or renders one will fail here. That is the point of running it: to see
// exactly which specs are blocked by the codec and which pass anyway.
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {defineConfig} from '@playwright/test';

import base from '../../playwright.config';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  ...base,
  // `testDir` in the base config is relative to *this* file, so pin it.
  testDir: resolve(projectRoot, 'tests/e2e'),
  use: {
    ...base.use,
    channel: undefined,
    launchOptions: {
      executablePath: '/opt/pw-browsers/chromium',
      args: ['--no-sandbox'],
    },
  },
  // The base config's `webServer` commands are resolved against this file too,
  // so they need the project root as their working directory.
  webServer: (Array.isArray(base.webServer) ? base.webServer : []).map(
    (server) => ({...server, cwd: projectRoot}),
  ),
  // One worker: the render specs are heavy and this box has four cores.
  workers: 1,
  reporter: [['list']],
});
