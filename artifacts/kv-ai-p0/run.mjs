// kv-ai-designation P0 — serves the spike and runs it in Chromium.
//
// Served twice: once with the cross-origin-isolation headers and once without,
// because GitHub Pages cannot send them (deploy-pages.yml serves static files
// with no header control). Whatever the second run measures is what a deployed
// user would get.
import {createServer} from 'node:http';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, extname, join, normalize} from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium} from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const PORT = Number(process.env.KV_AI_P0_PORT ?? 4183);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.tflite': 'application/octet-stream',
  '.json': 'application/json',
};

const serve = (isolated) =>
  new Promise((resolve) => {
    const server = createServer((request, response) => {
      const relative = normalize(decodeURI(request.url.split('?')[0])).replace(
        /^(\.\.[/\\])+/,
        '',
      );
      const candidates = [join(HERE, relative), join(OUT, relative)];
      const file = candidates.find((path) => existsSync(path) && extname(path));

      if (!file) {
        response.writeHead(404);
        response.end('not found');

        return;
      }

      const headers = {'content-type': TYPES[extname(file)] ?? 'application/octet-stream'};

      if (isolated) {
        headers['cross-origin-opener-policy'] = 'same-origin';
        headers['cross-origin-embedder-policy'] = 'require-corp';
        headers['cross-origin-resource-policy'] = 'same-origin';
      }

      response.writeHead(200, headers);
      response.end(readFileSync(file));
    });

    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });

const measure = async (isolated) => {
  const server = await serve(isolated);
  const browser = await chromium.launch({
    args: ['--no-sandbox'],
    executablePath: process.env.KV_AI_P0_CHROME,
  });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (message) => logs.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', (error) => logs.push(`pageerror: ${error.message}`));

  const wallStart = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}/spike.html`, {waitUntil: 'load'});
  await page.waitForFunction(() => window.__RESULT__ !== undefined, null, {
    timeout: 15 * 60 * 1000,
  });
  const result = await page.evaluate(() => window.__RESULT__);
  result.wallMs = Date.now() - wallStart;
  result.isolatedHeaders = isolated;
  result.logs = logs.slice(0, 20);

  if (!isolated) {
    const art = await page.evaluate(() => window.__ART__ ?? {});

    for (const [name, dataUrl] of Object.entries(art)) {
      writeFileSync(
        join(OUT, `fixture-${name}.png`),
        Buffer.from(dataUrl.split(',')[1], 'base64'),
      );
    }
  }

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  return result;
};

mkdirSync(OUT, {recursive: true});

const runs = {};

for (const isolated of [false, true]) {
  const label = isolated ? 'isolated' : 'pages';
  process.stdout.write(`running ${label}…\n`);
  runs[label] = await measure(isolated);

  if (runs[label].fatal) {
    process.stdout.write(`${label} FATAL: ${runs[label].fatal}\n`);
  }
}

writeFileSync(join(OUT, 'results.json'), `${JSON.stringify(runs, null, 2)}\n`);
process.stdout.write(`wrote ${join(OUT, 'results.json')}\n`);
