// Renders the example in the container Chromium, then transcodes to MP4 and cuts
// the storyboard stills. Needs the dev server:
//   npm run dev -- --host 127.0.0.1 --port 4173
//
// Jobs:
//   full   — 9:16 / 1:1 / 16:9 at the 15s preset, plus 9:16 at 30s
//   hook   — 2s-worth of frames per Hook motion preset, for the still comparison
//
// EXAMPLE_JOBS=full,hook (default both) · EXAMPLE_LOCALE=ko · EXAMPLE_RATIOS to
// narrow the full jobs.
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
const stillDirectory = resolve(outDirectory, 'stills');
const url =
  process.env.EXAMPLE_URL ??
  'http://127.0.0.1:4173/artifacts/three-scene-example/example.html';
const jobs = (process.env.EXAMPLE_JOBS ?? 'full,hook').split(',');
const ratios = (process.env.EXAMPLE_RATIOS ?? '9:16,1:1,16:9').split(',');
const locale = process.env.EXAMPLE_LOCALE ?? 'ko';

/** Second marks the storyboard samples, one per phase of the 15s cut. */
const STILL_SECONDS = [0.5, 1.4, 2.4, 4.0, 7.0, 10.5, 12.3, 13.6];
const HOOK_PRESETS = ['impact', 'caption', 'focus'];
/** Entry motion runs 18 frames; sample it mid-flight and once settled. */
const HOOK_STILL_SECONDS = [0.18, 1.2];

const slug = (ratio) => ratio.replace(':', 'x');

const still = (input, second, output) =>
  execFileAsync(ffmpeg, [
    '-y', '-v', 'error',
    '-ss', String(second), '-i', input,
    '-frames:v', '1', '-q:v', '3',
    output,
  ]);

const toMp4 = (webmPath, mp4Path) =>
  execFileAsync(ffmpeg, [
    '-y', '-v', 'error',
    '-i', webmPath,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    mp4Path,
  ]);

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.EXAMPLE_CHROME ?? '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

await mkdir(stillDirectory, {recursive: true});
const summary = [];

/** One render in a fresh page, so no decoder state carries between jobs. */
const render = async (input) => {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  await page.goto(url, {waitUntil: 'load'});
  await page.waitForFunction(
    () => document.getElementById('status')?.textContent === 'ready',
    {timeout: 120_000},
  );
  const out = await page.evaluate((i) => window.__renderExample(i), input);
  await page.close();

  return {...out, pageErrors: errors.slice(0, 5)};
};

if (jobs.includes('full')) {
  const plan = [
    ...ratios.map((ratio) => ({ratio, preset: 15})),
    ...(ratios.includes('9:16') ? [{ratio: '9:16', preset: 30}] : []),
  ];

  for (const {ratio, preset} of plan) {
    const name = `three-scene-${slug(ratio)}-${preset}s`;
    const webmPath = resolve(outDirectory, `${name}.webm`);
    const mp4Path = resolve(outDirectory, `${name}.mp4`);
    const out = await render({locale, ratio, preset});

    await writeFile(webmPath, Buffer.from(out.base64, 'base64'));
    await toMp4(webmPath, mp4Path);

    const {stdout} = await execFileAsync(ffprobe.path, [
      '-v', 'error', '-print_format', 'json',
      '-show_entries',
      'stream=codec_name,width,height,r_frame_rate:format=duration,size',
      mp4Path,
    ]);

    if (ratio === '9:16' && preset === 15) {
      for (const second of STILL_SECONDS) {
        await still(mp4Path, second, resolve(stillDirectory, `t${String(second).replace('.', '_')}s.jpg`));
      }
    } else if (ratio === '9:16') {
      // The 30s cut: the same three phases, at that preset's boundaries.
      for (const second of [1.4, 14, 28.4]) {
        await still(mp4Path, second, resolve(stillDirectory, `p30-t${second}s.jpg`));
      }
    } else {
      await still(mp4Path, 7, resolve(stillDirectory, `ratio-${slug(ratio)}.jpg`));
    }

    summary.push({job: name, renderMs: out.totalMs, webmBytes: out.bytes, probe: JSON.parse(stdout), pageErrors: out.pageErrors});
    console.log(JSON.stringify(summary.at(-1)));
  }
}

if (jobs.includes('hook')) {
  for (const motionPreset of HOOK_PRESETS) {
    // 90 frames at 60fps: the Hook's first 1.5s, which is all the entry motion.
    const out = await render({locale, ratio: '9:16', preset: 15, motionPreset, frames: 90});
    const webmPath = resolve(outDirectory, `hook-${motionPreset}.webm`);
    await writeFile(webmPath, Buffer.from(out.base64, 'base64'));

    for (const second of HOOK_STILL_SECONDS) {
      await still(webmPath, second, resolve(stillDirectory, `hook-${motionPreset}-${String(second).replace('.', '_')}s.jpg`));
    }

    summary.push({job: `hook-${motionPreset}`, renderMs: out.totalMs, webmBytes: out.bytes, pageErrors: out.pageErrors});
    console.log(JSON.stringify(summary.at(-1)));
  }
}

await writeFile(
  resolve(outDirectory, 'summary.json'),
  JSON.stringify(summary, null, 2),
);
await browser.close();
