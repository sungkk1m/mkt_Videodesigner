// M2 sanity: day1-quad exists in the schema and the domain, but the editor
// cannot draw it until M5. This asserts the intermediate state is not a trap —
// the selector must NOT offer it, because `EditorWorkspace`'s
// `template-unsupported` notice has no way back and autosave would persist it.
//
// When M5 lands, this script's expectation flips: the option appears and
// switching produces a working quad workspace. M5 landed, so all three checks
// below now fail on purpose — the record of an intermediate state, not a
// regression. `verify-quad-ui.mjs` is what covers the shipped behaviour.
import {chromium} from '@playwright/test';

const b = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await b.newPage({viewport: {width: 1600, height: 1000}});
const fails = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

await page.goto('http://127.0.0.1:4173/', {waitUntil: 'load'});
const sel = page.getByTestId('template-selector');
await sel.waitFor({timeout: 30_000});

const values = await sel.evaluate((el) => [...el.options].map((o) => o.value));
check(
  'selector does not offer day1-quad yet (M5 turns it on)',
  !values.includes('day1-quad'),
  JSON.stringify(values),
);

// The dead end this guards against: reachable only by forcing the value in.
await sel.evaluate((el) => {
  const option = document.createElement('option');
  option.value = 'day1-quad';
  el.append(option);
});
await sel.selectOption('day1-quad');
await page.getByTestId('template-switch-confirm').click();
await page.waitForTimeout(1200);

check(
  'forcing it lands on the unsupported notice, not a crash',
  await page.getByTestId('template-unsupported').isVisible(),
);
check(
  'and that notice offers no way back — which is why the option is hidden',
  (await page.getByTestId('template-selector').count()) === 0,
);

await b.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
