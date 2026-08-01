// Plan FR-M01 / FR-M03 / FR-M04 — media-codec-compat.
//
// Two claims worth locking down, both measured on Chrome 148 rather than assumed:
//   1. HEVC (the iPhone / screen-recording codec) uploads AND renders. The Plan
//      was written when Chrome's `<video>` still refused HEVC; it no longer does,
//      so this test is what tells us if that ever regresses.
//   2. MPEG-4 Part 2 (mp4v) has no decode path in Chrome at all, so the only
//      thing we control is whether the rejection is honest. It must name the
//      codec — the old copy told the user to pick "a file with a video track"
//      for a file that has one.
import {execFile} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import {expect, test} from '@playwright/test';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);
const outputDirectory = resolve(projectRoot, 'artifacts/media-codec-compat');

test.describe('media codec compatibility', () => {
  test.setTimeout(8 * 60 * 1000);

  test('accepts and renders an HEVC source end to end', async ({page}) => {
    await page.goto('/');
    await page
      .getByTestId('source-input')
      .setInputFiles(fixture('codec-hevc.mp4'));

    await expect(page.getByTestId('source-metadata')).toContainText(
      'codec-hevc.mp4',
      {timeout: 30_000},
    );

    // FR-M04: passing upload has to mean passing render, not just passing probe.
    await page.getByTestId('ratio-1:1').click();

    const downloadPromise = page.waitForEvent('download', {
      timeout: 8 * 60 * 1000,
    });
    await page.getByRole('button', {name: 'MP4 렌더'}).click();
    await expect(page.getByTestId('editor-render-status')).toContainText('완료', {
      timeout: 8 * 60 * 1000,
    });
    await page.getByRole('button', {name: '다운로드'}).click();

    await mkdir(outputDirectory, {recursive: true});
    const outputPath = resolve(outputDirectory, 'hevc-source-1x1.mp4');
    await (await downloadPromise).saveAs(outputPath);

    const {stdout} = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_streams',
      outputPath,
    ]);
    const streams = JSON.parse(stdout).streams as Array<Record<string, unknown>>;

    expect(streams.find((stream) => stream.codec_type === 'video')).toMatchObject(
      {codec_name: 'h264', width: 1080, height: 1080},
    );
  });

  test('names the codec when rejecting an undecodable source', async ({page}) => {
    await page.goto('/');
    await page
      .getByTestId('source-input')
      .setInputFiles(fixture('codec-mp4v.mp4'));

    const error = page.getByText(/디코딩하지 못합니다|열지 못했습니다/);

    await expect(error).toBeVisible({timeout: 30_000});
    await expect(error).toContainText('MPEG-4 Part 2');
    await expect(error).toContainText('mp4v');
    // The file does have a video track. Saying otherwise sent users hunting for
    // a problem that was not there.
    await expect(error).not.toContainText('영상 트랙이 있는 파일');
  });
});
