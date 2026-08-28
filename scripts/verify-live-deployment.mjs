// Post-deployment smoke check against the live GitHub Pages site.
// Design Ref: §8.4 scenario 9. Run after every deployment:
//
//   npm run verify:deployment
//   DEPLOY_URL=https://example.github.io/other/ npm run verify:deployment
//
// Kept out of the Playwright suite on purpose: it needs the network and a live
// deployment, which unit and local E2E runs must not depend on.
import {chromium} from '@playwright/test';
import {resolve} from 'node:path';

const URL_UNDER_TEST =
  process.env.DEPLOY_URL ?? 'https://sungkk1m.github.io/mkt_Videodesigner/';
const panelA = resolve(
  import.meta.dirname,
  '../tests/fixtures/gameplay-sample.mp4',
);
const panelB = resolve(import.meta.dirname, '../tests/fixtures/day1-panel-b.mp4');

console.log(`\nverifying ${URL_UNDER_TEST}\n`);

const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage();
const consoleErrors = [];
const failed = [];

page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
page.on('requestfailed', (r) => {
  if (!r.url().startsWith('blob:') && !r.url().startsWith('data:')) {
    failed.push(`${r.url()} ${r.failure()?.errorText ?? ''}`);
  }
});
page.on('response', (r) => {
  if (r.status() >= 400) failed.push(`${r.url()} ${r.status()}`);
});

const step = async (name, fn) => {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
  } catch (error) {
    console.log(`  FAIL  ${name}: ${error.message.split('\n')[0]}`);
    process.exitCode = 1;
  }
};

await page.goto(URL_UNDER_TEST, {waitUntil: 'networkidle'});

await step('secure context + HTTPS', async () => {
  const secure = await page.evaluate(() => window.isSecureContext);
  if (!secure) throw new Error('not a secure context');
});

await step('editor shell renders', () =>
  page.getByText('UA Video Designer').waitFor({timeout: 20_000}),
);

await step('capability probe completes', async () => {
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="editor-render-status"]')
        ?.textContent !== '환경 확인 중',
    undefined,
    {timeout: 30_000},
  );
  const status = await page
    .getByTestId('editor-render-status')
    .textContent();
  console.log(`        render status: ${status}`);
  if (status === '렌더 불가') throw new Error('renderer reported unavailable');
});

await step('upload and probe real files', async () => {
  // A new project opens on Day1, which needs both panels before it can render.
  await page.getByTestId('day1-panel-a-input').setInputFiles(panelA);
  await page.getByTestId('day1-panel-b-input').setInputFiles(panelB);
  await page
    .getByTestId('day1-panel-a-metadata')
    .getByText('gameplay-sample.mp4')
    .waitFor({timeout: 30_000});
  await page
    .getByTestId('day1-panels-blocker')
    .waitFor({state: 'detached', timeout: 30_000});
});

await step('real MP4 render and download', async () => {
  const downloadPromise = page.waitForEvent('download', {timeout: 480_000});
  await page.getByRole('button', {name: 'MP4 렌더'}).click();
  await page
    .getByTestId('editor-render-status')
    .getByText('완료', {exact: false})
    .waitFor({timeout: 480_000});
  await page.getByRole('button', {name: '다운로드'}).click();
  const download = await downloadPromise;
  console.log(`        file: ${download.suggestedFilename()}`);
});

await step('autosave then reload restores the project', async () => {
  await page
    .getByTestId('editor-save-state')
    .getByText('저장됨')
    .waitFor({timeout: 20_000})
    .catch(async () => {
      const text = await page.getByTestId('editor-save-state').textContent();
      throw new Error(`save state was "${text}"`);
    });
  await page.reload({waitUntil: 'networkidle'});
  await page.getByTestId('day1-panel-a-repair').waitFor({timeout: 20_000});
});

console.log(`\n  failed requests: ${failed.length}`);
failed.slice(0, 5).forEach((entry) => console.log(`    ${entry}`));
console.log(`  console errors:  ${consoleErrors.length}`);
consoleErrors.slice(0, 5).forEach((entry) => console.log(`    ${entry}`));

await browser.close();
