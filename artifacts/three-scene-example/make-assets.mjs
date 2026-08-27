// Drives `assets.html` in the container Chromium and writes the example's input
// media. Needs the dev server: npm run dev -- --host 127.0.0.1 --port 4173
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium} from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const url =
  process.env.EXAMPLE_URL ??
  'http://127.0.0.1:4173/artifacts/three-scene-example/assets.html';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.EXAMPLE_CHROME ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

await page.goto(url, {waitUntil: 'load'});
await page.waitForFunction(
  () => document.getElementById('status')?.textContent === 'ready',
  {timeout: 120_000},
);

const out = await page.evaluate(() => window.__makeAssets());
const assetDirectory = resolve(here, 'assets');
await mkdir(assetDirectory, {recursive: true});

const png = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');

await writeFile(
  resolve(assetDirectory, 'gameplay-placeholder.webm'),
  Buffer.from(out.gameplay.base64, 'base64'),
);
await writeFile(resolve(assetDirectory, 'app-icon.png'), png(out.appIconPng));
await writeFile(resolve(assetDirectory, 'logo.png'), png(out.logoPng));
await writeFile(resolve(assetDirectory, 'store-badge.png'), png(out.storeBadgePng));

console.log(
  JSON.stringify({
    clipBytes: out.gameplay.bytes,
    clipFrames: out.gameplay.frames,
    pageErrors: errors.slice(0, 5),
  }),
);

await browser.close();
