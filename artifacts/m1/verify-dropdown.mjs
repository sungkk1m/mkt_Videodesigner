// M1-3 verification: the template dropdown, and D-2's claim that a controlled
// select needs no cancel-restore logic. UI only — no MP4 render, so this runs
// in a container without an H.264 encoder.
import {chromium} from '@playwright/test';

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
const fails = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) fails.push(name);
};

await page.goto('http://127.0.0.1:4173/', {waitUntil: 'load'});
const sel = page.getByTestId('template-selector');
await sel.waitFor({timeout: 30_000});

check('selector is a <select>', (await sel.evaluate((el) => el.tagName)) === 'SELECT');

const options = await sel.evaluate((el) =>
  [...el.options].map((o) => ({value: o.value, label: o.textContent})),
);
check(
  'lists every template',
  JSON.stringify(options.map((o) => o.value)) ===
    JSON.stringify(['three-scene', 'day1', 'kv-loop']),
  JSON.stringify(options),
);
check('starts on three-scene', (await sel.inputValue()) === 'three-scene');

// --- cancel path: D-2's whole claim ---
await sel.selectOption('day1');
check(
  'choosing opens the dialog',
  await page.getByTestId('template-switch-dialog').isVisible(),
);
await page.getByTestId('template-switch-cancel').click();
check(
  'D-2: cancel reverts the select with no restore logic',
  (await sel.inputValue()) === 'three-scene',
  `value after cancel = ${await sel.inputValue()}`,
);
check(
  'cancel leaves the project on three-scene',
  await page.getByTestId('timeline-clip-hook').isVisible().catch(() => false),
);

// --- confirm path ---
await sel.selectOption('day1');
await page.getByTestId('template-switch-confirm').click();
check('confirm switches the select', (await sel.inputValue()) === 'day1');
check(
  'confirm switches the section axis',
  await page.getByTestId('day1-panels-blocker').isVisible().catch(() => false),
);

// --- kv-loop still shows its ratio note before confirming ---
await sel.selectOption('kv-loop');
check(
  'kv-loop ratio note still shows',
  await page.getByTestId('template-switch-ratio-note').isVisible(),
);
await page.getByTestId('template-switch-cancel').click();
check('cancel reverts back to day1', (await sel.inputValue()) === 'day1');

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
