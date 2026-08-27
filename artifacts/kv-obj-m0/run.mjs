// M0 driver — five renders + three standalone frames, saved to out/.
// Needs the dev server: npm run dev -- --host 127.0.0.1 --port 4173
//
//   a1 / a2   effects on, seed 42, camera off   → gate ① determinism
//   off       effects off, camera off           → gates ② cost, ③ isolation
//   cam       effects on, camera round trip     → gate ④ camera follow
//   camoff    effects off, camera round trip    → gate ④'s baseline
//   pure-N    frame N drawn from the pure functions → gate ⑤
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium} from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const URL_ =
  process.env.KV_OBJ_M0_URL ??
  'http://127.0.0.1:4173/artifacts/kv-obj-m0/spike.html';
const PURE_FRAMES = [10, 45, 80];

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.KV_OBJ_M0_CHROME ?? '/opt/pw-browsers/chromium',
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

await mkdir(resolve(here, 'out'), {recursive: true});
const timings = {renders: {}, pageErrors: errors};

const render = async (name, overrides) => {
  const out = await page.evaluate(
    (options) => window.__kvObjM0Render(options),
    overrides,
  );
  await writeFile(
    resolve(here, `out/${name}.webm`),
    Buffer.from(out.webmBase64, 'base64'),
  );
  timings.renders[name] = out.totalMs;
  timings.nativeHtmlInCanvas = out.nativeHtmlInCanvas;
  console.log(`${name}: ${out.totalMs}ms`);
};

await render('a1', {});
await render('a2', {});
await render('off', {effectsOn: false});
await render('cam', {cameraOn: true});
await render('camoff', {cameraOn: true, effectsOn: false});

for (const frame of PURE_FRAMES) {
  const dataUrl = await page.evaluate((n) => window.__kvObjM0Frame(n), frame);
  await writeFile(
    resolve(here, `out/pure-${frame}.png`),
    Buffer.from(dataUrl.split(',')[1], 'base64'),
  );
}

timings.pageErrors = errors.slice(0, 5);
await writeFile(
  resolve(here, 'out/timings.json'),
  JSON.stringify(timings, null, 2),
);
console.log(JSON.stringify(timings));

await browser.close();
