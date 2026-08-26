// M5 verification: the whole four-panel flow through the real editor UI.
// Everything except the MP4 render, which this container cannot do (no H.264).
import {chromium} from '@playwright/test';

const b = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await b.newPage({viewport: {width: 1600, height: 1000}});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));

const fails = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

await page.goto('http://127.0.0.1:4173/', {waitUntil: 'load'});
const sel = page.getByTestId('template-selector');
await sel.waitFor({timeout: 30_000});

// --- the option is offered now (M2 hid it deliberately) ---
const values = await sel.evaluate((el) => [...el.options].map((o) => o.value));
check('selector offers day1-quad', values.includes('day1-quad'), JSON.stringify(values));

// --- 60s coercion is announced before it happens ---
await page.getByRole('button', {name: '60초'}).click();
await sel.selectOption('day1-quad');
check(
  'dialog warns the 60s project will become 30s',
  await page.getByTestId('template-switch-preset-note').isVisible(),
);
await page.getByTestId('template-switch-confirm').click();
await page.waitForTimeout(800);

// --- the axis, the presets, the inspector ---
const clips = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid^="timeline-clip-"]')].map((e) =>
    e.getAttribute('data-testid')));
check(
  'timeline shows five sections',
  JSON.stringify(clips) === JSON.stringify([
    'timeline-clip-panel-a', 'timeline-clip-panel-b', 'timeline-clip-panel-c',
    'timeline-clip-panel-d', 'timeline-clip-endcard',
  ]),
  JSON.stringify(clips),
);
const presets = await page.evaluate(() =>
  [...document.querySelectorAll('button')].map((b) => b.textContent).filter((t) => /^\d+초$/.test(t ?? '')));
check('presets narrow to 15/30', JSON.stringify(presets) === '["15초","30초"]', JSON.stringify(presets));
check('inspector says Day1(4 video)',
  (await page.getByTestId('inspector-template').textContent()) === 'Day1(4 video)');

const panelSections = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid^="section-day1-panel-"]')]
    .map((e) => e.getAttribute('data-testid')));
check(
  'inspector shows four panel sections',
  JSON.stringify(panelSections) === JSON.stringify([
    'section-day1-panel-a', 'section-day1-panel-b',
    'section-day1-panel-c', 'section-day1-panel-d',
  ]),
  JSON.stringify(panelSections),
);

// --- upload four videos ---
for (const [i, letter] of ['a', 'b', 'c', 'd'].entries()) {
  await page.locator(`[data-testid="day1-panel-${letter}-input"]`)
    .setInputFiles(`artifacts/m0/sources/m0-${letter}.webm`);
  await page.waitForTimeout(600);
  if (i === 0) {
    check('blocker still shown after one upload',
      await page.getByTestId('day1-panels-blocker').isVisible().catch(() => false));
  }
}
await page.waitForTimeout(1500);
check(
  'render blocker clears once all four are uploaded (Q6)',
  (await page.getByTestId('day1-panels-blocker').count()) === 0,
);

// --- labels arrive prefilled in every locale (Q9) ---
const labels = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid^="day1-label-"]')]
    .map((e) => e.value ?? e.textContent).filter(Boolean));
check('four labels prefilled Day1/Day2/Day3/Day7',
  ['Day1', 'Day2', 'Day3', 'Day7'].every((v) => labels.includes(v)),
  JSON.stringify(labels));

// --- the preview must leave the placeholder and draw four video elements ---
await page.waitForTimeout(2500);
check(
  'preview leaves the "upload four" placeholder',
  (await page.locator('text=영상 4개를 모두 업로드하세요').count()) === 0,
);
// Remotion composites the panels as DOM, so there is no single preview canvas to
// read (all eight are 1920x1080 source frames). Screenshot the preview instead
// and sample its pixels — SC3 (greyscale) and the grid, as they will be rendered.
const preview = page.locator('.stage .player, .stage__frame, .stage > div').first();
await page.screenshot({path: 'artifacts/m1/quad-preview.png'});

// The preview box, in page coordinates, from the tallest 9:16 element on screen.
const box = await page.evaluate(() => {
  const target = 1080 / 1920;
  const best = [...document.querySelectorAll('.stage *')]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.height > 300 && Math.abs(r.width / r.height - target) < 0.03)
    .sort((a, b) => b.height - a.height)[0];

  return best
    ? {x: Math.round(best.x), y: Math.round(best.y), w: Math.round(best.width), h: Math.round(best.height)}
    : null;
});
check('found the 9:16 preview box', box !== null, JSON.stringify(box));

if (box) {
  await page.screenshot({
    path: 'artifacts/m1/quad-cells.png',
    clip: {x: box.x, y: box.y, width: box.w, height: box.h},
  });
  console.log(`      preview box ${box.w}x${box.h} at ${box.x},${box.y}`);

  // One clip per quadrant, taken well inside the cell so the sample lands on the
  // source rather than the blurred `contain` backdrop or the divider.
  const quadrants = {
    a: [0.28, 0.30],
    b: [0.72, 0.30],
    c: [0.28, 0.80],
    d: [0.72, 0.80],
  };

  for (const [slot, [fx, fy]] of Object.entries(quadrants)) {
    await page.screenshot({
      path: `artifacts/m1/cell-${slot}.png`,
      clip: {
        x: box.x + box.w * fx - 8,
        y: box.y + box.h * fy - 8,
        width: 16,
        height: 16,
      },
    });
  }
  console.log('      wrote cell-a/b/c/d.png for the saturation check');
}

check('no page errors', errors.length === 0, JSON.stringify(errors.slice(0, 2)));

await page.screenshot({path: 'artifacts/m1/quad-editor.png', fullPage: false});
await b.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
