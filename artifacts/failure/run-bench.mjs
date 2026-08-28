// failure-video SC7 driver. Alternates the two configurations in fresh contexts
// so no decoder pool or video cache carries between measurements, and reports
// medians rather than a single run.
//
//   npm run dev -- --host 127.0.0.1 --port 4173   # in another shell
//   node artifacts/m0/make-sources.mjs            # once, for the VP9 sources
//   node artifacts/failure/run-bench.mjs
import {writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium} from '@playwright/test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PAGE = 'http://127.0.0.1:4173/artifacts/failure/bench.html';
const REPEATS = Number(process.env.FAILURE_BENCH_REPEATS ?? 3);

/**
 * Two windows, because the effects are not spread evenly through the video:
 *
 * - `beat` covers frames 60-239, which contains the whole FAIL beat (the last
 *   45 frames of level 1) and the punch out. This is the worst case.
 * - `plain` covers frames 300-479, deep inside level 3, where no effect fires
 *   at all. Here the two configurations should be indistinguishable — which is
 *   Design Goal 4's claim (`style: undefined` outside an effect) stated as a
 *   measurement rather than as an intention.
 */
const WINDOWS = [
  {name: 'beat', from: 60, frames: 180},
  {name: 'plain', from: 300, frames: 180},
];

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});

const runs = [];

for (let repeat = 1; repeat <= REPEATS; repeat += 1) {
  for (const window of WINDOWS) {
    for (const effects of [true, false]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];

      page.on('pageerror', (error) => errors.push(String(error)));

      await page.goto(PAGE, {waitUntil: 'load'});
      await page.waitForFunction(
        () => document.getElementById('status')?.textContent === 'ready',
        {timeout: 60_000},
      );

      let out;

      try {
        out = await page.evaluate(
          (config) => window.__failureBench(config),
          {effects, frames: window.frames, from: window.from},
        );
      } catch (error) {
        out = {effects, window: window.name, error: String(error)};
      }

      out.window = window.name;
      out.repeat = repeat;

      if (errors.length) {
        out.pageErrors = errors.slice(0, 2);
      }

      runs.push(out);
      console.log(JSON.stringify(out));

      await context.close();
    }
  }
}

await browser.close();

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

const summary = WINDOWS.map(({name}) => {
  const at = (effects) =>
    median(
      runs
        .filter(
          (run) => run.window === name && run.effects === effects && !run.error,
        )
        .map((run) => run.msPerFrame),
    );
  const on = at(true);
  const off = at(false);

  return {
    window: name,
    msPerFrameEffectsOn: on,
    msPerFrameEffectsOff: off,
    overheadPercent: off ? Number((((on - off) / off) * 100).toFixed(1)) : null,
  };
});

console.log('\n--- SC7 summary (median of %d runs) ---', REPEATS);
console.table(summary);

await writeFile(
  resolve(projectRoot, 'artifacts/failure/bench-results.json'),
  `${JSON.stringify({runs, summary}, null, 2)}\n`,
);
console.log('artifacts/failure/bench-results.json');
