// Plan FR-M01 / FR-M02 / FR-M03 / FR-M04 / FR-M06 — media-codec-compat.
//
// Claims worth locking down, all measured on Chrome 148 rather than assumed:
//   1. HEVC (the iPhone / screen-recording codec) uploads AND renders. The Plan
//      was written when Chrome's `<video>` still refused HEVC; it no longer does,
//      so this test is what tells us if that ever regresses.
//   2. AV1 and VP8 upload too. Nothing in the probe path branches on codec, so
//      these guard the claim that the accepted set really is "whatever Chrome
//      decodes" rather than a list we maintain.
//   3. MPEG-4 Part 2 (mp4v) has no decode path in Chrome at all, so the only
//      thing we control is whether the rejection is honest. It must name the
//      codec — the old copy told the user to pick "a file with a video track"
//      for a file that has one.
//   4. The same honesty applies to audio: ALAC comes out of Apple tools and
//      Chrome cannot decode it.
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

  // FR-M02 / FR-M04. Every accepted codec goes all the way to an MP4, because
  // "upload succeeded" is not the promise — "you will get a file out" is. Only
  // HEVC used to be covered end to end, which left AV1 and VP8 true but
  // unguarded (Check Gap-2).
  //
  // VP8 ships as WebM because ffmpeg will not mux it into mp4. That also puts a
  // container the fourcc reader deliberately cannot parse through the happy
  // path — the reader never runs there, because the upload succeeds.
  for (const {label, file, output} of [
    {label: 'HEVC', file: 'codec-hevc.mp4', output: 'hevc-source-1x1.mp4'},
    {label: 'AV1', file: 'codec-av1.mp4', output: 'av1-source-1x1.mp4'},
    {label: 'VP8 WebM', file: 'codec-vp8.webm', output: 'vp8-source-1x1.mp4'},
  ]) {
    test(`accepts and renders a ${label} source end to end`, async ({page}) => {
      await page.goto('/');
      await page.getByTestId('source-input').setInputFiles(fixture(file));

      await expect(page.getByTestId('source-metadata')).toContainText(file, {
        timeout: 30_000,
      });

      await page.getByTestId('ratio-1:1').click();

      const downloadPromise = page.waitForEvent('download', {
        timeout: 8 * 60 * 1000,
      });
      await page.getByRole('button', {name: 'MP4 렌더'}).click();
      await expect(page.getByTestId('editor-render-status')).toContainText(
        '완료',
        {timeout: 8 * 60 * 1000},
      );
      await page.getByRole('button', {name: '다운로드'}).click();

      await mkdir(outputDirectory, {recursive: true});
      const outputPath = resolve(outputDirectory, output);
      await (await downloadPromise).saveAs(outputPath);

      const {stdout} = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_streams',
        outputPath,
      ]);
      const streams = JSON.parse(stdout).streams as Array<
        Record<string, unknown>
      >;

      // Whatever went in, an H.264 MP4 comes out.
      expect(
        streams.find((stream) => stream.codec_type === 'video'),
      ).toMatchObject({codec_name: 'h264', width: 1080, height: 1080});
    });
  }

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

  // FR-M06. The audio panel needs a source loaded before it opens.
  test('names the codec when rejecting an undecodable audio file', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByTestId('source-input')
      .setInputFiles(fixture('gameplay-sample.mp4'));
    await expect(page.getByTestId('source-metadata')).toContainText(
      'gameplay-sample.mp4',
      {timeout: 30_000},
    );

    await page.getByTestId('tab-audio').click();
    await page
      .getByTestId('audio-bgm-input')
      .setInputFiles(fixture('codec-alac.m4a'));

    const error = page.getByText(/디코딩하지 못합니다/);

    await expect(error).toBeVisible({timeout: 30_000});
    await expect(error).toContainText('ALAC (Apple Lossless)');
    await expect(error).toContainText('alac');
  });
});
