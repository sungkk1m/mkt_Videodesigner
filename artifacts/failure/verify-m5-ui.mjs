// failure-video M5 verification (Design §11 게이트: 전환 → 업로드 → 문구 →
// 비율 토글 → 프리뷰) driven through the real editor.
//
// The repo's E2E suite uploads H.264 fixtures that this container's Chromium
// cannot decode, so this walks the same UI with the M0 spike's VP9 sources.
// Everything asserted here is codec-independent editor behaviour; the MP4 pixel
// assertions are the real device's job (§8.2).
//
//   npm run dev -- --host 127.0.0.1 --port 4173   # in another shell
//   node artifacts/m0/make-sources.mjs            # once, for the VP9 sources
//   node artifacts/failure/verify-m5-ui.mjs
import {chromium} from '@playwright/test';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
const pageErrors = [];

page.on('pageerror', (error) => pageErrors.push(String(error)));

const fails = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails.push(name);
};
const openSections = () =>
  page.evaluate(() => {
    document
      .querySelectorAll('details.section')
      .forEach((element) => element.setAttribute('open', ''));
  });

await page.goto('http://127.0.0.1:4173/', {waitUntil: 'load'});
await page.getByTestId('template-selector').waitFor({timeout: 30_000});

// --- the selector now offers the template (M2's guard is gone) --------------
const options = await page.$$eval('[data-testid="template-selector"] option', (nodes) =>
  nodes.map((node) => ({value: node.value, label: node.textContent})),
);

check(
  'selector offers the failure template',
  options.some((option) => option.value === 'failure' && option.label === '실패(FAIL)'),
  JSON.stringify(options),
);

// --- the switch dialog states both coercions --------------------------------
await page.getByTestId('template-selector').selectOption('failure');
check(
  'dialog warns that 15s becomes 30s',
  /30초로 바뀝니다/.test(
    (await page.getByTestId('template-switch-preset-note').textContent()) ?? '',
  ),
);
check(
  'dialog warns that 1:1 is dropped',
  (await page.getByTestId('template-switch-failure-ratio-note').count()) === 1,
);
await page.getByTestId('template-switch-confirm').click();

// --- the axis, the presets, and the locked ratio ----------------------------
const clips = await page.$$eval('[data-testid^="timeline-clip-"]', (nodes) =>
  nodes.map((node) => node.getAttribute('data-testid')),
);

check(
  'timeline shows the four failure sections',
  JSON.stringify(clips) ===
    JSON.stringify([
      'timeline-clip-panel-a',
      'timeline-clip-panel-b',
      'timeline-clip-panel-c',
      'timeline-clip-endcard',
    ]),
  JSON.stringify(clips),
);

const presets = await page.$$eval(
  '[aria-label="전체 길이"] button',
  (nodes) => nodes.map((node) => node.textContent),
);

check(
  'presets narrow to 30/60',
  JSON.stringify(presets) === JSON.stringify(['30초', '60초']),
  JSON.stringify(presets),
);
check(
  '1:1 is disabled, 9:16 and 16:9 are not',
  (await page.getByTestId('ratio-1:1').isDisabled()) &&
    !(await page.getByTestId('ratio-9:16').isDisabled()) &&
    !(await page.getByTestId('ratio-16:9').isDisabled()),
);
check(
  'stage chip names the active source group',
  (await page.getByTestId('failure-ratio-orientation').textContent()) === '세로 소재',
);
check(
  'inspector identifies the template',
  (await page.getByTestId('inspector-template').textContent()) === '실패(FAIL)',
);

// --- the asset panel is bound to the vertical group -------------------------
check(
  'asset panel says which group is being filled',
  /세로\(9:16\)/.test(
    (await page.getByTestId('failure-orientation-note').textContent()) ?? '',
  ),
);
check(
  'blocker names the orientation and the count',
  /세로용 영상 3개/.test(
    (await page.getByTestId('failure-render-blocker').textContent()) ?? '',
  ),
);
check(
  'asset panel shows the three levels, not panel letters',
  (await page.locator('[data-testid="failure-asset-a"] h3').textContent()) ===
    '레벨 1 · 실패하는 구간',
);

for (const [slot, file] of [
  ['a', 'm0-a'],
  ['b', 'm0-b'],
  ['c', 'm0-c'],
]) {
  await page
    .getByTestId(`failure-asset-${slot}-input`)
    .setInputFiles(`artifacts/m0/sources/${file}.webm`);
  await page.getByTestId(`failure-asset-${slot}-metadata`).waitFor({timeout: 30_000});
}

