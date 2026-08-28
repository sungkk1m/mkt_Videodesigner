// failure-video R-2 — the stamp against a dark frame, which is where it has to
// hold up. A PNG on a white page hides exactly the failure mode that matters:
// ink gaps read as white flecks unless they are genuinely transparent.
//
//   node artifacts/failure/preview-stamp.mjs
import {readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium} from '@playwright/test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const png = await readFile(
  resolve(projectRoot, 'src/compositions/failure/assets/fail-stamp.png'),
);
const dataUri = `data:image/png;base64,${png.toString('base64')}`;

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({viewport: {width: 1080, height: 1080}});

// Three grounds: a mid grey game frame, a dark one, and a light one.
await page.setContent(`<!doctype html><html><body style="margin:0">
  <div style="height:360px;background:#4a5058;position:relative;overflow:hidden">
    <img src="${dataUri}" style="position:absolute;left:-10%;top:60px;width:120%;transform:rotate(-8deg)">
  </div>
  <div style="height:360px;background:#12151a;position:relative;overflow:hidden">
    <img src="${dataUri}" style="position:absolute;left:-10%;top:60px;width:120%;transform:rotate(-8deg)">
  </div>
  <div style="height:360px;background:#d8d2c4;position:relative;overflow:hidden">
    <img src="${dataUri}" style="position:absolute;left:-10%;top:60px;width:120%;transform:rotate(-8deg)">
  </div>
</body></html>`);

await writeFile(
  resolve(projectRoot, 'artifacts/failure/stamp-on-grounds.png'),
  await page.screenshot(),
);
await browser.close();

console.log('artifacts/failure/stamp-on-grounds.png');
