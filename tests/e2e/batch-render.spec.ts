// Module 7 verification: profile/fps constraints, locale x ratio expansion, the
// sequential queue with real renders, output naming, and the preflight gate.
// Design Ref: §1.3 Output, §2.2 queue, §3.5 max 12, §5.5 Batch dialog, §6.3.
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = resolve(projectRoot, 'tests/fixtures/gameplay-sample.mp4');
const longNarration = resolve(projectRoot, 'tests/fixtures/narration-long.wav');

const uploadFixture = async (page: Page) => {
  await page.getByTestId('source-input').setInputFiles(fixturePath);
  await expect(page.getByTestId('source-metadata')).toContainText(
    'gameplay-sample.mp4',
  );
};

test.describe('module-7 batch render', () => {
  test.setTimeout(15 * 60 * 1000);

  test('constrains fps by profile and expands the full 12-job matrix', async ({
    page,
  }) => {
    await page.goto('/');
    await uploadFixture(page);
    await page.getByTestId('open-batch').click();

    // Standard defaults to 1080p60 and allows both frame rates.
    await expect(page.getByTestId('batch-profile-standard')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('batch-fps-60')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Fast is 30fps only and must not silently keep 60.
    await page.getByTestId('batch-profile-fast').click();
    await expect(page.getByTestId('batch-fps-60')).toBeDisabled();
    await expect(page.getByTestId('batch-fps-30')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByTestId('batch-profile-high').click();
    await page.getByTestId('batch-fps-60').click();
    await expect(page.getByTestId('batch-fps-60')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // 4 locales x 3 ratios = the 12-job maximum.
    await expect(page.getByTestId('batch-summary')).toContainText('작업 1개');

    for (const locale of ['en', 'ja', 'zh-TW']) {
      await page.getByTestId(`batch-locale-${locale}`).check();
    }
    for (const ratio of ['1:1', '16:9']) {
      await page.getByTestId(`batch-ratio-${ratio}`).check();
    }

    await expect(page.getByTestId('batch-summary')).toContainText('작업 12개');
    await expect(page.getByTestId('batch-summary')).toContainText('최대 12개');
  });

  test('blocks the batch when preflight fails', async ({page}) => {
    await page.goto('/');
    await uploadFixture(page);

    // 4s narration in the 2s Hook scene.
    await page.getByTestId('tab-audio').click();
    await page.getByTestId('narration-upload-hook').setInputFiles(longNarration);

    await page.getByTestId('open-batch').click();
    await page.getByTestId('batch-start').click();

    await expect(page.getByTestId('batch-preflight')).toContainText(
      '나레이션이 장면보다 깁니다',
    );
    await expect(page.getByTestId('batch-queue')).toBeHidden();
  });

  test('renders a two-job batch sequentially and names every output', async ({
    page,
  }) => {
    await page.goto('/');
    await uploadFixture(page);
    await page.getByLabel('프로젝트 이름').fill('배치-테스트');
    await page.getByTestId('open-batch').click();

    // Two jobs: ko 9:16 and ko 1:1, at the fastest profile.
    await page.getByTestId('batch-profile-fast').click();
    await page.getByTestId('batch-ratio-1:1').check();
    await expect(page.getByTestId('batch-summary')).toContainText('작업 2개');
    await expect(page.getByTestId('batch-summary')).toContainText(
      '브라우저 다운로드',
    );

    const downloads: string[] = [];
    page.on('download', (download) =>
      downloads.push(download.suggestedFilename()),
    );

    await page.getByTestId('batch-start').click();

    await expect(page.getByTestId('batch-progress')).toHaveText('완료 2/2', {
      timeout: 12 * 60 * 1000,
    });

    const rows = page.getByTestId('batch-queue').locator('tbody tr');

    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('완료');
    await expect(rows.nth(1)).toContainText('완료');
    await expect(rows.nth(0)).toContainText('배치-테스트_ko_9x16_15s_30fps.mp4');
    await expect(rows.nth(1)).toContainText('배치-테스트_ko_1x1_15s_30fps.mp4');

    expect(downloads).toEqual([
      '배치-테스트_ko_9x16_15s_30fps.mp4',
      '배치-테스트_ko_1x1_15s_30fps.mp4',
    ]);
  });
});