check(
  'render blocker clears once the vertical group is full',
  (await page.getByTestId('failure-render-blocker').count()) === 0,
);
check(
  'preview leaves the upload placeholder',
  !(await page.locator('text=세로(9:16)용 영상 3개를 모두 업로드하세요').count()),
);

// --- the inspector: segments, captions, FAIL toggles ------------------------
await openSections();

const sections = await page.$$eval(
  '[data-testid^="section-failure-"]',
  (nodes) => nodes.map((node) => node.getAttribute('data-testid')),
);

check(
  'inspector shows three segments plus caption, FAIL and the end card',
  ['section-failure-panel-a', 'section-failure-panel-b', 'section-failure-panel-c',
   'section-failure-caption', 'section-failure-fail'].every((id) =>
    sections.includes(id),
  ) && (await page.getByTestId('section-day1-endcard').count()) === 1,
  JSON.stringify(sections),
);
check(
  'segment sections are titled by level',
  (await page
    .locator('[data-testid="section-failure-panel-a"] .section__title, [data-testid="section-failure-panel-a"]')
    .first()
    .textContent())?.includes('레벨 1'),
);
check(
  'the trim strip is bound to the segment',
  /소스 구간/.test(
    (await page.getByTestId('failure-a-trim-range').textContent()) ?? '',
  ),
  ((await page.getByTestId('failure-a-trim-range').textContent()) ?? '')
    .replace(/\s+/g, ' ')
    .trim(),
);
check(
  'captions arrive prefilled in every locale',
  (await page.getByTestId('failure-caption-ko-a').inputValue()) === 'LEVEL 1' &&
    (await page.getByTestId('failure-caption-ja-b').inputValue()) === 'LEVEL 20' &&
    (await page.getByTestId('failure-caption-zh-TW-c').inputValue()) === 'LEVEL 99',
);

await page.getByTestId('failure-caption-ko-b').fill('LEVEL 25');
check(
  'editing a caption sticks',
  (await page.getByTestId('failure-caption-ko-b').inputValue()) === 'LEVEL 25',
);

// Plan D-5 — every element of the beat can be switched off.
for (const toggle of [
  'stampEnabled',
  'zoomEnabled',
  'desaturateEnabled',
  'shakeEnabled',
  'sfxEnabled',
]) {
  check(
    `FAIL toggle ${toggle} is present and on`,
    await page.getByTestId(`failure-toggle-${toggle}`).isChecked(),
  );
}

await page.getByTestId('failure-toggle-stampEnabled').uncheck();
check(
  'turning the stamp off disables the SFX toggle with it',
  await page.getByTestId('failure-toggle-sfxEnabled').isDisabled(),
);
await page.getByTestId('failure-toggle-stampEnabled').check();

await page.getByTestId('failure-focus-x').fill('-20');
await page.getByTestId('failure-focus-x').blur();
check(
  'the punch-zoom focus takes a value',
  (await page.getByTestId('failure-focus-x').inputValue()) === '-20',
);

// --- D-1: the ratio toggle IS the orientation toggle ------------------------
await page.getByTestId('ratio-16:9').click();
await openSections();

check(
  'switching to 16:9 swaps the stage chip',
  (await page.getByTestId('failure-ratio-orientation').textContent()) === '가로 소재',
);
check(
  'switching to 16:9 swaps the asset panel to the empty horizontal group',
  /가로\(16:9\)/.test(
    (await page.getByTestId('failure-orientation-note').textContent()) ?? '',
  ) &&
    (await page.getByTestId('failure-asset-a-metadata').count()) === 0,
);
check(
  'the horizontal group blocks the render on its own',
  /가로용 영상 3개/.test(
    (await page.getByTestId('failure-render-blocker').textContent()) ?? '',
  ),
);
check(
  'the inspector badge follows the ratio',
  /가로 \(16:9\)/.test(
    (await page.getByTestId('failure-orientation-badge').textContent()) ?? '',
  ),
);

await page.getByTestId('ratio-9:16').click();
check(
  'switching back restores the vertical uploads',
  (await page.getByTestId('failure-asset-a-metadata').count()) === 1,
);

// --- Q4: 60s, and the section split that comes with it ----------------------
await page.getByRole('button', {name: '60초'}).click();
const clipText = await page
  .getByTestId('timeline-clip-panel-a')
  .textContent();

check(
  '60s repartitions the axis on the reference split',
  /11\.4/.test(clipText ?? ''),
  `clip = ${JSON.stringify(clipText)}`,
);

// --- the other templates still work ----------------------------------------
await page.getByTestId('template-selector').selectOption('day1');
await page.getByTestId('template-switch-confirm').click();
check(
  'day1 still opens its own inspector',
  (await page.getByTestId('inspector-template').textContent()) === 'Day1 비교',
);

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
