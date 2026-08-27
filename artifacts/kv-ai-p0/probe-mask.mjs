// kv-ai-designation P0 — one focused question the main harness cannot answer
// from IoU alone: is the returned mask a hard label or a soft field?
//
// It decides whether the app gets a free "tighter / looser" knob (re-threshold,
// no re-inference) or has to re-run the model to change the boundary.
import {createServer} from 'node:http';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium} from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const PORT = Number(process.env.KV_AI_P0_PORT ?? 4184);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.tflite': 'application/octet-stream',
};

const PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
import {FilesetResolver, InteractiveSegmenterLegacy} from './vendor/package/vision_bundle.mjs';
import {FIXTURES, drawArt, drawGroundTruth} from './fixtures.js';

const fileset = await FilesetResolver.forVisionTasks('./vendor/package/wasm');
const segmenter = await InteractiveSegmenterLegacy.createFromOptions(fileset, {
  baseOptions: {modelAssetPath: './models/magic_touch.tflite', delegate: 'CPU'},
  outputCategoryMask: true,
  outputConfidenceMasks: true,
});
const report = {};

for (const fixture of FIXTURES) {
  const canvas = drawArt(fixture);
  const truth = drawGroundTruth(fixture);
  const output = await new Promise((resolve) => {
    segmenter.segment(canvas, {keypoint: fixture.click}, resolve);
  });
  const entry = {};

  for (const [name, mask] of [
    ['categoryMask', output.categoryMask],
    ['confidenceMask', output.confidenceMasks && output.confidenceMasks[0]],
  ]) {
    if (!mask) continue;
    const floats = mask.getAsFloat32Array();
    const bytes = mask.getAsUint8Array();
    const histogram = new Array(10).fill(0);
    let min = Infinity;
    let max = -Infinity;
    let mid = 0;

    for (let i = 0; i < floats.length; i += 1) {
      const v = floats[i];
      min = Math.min(min, v);
      max = Math.max(max, v);
      histogram[Math.min(9, Math.max(0, Math.floor(v * 10)))] += 1;
      if (v > 0.05 && v < 0.95) mid += 1;
    }

    // How the IoU moves if the app just re-thresholds the same field.
    const sweep = [0.2, 0.35, 0.5, 0.65, 0.8].map((t) => {
      let inter = 0;
      let union = 0;
      for (let i = 0; i < floats.length; i += 1) {
        const a = floats[i] >= t ? 1 : 0;
        const b = truth[i];
        if (a | b) { union += 1; if (a & b) inter += 1; }
      }
      return {threshold: t, iou: Number((union ? inter / union : 0).toFixed(3))};
    });

    entry[name] = {
      size: mask.width + 'x' + mask.height,
      floatMin: Number(min.toFixed(4)),
      floatMax: Number(max.toFixed(4)),
      uint8Distinct: new Set(bytes.slice(0, 200000)).size,
      fractionBetween05and95: Number((mid / floats.length).toFixed(5)),
      histogram,
      thresholdSweep: sweep,
    };
  }

  report[fixture.name] = entry;
  output.close();
}

segmenter.close();
window.__PROBE__ = report;
</script>`;

const server = createServer((request, response) => {
  const relative = normalize(decodeURI(request.url.split('?')[0])).replace(
    /^(\.\.[/\\])+/,
    '',
  );

  if (relative === '/probe.html') {
    response.writeHead(200, {'content-type': TYPES['.html']});
    response.end(PAGE);

    return;
  }

  const file = [join(HERE, relative), join(OUT, relative)].find(
    (path) => existsSync(path) && extname(path),
  );

  if (!file) {
    response.writeHead(404);
    response.end('not found');

    return;
  }

  response.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
  });
  response.end(readFileSync(file));
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

const browser = await chromium.launch({
  args: ['--no-sandbox'],
  executablePath: process.env.KV_AI_P0_CHROME,
});
const page = await browser.newPage();
page.on('pageerror', (error) => console.log(`pageerror: ${error.message}`));
await page.goto(`http://127.0.0.1:${PORT}/probe.html`, {waitUntil: 'load'});
await page.waitForFunction(() => window.__PROBE__ !== undefined, null, {
  timeout: 5 * 60 * 1000,
});
const report = await page.evaluate(() => window.__PROBE__);
await browser.close();
await new Promise((resolve) => server.close(resolve));

writeFileSync(join(OUT, 'mask-probe.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
