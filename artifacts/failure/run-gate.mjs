// failure-video M4 gate (Design §11, R-2) — photographs the real
// `FailureComposition` at the frames Plan §1.2 and §1.3 measured, and asserts
// the geometry those measurements pin down.
//
// The reference mp4 itself is not in this session (handoff §"지금 상태"), so the
// comparison is against its *numbers*, which is what the Plan preserved them
// for: bar height 10% of the frame, caption cap height ≈3.7%, the stamp inside
// the 15-55% band and reaching past both edges, a settled tilt of -8 degrees.
//
//   npm run dev -- --host 127.0.0.1 --port 4173   # in another shell
//   node artifacts/m0/make-sources.mjs            # once, for the VP9 sources
//   node artifacts/failure/run-gate.mjs
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium} from '@playwright/test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = resolve(projectRoot, 'artifacts/failure/frames');
const PAGE = 'http://127.0.0.1:4173/artifacts/failure/gate.html';
const FPS = 30;

// The 30s preset: 5.4s / 2.7s / 18.9s / 3s.
const LEVEL_ONE_FRAMES = Math.round(5.4 * FPS); // 162
const LEVEL_TWO_START = LEVEL_ONE_FRAMES; // 162
const LEVEL_THREE_START = LEVEL_TWO_START + Math.round(2.7 * FPS); // 243

/**
 * Plan §1.2 puts the beat in the last 1.5s of level 1: 0.5s of lead-in zoom,
 * then 1.0s of stamp. §1.3 puts the punch in the last 0.25s of a segment and the
 * settle in the first 0.3s of the next.
 */
const SHOTS = [
  {name: '01-level1-rest', ratio: '9:16', frame: 30, note: '레벨 1 평상 프레임'},
  {name: '02-lead-start', ratio: '9:16', frame: LEVEL_ONE_FRAMES - 45, note: '펀치 줌 시작 (마지막 1.5s)'},
  {name: '03-lead-mid', ratio: '9:16', frame: LEVEL_ONE_FRAMES - 38, note: '줌·탈색 진행 중'},
  {name: '04-stamp-slam', ratio: '9:16', frame: LEVEL_ONE_FRAMES - 30, note: '스탬프 진입 (4x, 반투명, 블러)'},
  {name: '05-stamp-mid', ratio: '9:16', frame: LEVEL_ONE_FRAMES - 26, note: '스탬프 하강 중'},
  {name: '06-stamp-settled', ratio: '9:16', frame: LEVEL_ONE_FRAMES - 22, note: '스탬프 안착 + 셰이크'},
  {name: '07-stamp-hold', ratio: '9:16', frame: LEVEL_ONE_FRAMES - 12, note: '스탬프 유지 (탈색 최대)'},
  {name: '08-punch-out', ratio: '9:16', frame: LEVEL_ONE_FRAMES - 1, note: '아웃고잉 펀치 최대'},
  {name: '09-punch-in', ratio: '9:16', frame: LEVEL_TWO_START, note: '레벨 20 인커밍 (줌 상태)'},
  {name: '10-level2-settled', ratio: '9:16', frame: LEVEL_TWO_START + 10, note: '레벨 20 안착'},
  {name: '11-level3', ratio: '9:16', frame: LEVEL_THREE_START + 30, note: '레벨 99'},
  {name: '12-level1-landscape', ratio: '16:9', frame: 30, note: '가로 평상 프레임'},
  {name: '13-stamp-landscape', ratio: '16:9', frame: LEVEL_ONE_FRAMES - 12, note: '가로 스탬프 유지'},
];

await mkdir(outDir, {recursive: true});

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
const pageErrors = [];

page.on('pageerror', (error) => pageErrors.push(String(error)));

await page.goto(PAGE, {waitUntil: 'load'});
await page.waitForFunction(
  () => document.getElementById('status')?.textContent === 'ready',
  {timeout: 60_000},
);

const fails = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

for (const shot of SHOTS) {
  await page.evaluate(
    ({ratio, frame}) => window.__failureGate(ratio, frame),
    shot,
  );

  const host = page.locator('#frame');

  await writeFile(
    resolve(outDir, `${shot.name}.png`),
    await host.screenshot(),
  );
}

// --- the geometry Plan §1.4 measured, read off the live DOM -----------------
await page.evaluate(({ratio, frame}) => window.__failureGate(ratio, frame), {
  ratio: '9:16',
  frame: LEVEL_ONE_FRAMES - 12,
});

