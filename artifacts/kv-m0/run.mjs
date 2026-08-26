// M0 driver — renders the spike in the container Chromium and saves the webm.
// Needs the dev server: npm run dev -- --host 127.0.0.1 --port 4173
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium} from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const URL_ = process.env.KV_M0_URL ?? 'http://127.0.0.1:4173/artifacts/kv-m0/spike.html';

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.KV_M0_CHROME ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto(URL_, {waitUntil: 'load'});
await page.waitForFunction(
  () => document.getElementById('status')?.textContent === 'ready',
  {timeout: 60_000},
);

const out = await page.evaluate(() => window.__kvM0Render());
await mkdir(resolve(here, 'out'), {recursive: true});
await writeFile(
  resolve(here, 'out/kv-m0-blur.webm'),
  Buffer.from(out.webmBase64, 'base64'),
);
console.log(
  JSON.stringify({
    nativeHtmlInCanvas: out.nativeHtmlInCanvas,
    totalMs: out.totalMs,
    bytes: Buffer.from(out.webmBase64, 'base64').length,
    pageErrors: errors.slice(0, 3),
  }),
);

await browser.close();
