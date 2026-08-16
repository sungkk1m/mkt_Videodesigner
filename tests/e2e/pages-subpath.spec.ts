// Design Ref: §8.4 scenario 9 — "GitHub Pages: load from repository subpath and
// refresh; app, workers, fonts, model URLs resolve."
//
// This runs the real production build behind a `/mkt_Videodesigner` prefix, the
// same shape GitHub Pages uses, so the deployment layout is verified before any
// deployment happens. Only the hosting is simulated; the bundle is the real one.
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = resolve(projectRoot, 'tests/fixtures/gameplay-sample.mp4');
const SUBPATH_URL = 'http://127.0.0.1:4190/mkt_Videodesigner/';

/** Console errors and failed requests must both stay empty. */
const collectFailures = (page: Page) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('requestfailed', (request) => {
    // A video element aborting its own blob read is normal teardown, not a
    // hosting problem, so only real network URLs are collected.
    if (request.url().startsWith('blob:') || request.url().startsWith('data:')) {
      return;
    }

    failedRequests.push(`${request.url()} ${request.failure()?.errorText ?? ''}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedRequests.push(`${response.url()} ${response.status()}`);
    }
  });

  return {consoleErrors, failedRequests};
};

test.describe('GitHub Pages subpath layout', () => {
  test.setTimeout(10 * 60 * 1000);

  test('loads, survives a refresh, and resolves every asset under the subpath', async ({
    page,
  }) => {
    const {consoleErrors, failedRequests} = collectFailures(page);

    await page.goto(SUBPATH_URL);

    await expect(page.getByText('UA Video Designer')).toBeVisible();
    await expect(page.getByTestId('editor-render-status')).not.toHaveText(
      '환경 확인 중',
      {timeout: 30_000},
    );

    // Every script and stylesheet must have come from under the base path.
    const assetUrls = await page.evaluate(() =>
      [...document.querySelectorAll('script[src], link[href]')].map(
        (node) =>
          node.getAttribute('src') ?? node.getAttribute('href') ?? '',
      ),
    );

    expect(assetUrls.length).toBeGreaterThan(0);
    for (const url of assetUrls) {
      expect(url.startsWith('/assets')).toBe(false);
    }

    // Refresh must not 404 on a subpath.
    await page.reload();
    await expect(page.getByText('UA Video Designer')).toBeVisible();

    expect(failedRequests).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('runs the Worker and a real render from the subpath build', async ({
    page,
  }) => {
    const {failedRequests} = collectFailures(page);

    await page.goto(SUBPATH_URL);
    await page.getByTestId('source-input').setInputFiles(fixturePath);
    await expect(page.getByTestId('source-metadata')).toContainText(
      'gameplay-sample.mp4',
    );

    // The Hook analyzer worker is bundled as its own chunk; a wrong base path
    // breaks it and nothing else.
    await page.getByTestId('tab-hook').click();
    await page.getByTestId('hook-analyze').click();
    await expect(page.getByTestId('hook-candidates')).toBeVisible({
      timeout: 2 * 60 * 1000,
    });

    // A real MP4 render from the production bundle.
    const downloadPromise = page.waitForEvent('download', {
      timeout: 8 * 60 * 1000,
    });
    await page.getByRole('button', {name: 'MP4 렌더'}).click();
    await expect(page.getByTestId('editor-render-status')).toContainText('완료', {
      timeout: 8 * 60 * 1000,
    });
    await page.getByRole('button', {name: '다운로드'}).click();

    expect((await downloadPromise).suggestedFilename()).toBe(
      'ua-video_ko_9x16_15s_30fps.mp4',
    );
    expect(failedRequests).toEqual([]);
  });
});