const geometry = await page.evaluate(() => {
  const host = document.getElementById('frame');
  const bar = host?.querySelector('[data-testid="failure-caption-bar"]');
  const stamp = host?.querySelector('[data-testid="failure-stamp"]');
  const text = bar?.querySelector('span');
  const hostBox = host?.getBoundingClientRect();
  const box = (element) => {
    if (!element || !hostBox) return null;
    const rect = element.getBoundingClientRect();

    return {
      left: (rect.left - hostBox.left) / hostBox.width,
      top: (rect.top - hostBox.top) / hostBox.height,
      right: (rect.right - hostBox.left) / hostBox.width,
      bottom: (rect.bottom - hostBox.top) / hostBox.height,
      width: rect.width / hostBox.width,
      height: rect.height / hostBox.height,
    };
  };

  return {
    bar: box(bar),
    stamp: box(stamp),
    text: box(text),
    barColor: bar ? getComputedStyle(bar).backgroundColor : null,
    textColor: text ? getComputedStyle(text).color : null,
    stampTransform: stamp ? getComputedStyle(stamp).transform : null,
  };
});

console.log(JSON.stringify(geometry, null, 2));

// Plan §1.4 — the bar is 10% of the frame height, sitting on the bottom edge.
check(
  'caption bar is 10% of the frame height',
  Math.abs((geometry.bar?.height ?? 0) - 0.1) < 0.005,
  `${((geometry.bar?.height ?? 0) * 100).toFixed(2)}%`,
);
check(
  'caption bar sits on the bottom edge, full width',
  Math.abs((geometry.bar?.bottom ?? 0) - 1) < 0.005 &&
    Math.abs((geometry.bar?.width ?? 0) - 1) < 0.005,
  `bottom ${(geometry.bar?.bottom ?? 0).toFixed(3)}, width ${(geometry.bar?.width ?? 0).toFixed(3)}`,
);
check(
  'caption bar is black with white text',
  geometry.barColor === 'rgb(0, 0, 0)' && geometry.textColor === 'rgb(255, 255, 255)',
  `${geometry.barColor} / ${geometry.textColor}`,
);
// Plan §1.4 — cap height ≈3.7% of the frame. A 100px glyph on a 1920-high
// canvas is 5.2% of line box; the cap itself is ~0.72 of that.
check(
  'caption cap height is near the measured 3.7% of the frame',
  Math.abs((geometry.text?.height ?? 0) * 0.72 - 0.037) < 0.008,
  `line box ${((geometry.text?.height ?? 0) * 100).toFixed(2)}% → cap ≈ ${(
    (geometry.text?.height ?? 0) * 0.72 * 100
  ).toFixed(2)}%`,
);

// Plan §1.2 — the settled stamp reaches past both edges and lives in the
// 15-55% band of the frame height.
check(
  'stamp reaches past both frame edges',
  (geometry.stamp?.left ?? 0) < 0 && (geometry.stamp?.right ?? 0) > 1,
  `left ${(geometry.stamp?.left ?? 0).toFixed(3)}, right ${(geometry.stamp?.right ?? 0).toFixed(3)}`,
);
check(
  'stamp sits inside the measured 15-55% height band',
  (geometry.stamp?.top ?? 0) > 0.1 && (geometry.stamp?.bottom ?? 0) < 0.6,
  `top ${(geometry.stamp?.top ?? 0).toFixed(3)}, bottom ${(geometry.stamp?.bottom ?? 0).toFixed(3)}`,
);
// The -8 degree tilt, read back out of the composed matrix.
const matrix = /matrix\(([^)]+)\)/.exec(geometry.stampTransform ?? '');
const angle = matrix
  ? (Math.atan2(
      Number(matrix[1].split(',')[1]),
      Number(matrix[1].split(',')[0]),
    ) *
      180) /
    Math.PI
  : null;

check(
  'settled stamp is tilted by the measured -8 degrees',
  angle !== null && Math.abs(angle + 8) < 0.5,
  `${angle?.toFixed(2)}°`,
);

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

await browser.close();
console.log(
  fails.length
    ? `\n${fails.length} FAILED`
    : `\nall checks passed — ${SHOTS.length} frames in artifacts/failure/frames/`,
);
process.exit(fails.length ? 1 : 0);
