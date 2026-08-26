// Live-report fixes, verified through the real editor UI on the quad template.
// One check per reported defect, each of which reproduced on build fd7ad18:
//   #1 the end card could not switch to video mode (updateDay1EndCard no-op),
//      so its upload slot was unreachable — plus the split/label commands from
//      the same no-op family.
//   #2 the render gate read the three-scene source on quad, so the render
//      button (and Batch preflight) treated four uploaded panels as none.
//   #3 clip selection routed down the three-scene arm ("hook 선택됨"), and
//      ruler scrubbing is asserted to keep seeking mid-drag.
//   #4 section boundaries remounted every panel video from scratch; premountFor
//      now mounts the next section's grid one second early.
// The MP4 render itself still cannot run here (no H.264 in this Chromium).
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

await sel.selectOption('day1-quad');
await page.getByTestId('template-switch-confirm').click();
await page.waitForTimeout(500);

// --- four panel uploads (VP9 sources; this Chromium decodes those) ---
for (const letter of ['a', 'b', 'c', 'd']) {
  await page
    .getByTestId(`day1-panel-${letter}-input`)
    .setInputFiles(`artifacts/m0/sources/m0-${letter}.webm`);
  await page
    .getByTestId(`day1-panel-${letter}-metadata`)
    .filter({hasText: '초'})
    .waitFor({timeout: 30_000});
}

// ============ #1 — the shared-field commands take effect on quad ============
// The end card group is a collapsed <details>; open it before reaching inside.
await page.getByTestId('section-day1-endcard').click();
await page.getByTestId('day1-endcard-mode-video').click();
const videoField = page.getByTestId('day1-endcard-video');
check('endcard switches to video mode', await videoField.count() === 1);

await videoField.setInputFiles('artifacts/m0/sources/m0-a.webm');
await page.getByTestId('day1-endcard-trim-range').waitFor({timeout: 30_000});
check('endcard video upload lands', true);

const trimText = await page.getByTestId('day1-endcard-trim-range').textContent();
check('endcard trim reads the uploaded source', /소스 구간/.test(trimText ?? ''), trimText ?? '');

const splitSummary = page.getByTestId('section-day1-split');
if (await splitSummary.count()) {
  const openAlready = await splitSummary.evaluate((el) => el.closest('details')?.open);
  if (!openAlready) await splitSummary.click();
}
await page.getByTestId('day1-split-color').fill('#ff00ff');
await page.waitForTimeout(300);
const lineColor = await page
  .getByTestId('day1-quad-split-line-0')
  .first()
  .evaluate((el) => getComputedStyle(el).backgroundColor);
check('split colour reaches the preview divider', lineColor === 'rgb(255, 0, 255)', lineColor);

// ============ #2 — the render gate resolves the quad panels ============
// The render button also needs H.264 capabilities this Chromium lacks, so the
// gate is read where it is testable here: the Batch preflight, which consumes
// the same `renderableSource`. Before the fix it reported the three-scene
// '영상을 올린 후' / '연결되지 않았습니다' issue with all four panels uploaded.
await page.getByRole('button', {name: 'Batch'}).click();
await page.getByTestId('batch-dialog').waitFor({timeout: 10_000});
const preflight = await page.getByTestId('batch-preflight').count();
const preflightText = preflight
  ? await page.getByTestId('batch-preflight').textContent()
  : '';
check(
  'batch preflight raises no source blocker with four panels uploaded',
  preflight === 0 || !/패널|영상/.test(preflightText ?? ''),
  preflightText ?? '(none)',
);
await page.getByTestId('batch-close').click();

// ============ #3 — selection and scrubbing on the shared axis ============
await page.getByTestId('timeline-clip-panel-c').click();
await page.waitForTimeout(200);
const selected = await page.locator('.timeline__scene').textContent();
check('clicking a quad clip selects it (not "hook")', /패널 C/.test(selected ?? ''), selected ?? '');

// Drag the ruler: pointer down, two moves, no release — the playhead must
// follow while the pointer is still down.
const ruler = page.locator('.timeline__ruler');
const box = await ruler.boundingBox();
if (box) {
  const y = box.y + box.height / 2;
  const timeAt = async () =>
    (await page.getByTestId('transport-time').textContent()) ?? '';

  await page.mouse.move(box.x + box.width * 0.1, y);
  await page.mouse.down();
  await page.waitForTimeout(100);
  const t1 = await timeAt();
  await page.mouse.move(box.x + box.width * 0.4, y, {steps: 5});
  await page.waitForTimeout(150);
  const t2 = await timeAt();
  await page.mouse.move(box.x + box.width * 0.7, y, {steps: 5});
  await page.waitForTimeout(150);
  const t3 = await timeAt();
  await page.mouse.up();

  check('playhead follows mid-drag (scrub, not click-only)', t1 !== t2 && t2 !== t3,
    `${t1} → ${t2} → ${t3}`);
} else {
  check('playhead follows mid-drag (scrub, not click-only)', false, 'ruler not found');
}

// ============ #4 — the next section premounts before its boundary ============
// Section boundaries sit at 3s/6s/9s/12s (15s preset). One second before a
// boundary the next Sequence must already be mounted (opacity 0), so more
// <video> elements exist near the boundary than mid-section.
// Each mounted QuadFrame carries one `day1-quad-split-line-0` element, so the
// number of those is the number of mounted section grids. (`<video>` counts are
// no signal here: @remotion/media draws through its own pipeline, and the
// dropzone thumbnails and trim strips own <video> tags of their own.) Seek by
// clicking the ruler, the same path a user takes.
const countGrids = async (seconds) => {
  const rulerBox = await page.locator('.timeline__ruler').boundingBox();
  await page.mouse.click(
    rulerBox.x + rulerBox.width * (seconds / 15),
    rulerBox.y + rulerBox.height / 2,
  );
  await page.waitForTimeout(500);
  return page.evaluate(
    () => document.querySelectorAll('[data-testid="day1-quad-split-line-0"]').length,
  );
};

const midSection = await countGrids(1.0);   // deep inside section A
const nearBoundary = await countGrids(2.5); // 0.5s before the A→B boundary
check(
  'next section premounts ahead of the boundary',
  midSection === 1 && nearBoundary === 2,
  `mid-section ${midSection} grid(s), near boundary ${nearBoundary}`,
);

check('no page errors', errors.length === 0, errors.join(' | '));

console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
await b.close();
process.exit(fails.length ? 1 : 0);
