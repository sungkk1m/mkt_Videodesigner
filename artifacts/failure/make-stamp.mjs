// failure-video Design §6.4 — rasterises `fail-stamp.svg` to the transparent
// PNG the composition imports.
//
// Chromium rather than a CLI rasteriser because this container has none, and
// because Chromium is the renderer that will draw the composition anyway: what
// it puts in the PNG is what the render will show. `feTurbulence` is a specified
// PRNG, so the texture is the same every run.
//
//   node artifacts/failure/make-stamp.mjs
import {readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium} from '@playwright/test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const assets = resolve(projectRoot, 'src/compositions/failure/assets');
const WIDTH = 1600;
const HEIGHT = 700;

const svg = await readFile(resolve(assets, 'fail-stamp.svg'), 'utf8');

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: {width: WIDTH, height: HEIGHT},
  deviceScaleFactor: 1,
});

await page.setContent(
  `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`,
  {waitUntil: 'load'},
);

const png = await page.screenshot({omitBackground: true, type: 'png'});

await writeFile(resolve(assets, 'fail-stamp.png'), png);
await browser.close();

console.log(`fail-stamp.png  ${WIDTH}x${HEIGHT}  ${(png.length / 1024).toFixed(1)}KB`);
