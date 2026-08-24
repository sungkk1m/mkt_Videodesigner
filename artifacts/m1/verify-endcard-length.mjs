// M1-1 verification: the end-card trim slot follows the section length instead of
// the 3s constant. UI only — the readouts come from the inspector, not a render.
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
await page.getByTestId('template-selector').selectOption('day1');
await page.getByTestId('template-switch-confirm').click();

// The end-card boundary is index 1. Shift+ArrowLeft moves it 1s at a time, so
// three presses grow the 3s card to 6s.
const boundary = page.getByTestId('timeline-boundary-1');
await boundary.focus();
for (let i = 0; i < 3; i += 1) {
  await boundary.press('Shift+ArrowLeft');
}

const clipText = await page
  .getByTestId('timeline-clip-endcard')
  .textContent()
  .catch(() => null);
check('end card clip grew past 3s', /6\.0|6s|6\.00/.test(clipText ?? ''), `clip = ${JSON.stringify(clipText)}`);

// The inspector sections are <details>; the end card one starts closed, so a
// click on anything inside it would land on a hidden element.
await page.evaluate(() => {
  document
    .querySelectorAll('details.section')
    .forEach((d) => d.setAttribute('open', ''));
});

await page.getByTestId('day1-endcard-mode-video').click();

const input = page.locator('[data-testid="day1-endcard-video"]');
await input.waitFor({state: 'attached', timeout: 10_000});
await input.setInputFiles('artifacts/m0/sources/m0-a.webm');

const range = page.getByTestId('day1-endcard-trim-range');
await range.waitFor({timeout: 20_000});
const text = ((await range.textContent()) ?? '').replace(/\s+/g, ' ').trim();

console.log(`      trim range readout: ${JSON.stringify(text)}`);
check('slot readout follows the 6s card, not 3s', /슬롯 6/.test(text), text);
check('window opens at the whole 6s card', /구간 6/.test(text), text);

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
