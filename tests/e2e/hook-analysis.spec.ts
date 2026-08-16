// Module 5 verification: the heuristic Hook analyzer runs in a real Chrome with
// a real decode, produces selectable candidates, and never blocks the manual
// path. Design Ref: §2.2, §4.4, §5.5 Hook drawer, §8.3 scenarios 6-7.
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = resolve(projectRoot, 'tests/fixtures/gameplay-sample.mp4');

const uploadFixture = async (page: Page) => {
  await page.getByTestId('tab-assets').click();
  await page.getByTestId('source-input').setInputFiles(fixturePath);
  await expect(page.getByTestId('source-metadata')).toContainText(
    'gameplay-sample.mp4',
  );
};

/** The Hook drawer lives in the left rail, alongside assets, copy and audio. */
const openHookTab = async (page: Page) => {
  await page.getByTestId('tab-hook').click();
};

test.describe('module-5 hook analysis', () => {
  test.setTimeout(5 * 60 * 1000);

  test('analyses the source and applies the selected candidate', async ({
    page,
  }) => {
    await page.goto('/');

    // Analysis is unavailable until there is footage, but the drawer is present.
    await openHookTab(page);
    await expect(page.getByTestId('hook-analyze')).toBeDisabled();

    await uploadFixture(page);
    await openHookTab(page);
    await expect(page.getByTestId('hook-analyze')).toBeEnabled();

    await page.getByTestId('hook-analyze').click();
    await expect(page.getByTestId('hook-candidates')).toBeVisible({
      timeout: 2 * 60 * 1000,
    });

    const cards = page.getByTestId('hook-candidates').getByRole('button');
    const count = await cards.count();

    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);

    // Every candidate shows a thumbnail, its interval, and a score.
    await expect(cards.first().locator('img')).toBeVisible();
    await expect(cards.first()).toContainText('점수');
    await expect(page.getByTestId('hook-drawer')).toContainText(
      '성과 예측이 아닙니다',
    );

    // Selecting a candidate moves the Hook trim to its start.
    const label = (await cards.first().locator('strong').innerText()).trim();
    const startSeconds = Number(label.split('s')[0]);

    await cards.first().click();
    await expect(page.getByTestId('inspector-scene')).toHaveText('Hook');
    await expect(page.getByTestId('trim-range')).toContainText(
      `${startSeconds.toFixed(2)}s`,
    );
  });

  test('keeps the manual Hook range usable', async ({page}) => {
    await page.goto('/');
    await uploadFixture(page);
    await openHookTab(page);

    await page.getByTestId('hook-manual-range').fill('4500');
    await expect(page.getByTestId('inspector-scene')).toHaveText('Hook');
    await expect(page.getByTestId('trim-range')).toContainText('4.50s – 6.50s');
  });
});
