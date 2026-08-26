// M0 gate driver. Runs each configuration N times in a fresh page so nothing
// carries over between measurements, and prints one JSON blob.
import {writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const URL_ = 'http://127.0.0.1:4173/artifacts/m0/spike.html';
const REPEATS = Number(process.env.M0_REPEATS ?? 2);
const CONFIGS = [
  {variant: 'day1', fit: 'contain'},
  {variant: 'quad', fit: 'contain'},
  {variant: 'day1', fit: 'cover'},
  {variant: 'quad', fit: 'cover'},
];

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

const results = [];

for (let run = 1; run <= REPEATS; run += 1) {
  for (const config of CONFIGS) {
    // A fresh context per render: the video cache and the decoder pool must not
    // survive into the next measurement.
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(URL_, {waitUntil: 'load'});
    await page.waitForFunction(() => document.getElementById('status')?.textContent === 'ready', {timeout: 60_000});

    let out;
    try {
      out = await page.evaluate(
        (cfg) => window.__m0Render(cfg),
        config,
      );
    } catch (error) {
      out = {variant: config.variant, fit: config.fit, error: String(error)};
    }

    out.run = run;
    if (errors.length) out.pageErrors = errors.slice(0, 3);
    results.push(out);
    console.log(JSON.stringify(out));

    await context.close();
  }
}

await browser.close();
await writeFile('artifacts/m0/results.json', JSON.stringify(results, null, 2));
console.log('\nwrote artifacts/m0/results.json');
