// Renders the example in the container Chromium, then transcodes to MP4 and cuts
// the storyboard stills. Needs the dev server:
//   npm run dev -- --host 127.0.0.1 --port 4173
//
// EXAMPLE_RATIOS=9:16,1:1,16:9 to pick the outputs; default is all three.
import {execFile} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import {chromium} from '@playwright/test';
import ffmpeg from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const outDirectory = resolve(here, 'out');
const url =
  process.env.EXAMPLE_URL ??
  'http://127.0.0.1:4173/artifacts/three-scene-example/example.html';
const ratios = (process.env.EXAMPLE_RATIOS ?? '9:16,1:1,16:9').split(',');
const locale = process.env.EXAMPLE_LOCALE ?? 'ko';

/** Second marks the storyboard samples, one per phase of the 15s cut. */
const STILL_SECONDS = [0.6, 1.4, 2.4, 4.0, 7.0, 10.5, 12.3, 13.6];

const slug = (ratio) => ratio.replace(':', 'x');

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.EXAMPLE_CHROME ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

await mkdir(outDirectory, {recursive: true});
const summary = [];

for (const ratio of ratios) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto(url, {waitUntil: 'load'});
  await page.waitForFunction(
    () => document.getElementById('status')?.textContent === 'ready',
    {timeout: 120_000},
  );

  const out = await page.evaluate(
    (input) => window.__renderExample(input),
    {locale, ratio},
  );
  await page.close();

  const webmPath = resolve(outDirectory, `three-scene-${slug(ratio)}.webm`);
  const mp4Path = resolve(outDirectory, `three-scene-${slug(ratio)}.mp4`);
  await writeFile(webmPath, Buffer.from(out.base64, 'base64'));

  // H.264 for delivery: the render itself is VP9 only because this container
  // cannot encode H.264 in the browser. ffmpeg's software encoder can.
  await execFileAsync(ffmpeg, [
    '-y', '-v', 'error',
    '-i', webmPath,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    mp4Path,
  ]);

  const {stdout} = await execFileAsync(ffprobe.path, [
    '-v', 'error', '-print_format', 'json',
    '-show_entries', 'stream=codec_name,width,height,r_frame_rate:format=duration,size',
    mp4Path,
  ]);

  if (ratio === '9:16') {
    const stillDirectory = resolve(outDirectory, 'stills');
    await mkdir(stillDirectory, {recursive: true});

    for (const second of STILL_SECONDS) {
      await execFileAsync(ffmpeg, [
        '-y', '-v', 'error',
        '-ss', String(second), '-i', mp4Path,
        '-frames:v', '1', '-q:v', '3',
        resolve(stillDirectory, `t${String(second).replace('.', '_')}s.jpg`),
      ]);
    }
  } else {
    await execFileAsync(ffmpeg, [
      '-y', '-v', 'error',
      '-ss', '7', '-i', mp4Path,
      '-frames:v', '1', '-q:v', '3',
      resolve(outDirectory, 'stills', `ratio-${slug(ratio)}.jpg`),
    ]);
  }

  summary.push({
    ratio,
    renderMs: out.totalMs,
    webmBytes: out.bytes,
    probe: JSON.parse(stdout),
    pageErrors: errors.slice(0, 5),
  });
  console.log(JSON.stringify(summary.at(-1)));
}

await writeFile(
  resolve(outDirectory, 'summary.json'),
  JSON.stringify(summary, null, 2),
);
await browser.close();
