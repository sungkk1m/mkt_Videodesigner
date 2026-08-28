// Cross-template regression check for the day1-quad cycle's shared-path
// changes (template selector dropdown, panelKeysOf-driven gates, the six
// shared-field commands, endCardSectionMs, preset narrowing, premount).
// Exercises the three templates that existed before the cycle — three-scene,
// Day1 (two panels), and the key-visual loop — through the real editor UI.
// The MP4 render itself cannot run here (no H.264 in this Chromium).
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

const presetLabels = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .map((el) => el.textContent)
      .filter((t) => /^\d+초$/.test(t ?? '')),
  );

const batchPreflightText = async () => {
  await page.getByRole('button', {name: 'Batch'}).click();
  await page.getByTestId('batch-dialog').waitFor({timeout: 10_000});
  const count = await page.getByTestId('batch-preflight').count();
  const text = count
    ? await page.getByTestId('batch-preflight').textContent()
    : '';
  await page.getByTestId('batch-close').click();
  return text ?? '';
};

const switchTo = async (kind) => {
  await page.getByTestId('template-selector').selectOption(kind);
  await page.getByTestId('template-switch-confirm').click();
  await page.waitForTimeout(400);
};

await page.goto('http://127.0.0.1:4173/', {waitUntil: 'load'});
await page.getByTestId('template-selector').waitFor({timeout: 30_000});

// ===================== three-scene (the default) =====================
check('three-scene presets stay 15/30/60',
  JSON.stringify(await presetLabels()) === '["15초","30초","60초"]',
  JSON.stringify(await presetLabels()));

await page.getByTestId('source-input')
  .setInputFiles('artifacts/m0/sources/m0-a.webm');
await page.getByTestId('timeline-clip-gameplay').waitFor({timeout: 30_000});
await page.waitForTimeout(500);

check('three-scene preflight clears after one source upload',
  !/영상 소재|연결되지/.test(await batchPreflightText()));

await page.getByTestId('timeline-clip-gameplay').click();
await page.waitForTimeout(200);
const tsSelected = await page.locator('.timeline__scene').textContent();
check('three-scene clip click selects the scene', /[Gg]ameplay|게임/.test(tsSelected ?? ''), tsSelected ?? '');

// The preview player renders the three-scene composition (no placeholder).
const tsPlaceholder = await page.getByText('영상을 업로드하세요').count();
check('three-scene preview leaves its placeholder', tsPlaceholder === 0);

// ===================== Day1 (two panels) =====================
await switchTo('day1');
check('day1 presets stay 15/30/60',
  JSON.stringify(await presetLabels()) === '["15초","30초","60초"]',
  JSON.stringify(await presetLabels()));

for (const letter of ['a', 'b']) {
  await page.getByTestId(`day1-panel-${letter}-input`)
    .setInputFiles(`artifacts/m0/sources/m0-${letter}.webm`);
  await page.getByTestId(`day1-panel-${letter}-metadata`)
    .filter({hasText: '초'}).waitFor({timeout: 30_000});
}
check('day1 blocker clears after two uploads',
  (await page.getByTestId('day1-panels-blocker').count()) === 0);
check('day1 inspector has no C/D sections',
  (await page.getByTestId('section-day1-panel-c').count()) === 0);

// The six shared-field commands must still take effect on the Day1 arm.
const splitSummary = page.getByTestId('section-day1-split');
if (await splitSummary.count()) {
  const open = await splitSummary.evaluate((el) => el.closest('details')?.open);
  if (!open) await splitSummary.click();
}
await page.getByTestId('day1-split-color').fill('#00ff00');
await page.waitForTimeout(300);
const day1Line = await page.getByTestId('day1-split-line').first()
  .evaluate((el) => getComputedStyle(el).backgroundColor);
check('day1 split colour still reaches the divider', day1Line === 'rgb(0, 255, 0)', day1Line);

await page.getByTestId('section-day1-endcard').click();
await page.getByTestId('day1-endcard-mode-video').click();
await page.getByTestId('day1-endcard-video')
  .setInputFiles('artifacts/m0/sources/m0-c.webm');
await page.getByTestId('day1-endcard-trim-range').waitFor({timeout: 30_000});
check('day1 endcard video mode + upload still works', true);

check('day1 preflight clears with both panels',
  !/패널|영상 소재|연결되지/.test(await batchPreflightText()));

await page.getByTestId('timeline-clip-panel-b').click();
await page.waitForTimeout(200);
const d1Selected = await page.locator('.timeline__scene').textContent();
check('day1 clip click selects the panel', /패널 B/.test(d1Selected ?? ''), d1Selected ?? '');

// ===================== key-visual loop =====================
await page.getByTestId('template-selector').selectOption('kv-loop');
check('kv-loop switch announces the 9:16 lock',
  await page.getByTestId('template-switch-ratio-note').isVisible());
await page.getByTestId('template-switch-confirm').click();
await page.waitForTimeout(400);

check('kv-loop presets stay 15/30/60',
  JSON.stringify(await presetLabels()) === '["15초","30초","60초"]',
  JSON.stringify(await presetLabels()));
check('kv-loop locks the ratio buttons',
  await page.getByTestId('ratio-1:1').isDisabled());

await page.getByTestId('kv-slot-0-input').setInputFiles('tests/fixtures/kv-1.png');
await page.getByTestId('kv-slot-1-input').setInputFiles('tests/fixtures/kv-2.png');
await page.waitForTimeout(800);
check('kv-loop image blocker clears after two uploads',
  (await page.getByTestId('kv-images-blocker').count()) === 0);
check('kv-loop preflight clears with two key visuals',
  !/키비주얼|연결되지/.test(await batchPreflightText()));

// ===================== switching matrix, back to start =====================
await switchTo('day1-quad');
check('kv → quad narrows presets to 15/30',
  JSON.stringify(await presetLabels()) === '["15초","30초"]',
  JSON.stringify(await presetLabels()));
await switchTo('three-scene');
check('quad → three-scene restores 15/30/60 and unlocks ratios',
  JSON.stringify(await presetLabels()) === '["15초","30초","60초"]' &&
    !(await page.getByTestId('ratio-1:1').isDisabled()));

// ===================== persistence round-trip =====================
// A stored project written by this build must come back after a reload — the
// schema extraction must not have broken parse for any template.
await switchTo('day1');
// `AUTOSAVE_DEBOUNCE_MS` is 800, and the write itself takes a moment after that.
// The original 800ms wait was exactly the debounce with nothing left for the
// save, so it raced: the reload landed first and restored the *previous*
// template, which looks exactly like a parse failure and is not one. Waiting on
// the "저장됨" badge does not fix it either — the badge is still showing the
// previous save when the switch lands, so that wait returns immediately.
await page.waitForTimeout(3000);
await page.reload({waitUntil: 'load'});
await page.getByTestId('template-selector').waitFor({timeout: 30_000});
// The write side is settled above, but the read side races too. On load the app
// renders the initial three-scene project and swaps in the stored one when the
// IndexedDB restore resolves — measured at ~100ms. Reading the selector the
// moment it appears therefore catches the pre-restore value about two runs in
// three. Poll for the stored template instead; this still fails if the restore
// never lands, which is the whole point of the check.
let restored = await page.getByTestId('template-selector').inputValue();

for (let i = 0; i < 100 && restored !== 'day1'; i++) {
  await page.waitForTimeout(100);
  restored = await page.getByTestId('template-selector').inputValue();
}
check('reload restores the stored template', restored === 'day1', restored);

check('no page errors across all templates', errors.length === 0, errors.join(' | '));

console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
await b.close();
process.exit(fails.length ? 1 : 0);
