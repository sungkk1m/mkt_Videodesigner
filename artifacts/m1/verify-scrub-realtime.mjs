// Realtime scrub: the red playhead must follow the pointer *during* the drag
// (the report was that it only jumped once, on release), the preview must land
// on the final frame, and normal playback must keep driving the playhead after
// a scrub (the frameupdate guard must not stick).
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
await page.getByTestId('template-selector').waitFor({timeout: 30_000});
await page.getByTestId('template-selector').selectOption('day1-quad');
await page.getByTestId('template-switch-confirm').click();
for (const letter of ['a', 'b', 'c', 'd']) {
  await page.getByTestId(`day1-panel-${letter}-input`)
    .setInputFiles(`artifacts/m0/sources/m0-${letter}.webm`);
  await page.getByTestId(`day1-panel-${letter}-metadata`)
    .filter({hasText: '초'}).waitFor({timeout: 30_000});
}
await page.waitForTimeout(500);

const playheadLeft = () =>
  page.locator('.timeline__playhead')
    .evaluate((el) => Number.parseFloat(el.style.left));

// --- drag: the line must be at each waypoint while the pointer is still down ---
const box = await page.locator('.timeline__ruler').boundingBox();
const y = box.y + box.height / 2;

await page.mouse.move(box.x + box.width * 0.1, y);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.4, y, {steps: 8});
const at40 = await playheadLeft();
await page.mouse.move(box.x + box.width * 0.7, y, {steps: 8});
const at70 = await playheadLeft();
await page.mouse.up();

check('playhead sits at ~40% mid-drag', Math.abs(at40 - 40) < 4, `${at40}%`);
check('playhead sits at ~70% mid-drag', Math.abs(at70 - 70) < 4, `${at70}%`);

// --- release: the trailing seek lands the preview on the final frame ---
await page.waitForTimeout(400);
const settled = await page.getByTestId('transport-time').textContent();
check('preview settles on the drag end position', /00:10\.\d/.test(settled ?? ''), settled ?? '');

// --- a plain click still seeks immediately ---
await page.mouse.click(box.x + box.width * 0.2, y);
await page.waitForTimeout(300);
const clicked = await page.getByTestId('transport-time').textContent();
check('single click seeks to ~3s', /00:0(2\.\d|3\.\d)/.test(clicked ?? ''), clicked ?? '');

// --- playback drives the playhead again after scrubbing (guard released) ---
await page.getByTestId('transport-play').click();
await page.waitForTimeout(1200);
const playing = await playheadLeft();
await page.getByTestId('transport-play').click();
check('playback moves the playhead after a scrub', playing > 21, `${playing}%`);

console.log(fails.length ? `\n${fails.length} FAILED` : '\nALL PASS');
await b.close();
process.exit(fails.length ? 1 : 0);
