// failure-video M1 verification: the `PanelSection` and `EndCardSection`
// extraction is a pure move, and `useDay1Assets` still restores, uploads, and
// reports through injected slots.
//
// The repo's E2E suite is the real gate, but it uploads H.264 fixtures and this
// container's Chromium has no H.264 decoder (handoff §"이 환경에서 막히는 것"),
// so every panelled spec dies at the upload probe whatever the code does. This
// drives the same UI with the VP9 sources from the M0 spike, which Chromium can
// decode, and asserts the test ids and readouts the extracted markup owns.
//
//   npm run dev -- --host 127.0.0.1 --port 4173   # in another shell
//   node artifacts/m0/make-sources.mjs            # once, for the VP9 sources
//   node artifacts/failure/verify-m1-extraction.mjs
import {chromium} from '@playwright/test';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
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
await page.getByTestId('template-selector').selectOption('day1');
await page.getByTestId('template-switch-confirm').click();

// --- the asset panel, whose labels and test ids are now props (Design §7.3) ---
await page.getByTestId('day1-panel-a-input').setInputFiles('artifacts/m0/sources/m0-a.webm');
await page.getByTestId('day1-panel-b-input').setInputFiles('artifacts/m0/sources/m0-b.webm');

const metadata = page.getByTestId('day1-panel-a-metadata');
await metadata.waitFor({timeout: 30_000});
check(
  'asset panel keeps its day1-panel-* test ids and metadata',
  /1920×1080/.test((await metadata.textContent()) ?? ''),
  ((await metadata.textContent()) ?? '').replace(/\s+/g, ' ').trim(),
);
check(
  'asset panel keeps the Day1 heading wording',
  (await page.locator('[data-testid="day1-panel-a"] h3').textContent()) ===
    '패널 A · 먼저 재생',
);

// --- PanelSection: trim readouts, fit, framing, ratio override ---
await openSections();

const trimRange = page.getByTestId('day1-a-trim-range');
await trimRange.waitFor({timeout: 20_000});
const rangeText = ((await trimRange.textContent()) ?? '').replace(/\s+/g, ' ').trim();
check('panel section renders its trim range readout', /소스 구간/.test(rangeText), rangeText);
check(
  'panel section renders Trim Out as a derived readout',
  (await page.getByTestId('day1-a-trim-out').count()) === 1,
);
for (const id of [
  'day1-a-trim-in',
  'day1-a-fit-cover',
  'day1-a-fit-contain',
  'day1-a-ratio-override',
  'day1-a-scale',
  'day1-a-x',
  'day1-a-y',
]) {
  check(`panel section keeps ${id}`, (await page.getByTestId(id).count()) === 1);
}

// The framing controls still reach the store through the same commands.
await page.getByTestId('day1-a-fit-cover').click();
check(
  'fit switches to cover',
  (await page.getByTestId('day1-a-fit-cover').getAttribute('aria-pressed')) === 'true',
);
await page.getByTestId('day1-a-ratio-override').check();
const badge = await page.locator('[data-testid="section-day1-panel-a"] .section__badge')
  .textContent()
  .catch(() => null);
check(
  'ratio override flips the panel badge',
  /9:16 전용/.test(badge ?? ''),
  `badge = ${JSON.stringify(badge)}`,
);
await page.getByTestId('day1-a-ratio-override').uncheck();

// --- EndCardSection: mode switch, asset slots, trim strip, audio, icon nudge ---
await page.getByTestId('day1-endcard-mode-video').click();
await openSections();

const videoInput = page.locator('[data-testid="day1-endcard-video"]');
await videoInput.waitFor({state: 'attached', timeout: 10_000});
await videoInput.setInputFiles('artifacts/m0/sources/m0-c.webm');

const endCardRange = page.getByTestId('day1-endcard-trim-range');
await endCardRange.waitFor({timeout: 20_000});
const endCardText = ((await endCardRange.textContent()) ?? '').replace(/\s+/g, ' ').trim();
check('end card section renders its trim range readout', /슬롯 3/.test(endCardText), endCardText);
for (const id of [
  'day1-endcard-audio-toggle',
  'day1-endcard-audio-volume',
  'day1-card-motion-ken-burns',
  'day1-endcard-mode-banner',
]) {
  check(`end card section keeps ${id}`, (await page.getByTestId(id).count()) === 1);
}

await page.getByTestId('day1-endcard-mode-banner').click();
await openSections();
check(
  'banner mode reveals the icon nudge controls',
  (await page.getByTestId('day1-icon-dx').count()) === 1 &&
    (await page.getByTestId('day1-icon-scale').count()) === 1,
);
check(
  'banner mode warns about the missing banner',
  (await page.getByTestId('day1-banner-missing').count()) === 1,
);

// --- the quad template drives the same two extracted sections ---
await page.getByTestId('template-selector').selectOption('day1-quad');
await page.getByTestId('template-switch-confirm').click();
await openSections();
check(
  'quad inspector renders four extracted panel sections',
  (await page.locator('[data-testid^="section-day1-panel-"]').count()) === 4,
);
check(
  'quad inspector still renders one end card section',
  (await page.getByTestId('section-day1-endcard').count()) === 1,
);

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
