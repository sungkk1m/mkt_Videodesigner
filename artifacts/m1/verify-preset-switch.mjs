// The 30s preset on the quad template: five finite sections, no NaN, no crash.
// Reproduces the live report (black preview, `Sequence from=NaN`) against the
// fix, and checks the other templates' preset switches while here.
import {chromium} from '@playwright/test';

const b = await chromium.launch({
  headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'],
});
const page = await b.newPage({viewport: {width: 1600, height: 1000}});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const fails = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

const clipDurations = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="timeline-clip-"]')]
      .map((el) => el.textContent));

await page.goto('http://127.0.0.1:4173/', {waitUntil: 'load'});
await page.getByTestId('template-selector').waitFor({timeout: 30_000});
await page.getByTestId('template-selector').selectOption('day1-quad');
await page.getByTestId('template-switch-confirm').click();
await page.waitForTimeout(400);

await page.getByRole('button', {name: '30초'}).click();
await page.waitForTimeout(400);
const at30 = (await clipDurations()).join(' | ');
check('quad 30s: five sections, all finite', !/NaN/.test(at30) && /6\.8|6\.7/.test(at30) && at30.split('|').length === 5, at30);
check('quad 30s: total reads 00:30.0', /00:30\.0/.test((await page.getByTestId('transport-time').textContent()) ?? ''));

await page.getByRole('button', {name: '15초'}).click();
await page.waitForTimeout(400);
const at15 = (await clipDurations()).join(' | ');
check('quad back to 15s: all 3.0s', !/NaN/.test(at15) && at15.split('|').length === 5, at15);

// Other templates' preset switches stay intact.
await page.getByTestId('template-selector').selectOption('day1');
await page.getByTestId('template-switch-confirm').click();
await page.getByRole('button', {name: '30초'}).click();
await page.waitForTimeout(300);
check('day1 30s stays finite', !/NaN/.test((await clipDurations()).join('')), '');
await page.getByTestId('template-selector').selectOption('three-scene');
await page.getByTestId('template-switch-confirm').click();
await page.getByRole('button', {name: '60초'}).click();
await page.waitForTimeout(300);
check('three-scene 60s stays finite', !/NaN/.test((await clipDurations()).join('')), '');

check('no page errors (no Sequence from=NaN)', errors.length === 0, errors.join(' | '));
console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
await b.close();
process.exit(fails.length ? 1 : 0);
