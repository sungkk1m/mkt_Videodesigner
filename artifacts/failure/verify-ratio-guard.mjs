// Regression guard: a ratio the template's schema rejects must be unreachable
// from the UI, and the project must survive a reload.
//
// This exists because it did not hold. `refineFailure` and `refineKvLoop` narrow
// `render.selectedRatios`, but the Batch dialog offered all three ratios as
// plain checkboxes. Ticking a forbidden one autosaved a document that could not
// be parsed back, so the next load fell through to an empty three-scene project
// and the operator's work was gone with nothing said. Unit tests cover the
// commands; this covers the surface that produced the bad value.
//
//   npm run dev -- --host 127.0.0.1 --port 4173   # in another shell
//   node artifacts/failure/verify-ratio-guard.mjs
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

await page.goto('http://127.0.0.1:4173/', {waitUntil: 'load'});
await page.getByTestId('template-selector').waitFor({timeout: 30_000});

const CASES = [
  {kind: 'failure', forbidden: ['1:1'], allowed: ['9:16', '16:9']},
  {kind: 'kv-loop', forbidden: ['1:1', '16:9'], allowed: ['9:16']},
  {kind: 'day1', forbidden: [], allowed: ['9:16', '1:1', '16:9']},
];

for (const {kind, forbidden, allowed} of CASES) {
  await page.getByTestId('template-selector').selectOption(kind);
  await page.getByTestId('template-switch-confirm').click();

  // The stage toolbar and the Batch dialog are two surfaces on one rule.
  for (const ratio of forbidden) {
    check(
      `${kind}: stage ratio ${ratio} is disabled`,
      await page.getByTestId(`ratio-${ratio}`).isDisabled(),
    );
  }

  for (const ratio of allowed) {
    check(
      `${kind}: stage ratio ${ratio} stays available`,
      !(await page.getByTestId(`ratio-${ratio}`).isDisabled()),
    );
  }

  await page.getByTestId('open-batch').click();

  for (const ratio of forbidden) {
    check(
      `${kind}: batch ratio ${ratio} is disabled`,
      await page.getByTestId(`batch-ratio-${ratio}`).isDisabled(),
    );
  }

  for (const ratio of allowed) {
    check(
      `${kind}: batch ratio ${ratio} stays available`,
      !(await page.getByTestId(`batch-ratio-${ratio}`).isDisabled()),
    );
  }

  await page.getByTestId('batch-close').click();
  // Past the 800ms autosave debounce plus the write.
  await page.waitForTimeout(3000);
  await page.reload({waitUntil: 'load'});
  await page.getByTestId('template-selector').waitFor({timeout: 30_000});
  await page.waitForTimeout(1000);

  check(
    `${kind}: the project still parses after a reload`,
    (await page.getByTestId('template-selector').inputValue()) === kind,
    await page.getByTestId('template-selector').inputValue(),
  );
}

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
