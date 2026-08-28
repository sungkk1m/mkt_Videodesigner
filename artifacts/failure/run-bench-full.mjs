// SC7 headline: the whole 30s video, both ways. The windowed run isolates where
// the cost is; this one says what it amounts to over a real output.
import {chromium} from '@playwright/test';

const PAGE = 'http://127.0.0.1:4173/artifacts/failure/bench.html';
const browser = await chromium.launch({headless:true,executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
const out = [];

for (const effects of [true, false]) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(PAGE, {waitUntil: 'load'});
  await page.waitForFunction(() => document.getElementById('status')?.textContent === 'ready', {timeout: 60_000});
  const result = await page.evaluate((c) => window.__failureBench(c), {effects, frames: 900, from: 0});
  console.log(JSON.stringify(result));
  out.push(result);
  await context.close();
}

await browser.close();
const med = (v) => v.sort((a,b)=>a-b)[Math.floor(v.length/2)];
const on = med(out.filter(r=>r.effects).map(r=>r.msPerFrame));
const off = med(out.filter(r=>!r.effects).map(r=>r.msPerFrame));
console.log(`\nfull 900 frames — effects on ${on}ms/frame, off ${off}ms/frame, overhead ${(((on-off)/off)*100).toFixed(1)}%`);
