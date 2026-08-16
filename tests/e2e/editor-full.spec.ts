// Module 4 verification: four-locale copy, ratio switching with per-ratio
// framing, transitions, Hook motion, CTA fallback, and a real 1:1 render.
// Design Ref: §5.5, §8.3 scenarios 3-5, §8.4 scenarios 3-5.
import {execFile} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import {expect, test, type Page} from '@playwright/test';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = resolve(projectRoot, 'tests/fixtures/gameplay-sample.mp4');
const outputDirectory = resolve(projectRoot, 'artifacts/module-4');

const probeVideo = async (filePath: string) => {
  const {stdout} = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);

  return JSON.parse(stdout) as {
    format: {duration: string};
    streams: Array<{
      codec_type: string;
      codec_name: string;
      width?: number;
      height?: number;
    }>;
  };
};

const uploadFixture = async (page: Page) => {
  await page.getByTestId('source-input').setInputFiles(fixturePath);
  await expect(page.getByTestId('source-metadata')).toContainText(
    'gameplay-sample.mp4',
  );
};

test.describe('module-4 full editor', () => {
  test.setTimeout(10 * 60 * 1000);

  test('keeps four locales independent and renders the selected ratio', async ({
    page,
  }) => {
    await page.goto('/');
    await uploadFixture(page);

    // --- Four-locale copy -------------------------------------------------
    await page.getByTestId('tab-copy').click();
    await page.getByTestId('copy-hook').fill('3일 만에 만렙');
    await page.getByTestId('copy-subtitle-gameplay').fill('실제 플레이 화면');
    await page.getByTestId('copy-cta').fill('지금 다운로드');

    await page.getByTestId('locale-en').click();
    await expect(page.getByTestId('copy-hook')).toHaveValue('');
    await page.getByTestId('copy-hook').fill('Max level in 3 days');
    await page.getByTestId('copy-cta').fill('Download now');

    await page.getByTestId('locale-ja').click();
    await expect(page.getByTestId('copy-hook')).toHaveValue('');

    await page.getByTestId('locale-ko').click();
    await expect(page.getByTestId('copy-hook')).toHaveValue('3일 만에 만렙');
    await expect(page.getByTestId('copy-cta')).toHaveValue('지금 다운로드');

    await page.getByTestId('locale-en').click();
    await expect(page.getByTestId('copy-hook')).toHaveValue(
      'Max level in 3 days',
    );
    await page.getByTestId('locale-ko').click();

    // --- Hook motion and transition --------------------------------------
    // Only Trim and Transform open by default; the rest are collapsed.
    await page.getByTestId('timeline-clip-hook').click();
    await page.getByTestId('section-hook').click();
    await page.getByTestId('section-transition').click();
    await page.getByTestId('hook-emphasis').fill('3일');
    await page.getByTestId('hook-preset-focus').click();
    await expect(page.getByTestId('hook-preset-focus')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByTestId('transition-fade').click();
    await expect(page.getByTestId('transition-duration')).toBeVisible();

    // --- Per-ratio framing ------------------------------------------------
    await expect(page.getByTestId('output-size')).toHaveText('1080×1920');
    await page.getByTestId('transform-scale').fill('1.5');
    await expect(page.getByTestId('transform-scale')).toHaveValue('1.5');

    await page.getByTestId('ratio-1:1').click();
    await expect(page.getByTestId('output-size')).toHaveText('1080×1080');
    // No override yet, so the base framing carries over.
    await expect(page.getByTestId('transform-scale')).toHaveValue('1.5');

    await page.getByTestId('ratio-override').check();
    await page.getByTestId('transform-scale').fill('2.2');
    await expect(page.getByTestId('transform-scale')).toHaveValue('2.2');

    await page.getByTestId('ratio-9:16').click();
    await expect(page.getByTestId('output-size')).toHaveText('1080×1920');
    await expect(page.getByTestId('transform-scale')).toHaveValue('1.5');

    // --- Render the 1:1 output -------------------------------------------
    await page.getByTestId('ratio-1:1').click();
    await expect(page.getByTestId('editor-render-status')).toHaveText('대기');

    const downloadPromise = page.waitForEvent('download', {
      timeout: 8 * 60 * 1000,
    });
    await page.getByRole('button', {name: 'MP4 렌더'}).click();
    await expect(page.getByTestId('editor-render-status')).toContainText(
      '완료',
      {timeout: 8 * 60 * 1000},
    );
    await page.getByRole('button', {name: '다운로드'}).click();

    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('ua-video_ko_1x1_15s_30fps.mp4');

    await mkdir(outputDirectory, {recursive: true});
    const outputPath = resolve(outputDirectory, 'editor-full-1x1.mp4');
    await download.saveAs(outputPath);

    const probe = await probeVideo(outputPath);
    const video = probe.streams.find((s) => s.codec_type === 'video');

    expect(video).toMatchObject({codec_name: 'h264', width: 1080, height: 1080});
    expect(Number(probe.format.duration)).toBeGreaterThan(14.5);
    expect(Number(probe.format.duration)).toBeLessThan(15.6);
  });
});
