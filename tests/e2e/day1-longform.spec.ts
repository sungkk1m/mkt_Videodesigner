// Closes the measurement gap module 6 left open (§4.7): the 1.5x render gate was
// only ever checked at the 15s preset, so the 60s preset and its memory
// behaviour were unknown. Two decoder instances over 3600 frames is where a leak
// or a swap would show up, not at 900.
//
// Opt-in: a pair of 60s 60fps renders is minutes of wall clock, which does not
// belong in the default suite. Run it when the render path changes:
//
//   DAY1_LONGFORM=1 npx playwright test tests/e2e/day1-longform.spec.ts
import {mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);
const outputDirectory = resolve(projectRoot, 'artifacts/module-6');

const PANEL_A_SOURCE = fixture('gameplay-sample.mp4');
const PANEL_B_SOURCE = fixture('day1-panel-b.mp4');

const RENDER_TIMEOUT = 20 * 60 * 1000;

/** Heap in MiB, or null outside Chrome's `performance.memory`. */
const heapMib = (page: Page) =>
  page.evaluate(() => {
    const memory = (
      performance as Performance & {memory?: {usedJSHeapSize: number}}
    ).memory;

    return memory ? Math.round(memory.usedJSHeapSize / (1024 * 1024)) : null;
  });

const renderAndMeasure = async (page: Page, label: string, fileName: string) => {
  const before = await heapMib(page);
  const downloadPromise = page.waitForEvent('download', {
    timeout: RENDER_TIMEOUT,
  });
  const startedAt = Date.now();

  await page.getByRole('button', {name: 'MP4 렌더'}).click();
  await expect(page.getByTestId('open-batch')).toBeDisabled();
  await expect(page.getByTestId('open-batch')).toBeEnabled({
    timeout: RENDER_TIMEOUT,
  });
  await expect(page.getByTestId('editor-render-status')).toContainText('완료');

  const renderMs = Date.now() - startedAt;
  const after = await heapMib(page);

  await page.getByRole('button', {name: '다운로드'}).click();

  const download = await downloadPromise;

  await mkdir(outputDirectory, {recursive: true});
  await download.saveAs(resolve(outputDirectory, fileName));

  console.log(
    `[longform] ${label} — ${(renderMs / 1000).toFixed(2)}s · heap ${before ?? '?'} -> ${after ?? '?'} MiB`,
  );

  return {renderMs, before, after};
};

test.describe('Day1 60s preset render cost', () => {
  test.skip(
    !process.env.DAY1_LONGFORM,
    'Opt-in measurement: set DAY1_LONGFORM=1',
  );
  test.setTimeout(40 * 60 * 1000);
  test.use({actionTimeout: 30_000});

  test('stays within the 1.5x gate at the 60s preset', async ({page}) => {
    // --- three-scene baseline -------------------------------------------------
    await page.goto('/');
    await page.getByTestId('source-input').setInputFiles(PANEL_A_SOURCE);
    await page.getByRole('button', {name: '60초'}).click();
    await page.getByTestId('ratio-9:16').click();

    const baseline = await renderAndMeasure(
      page,
      'three-scene 60s',
      'baseline-60s-9x16.mp4',
    );

    // --- Day1, two different sources -----------------------------------------
    await page.goto('/');
    await page.getByTestId('template-day1').click();
    await page.getByTestId('template-switch-confirm').click();
    await page.getByTestId('day1-panel-a-input').setInputFiles(PANEL_A_SOURCE);
    await page.getByTestId('day1-panel-b-input').setInputFiles(PANEL_B_SOURCE);
    await page.getByRole('button', {name: '60초'}).click();
    await page.getByTestId('ratio-9:16').click();
    await expect(page.getByTestId('day1-panels-blocker')).toHaveCount(0);

    const day1 = await renderAndMeasure(page, 'day1 60s', 'day1-60s-9x16.mp4');

    console.log(
      `[longform] ratio ${(day1.renderMs / baseline.renderMs).toFixed(2)}x`,
    );

    // Plan NFR: Day1 must not cost more than 1.5x the three-scene baseline.
    expect(day1.renderMs).toBeLessThan(baseline.renderMs * 1.5);
  });
});
