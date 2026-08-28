// day1-render-fps Design Ref: §8.3 — the header fps segmented control. The chip
// that used to hardcode "60fps" is now the control itself, so these tests pin
// the two things that used to be able to disagree: what the header shows and
// what the project will actually render.
import {expect, test} from '@playwright/test';

import {uploadDay1Panels} from './helpers/day1Source';

test.describe('header fps control', () => {
  test('defaults to 30fps and toggles to 60 (L2 #1-2, §5.4)', async ({page}) => {
    await page.goto('/');

    // FR-01 — a new project starts at 30fps, and the header says so.
    await expect(page.getByTestId('stage-fps-30')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('stage-fps-60')).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // FR-02 — the chip is a control now; there is no hardcoded fps text left.
    await expect(
      page.locator('.stage__chip', {hasText: 'fps'}),
    ).toHaveCount(0);

    await page.getByTestId('stage-fps-60').click();
    await expect(page.getByTestId('stage-fps-60')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('stays in sync with the Batch dialog both ways (L2 #3-4, FR-06)', async ({
    page,
  }) => {
    await page.goto('/');

    // Header → Batch.
    await page.getByTestId('stage-fps-60').click();
    await page.getByTestId('open-batch').click();
    await expect(page.getByTestId('batch-fps-60')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Batch → header.
    await page.getByTestId('batch-fps-30').click();
    await page.getByTestId('batch-close').click();
    await expect(page.getByTestId('stage-fps-30')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('disables 60fps under the fast profile (L2 #5, FR-03)', async ({page}) => {
    await page.goto('/');

    await page.getByTestId('open-batch').click();
    await page.getByTestId('batch-profile-fast').click();
    await page.getByTestId('batch-close').click();

    await expect(page.getByTestId('stage-fps-60')).toBeDisabled();
    await expect(page.getByTestId('stage-fps-30')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('locks the control while a render is running (L2 #6, FR-04)', async ({
    page,
  }) => {
    await page.goto('/');
    await uploadDay1Panels(page);

    await page.getByRole('button', {name: 'MP4 렌더'}).click();
    await expect(page.getByTestId('stage-fps-30')).toBeDisabled();
    await expect(page.getByTestId('stage-fps-60')).toBeDisabled();

    // Abort so the suite does not pay for a full render.
    await page.getByRole('button', {name: '취소'}).click();
    await expect(page.getByTestId('stage-fps-30')).toBeEnabled();
  });
});
