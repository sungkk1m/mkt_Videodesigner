import {readFile, writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const URL_ = 'http://127.0.0.1:4173/artifacts/m0/spike.html';
const REPEATS = Number(process.env.M0_REPEATS ?? 2);
const CONFIGS = [
  {variant: 'day1-baked', fit: 'contain'},
  {variant: 'quad-baked', fit: 'contain'},
];

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const results = [];
for (let run = 1; run <= REPEATS; run += 1) {
  for (const config of CONFIGS) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(URL_, {waitUntil: 'load'});
    await page.waitForFunction(() => document.getElementById('status')?.textContent === 'ready', {timeout: 60_000});
    let out;
    try { out = await page.evaluate((c) => window.__m0Render(c), config); }
    catch (e) { out = {variant: config.variant, fit: config.fit, error: String(e).slice(0, 400)}; }
    out.run = run;
    if (errors.length) out.pageErrors = errors.slice(0, 3);
    results.push(out);
    console.log(JSON.stringify(out));
    await context.close();
  }
}
await browser.close();
const prior = JSON.parse(await readFile('artifacts/m0/results.json', 'utf8'));
await writeFile('artifacts/m0/results.json', JSON.stringify([...prior, ...results], null, 2));
console.log('\nappended to artifacts/m0/results.json');
