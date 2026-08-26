import {chromium} from '@playwright/test';
const browser = await chromium.launch({headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto('http://127.0.0.1:4173/artifacts/m0/spike.html', {waitUntil: 'load'});
await page.waitForFunction(() => document.getElementById('status')?.textContent === 'ready', {timeout: 60000});
for (const cfg of [{variant:'day1',fit:'contain',frames:30},{variant:'quad',fit:'contain',frames:30}]) {
  const t = Date.now();
  try {
    const r = await page.evaluate((c) => window.__m0Render(c), cfg);
    console.log(JSON.stringify({...r, wallMs: Date.now()-t}));
  } catch (e) { console.log('FAIL', cfg.variant, String(e).slice(0,400)); }
}
if (errs.length) console.log('ERRORS:', errs.slice(0,5));
await browser.close();
