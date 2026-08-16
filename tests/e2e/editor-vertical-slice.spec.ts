import {execFile} from 'node:child_process';
import {mkdir, readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import {expect, test, type Page} from '@playwright/test';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = resolve(projectRoot, 'tests/fixtures/gameplay-sample.mp4');
const palettePath = resolve(
  projectRoot,
  'tests/fixtures/gameplay-sample.colors.json',
);
const outputDirectory = resolve(projectRoot, 'artifacts/module-3a');

const hexToRgb = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

/** Reads the center pixel of one output frame as RGB. */
const sampleCenterColor = async (
  filePath: string,
  seconds: number,
): Promise<[number, number, number]> => {
  const {stdout} = await execFileAsync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-ss',
      String(seconds),
      '-i',
      filePath,
      '-frames:v',
      '1',
      '-vf',
      'crop=200:200:440:860,scale=1:1',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-',
    ],
    {encoding: 'buffer'},
  );

  return [stdout[0] as number, stdout[1] as number, stdout[2] as number];
};

/** Maps a sampled frame back to the source second it was taken from. */
const sourceSecondOf = async (filePath: string, seconds: number) => {
  const palette = JSON.parse(await readFile(palettePath, 'utf8')) as string[];
  const sample = await sampleCenterColor(filePath, seconds);

  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  palette.forEach((hex, index) => {
    const [r, g, b] = hexToRgb(hex);
    const distance =
      (r - sample[0]) ** 2 + (g - sample[1]) ** 2 + (b - sample[2]) ** 2;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
};

const uploadFixture = async (page: Page) => {
  await page.getByTestId('source-input').setInputFiles(fixturePath);
  await expect(page.getByTestId('source-metadata')).toContainText(
    'gameplay-sample.mp4',
  );
};

/**
 * Commits a numeric inspector field and settles focus before the next one, so a
 * blur-driven re-render never races the following `fill`.
 */
const fillField = async (page: Page, testId: string, value: string) => {
  await page.getByTestId(testId).fill(value);
  await page.getByTestId(testId).blur();
};

const sceneDurations = async (
  page: Page,
): Promise<[number, number, number]> => {
  const [hook, gameplay, cta] = await Promise.all(
    ['hook', 'gameplay', 'cta'].map(async (kind) =>
      Number(
        (await page.getByTestId(`timeline-duration-${kind}`).innerText()).replace(
          '초',
          '',
        ),
      ),
    ),
  );

  return [hook as number, gameplay as number, cta as number];
};

test.describe('module-3a editor vertical slice', () => {
  test.setTimeout(15 * 60 * 1000);

  test('uploads footage, edits the fixed timeline, previews, and renders an MP4', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByText('UA Video Designer')).toBeVisible();

    // Preset defaults.
    expect(await sceneDurations(page)).toEqual([2, 10, 3]);
    await page.getByRole('button', {name: '30초'}).click();
    expect(await sceneDurations(page)).toEqual([3, 24, 3]);
    await page.getByRole('button', {name: '60초'}).click();
    expect(await sceneDurations(page)).toEqual([3, 54, 3]);
    await page.getByRole('button', {name: '15초'}).click();
    expect(await sceneDurations(page)).toEqual([2, 10, 3]);

    // Real local upload, probed metadata, and one-shot apply to all scenes.
    await uploadFixture(page);
    await expect(page.getByTestId('source-metadata')).toContainText('video/mp4');
    await expect(page.getByTestId('source-metadata')).toContainText('12.00초');
    await expect(page.getByTestId('source-metadata')).toContainText('1920×1080');
    await expect(page.getByTestId('trim-range')).toContainText('0.00s – 2.00s');

    // Boundary drag keeps the total duration invariant.
    const track = await page.getByTestId('timeline-track').boundingBox();
    const boundary = await page.getByTestId('timeline-boundary-0').boundingBox();
    expect(track).not.toBeNull();
    expect(boundary).not.toBeNull();

    await page.mouse.move(
      boundary!.x + boundary!.width / 2,
      boundary!.y + boundary!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      track!.x + track!.width * 0.3,
      boundary!.y + boundary!.height / 2,
      {steps: 12},
    );
    await page.mouse.up();

    const afterDrag = await sceneDurations(page);
    expect(afterDrag[0]).toBeGreaterThan(3);
    expect(afterDrag[0] + afterDrag[1] + afterDrag[2]).toBeCloseTo(15, 1);

    // Keyboard boundary control and the one-second minimum.
    await page.getByTestId('timeline-boundary-1').focus();
    for (let index = 0; index < 20; index += 1) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    const afterKeyboard = await sceneDurations(page);
    expect(afterKeyboard[2]).toBeCloseTo(1, 1);
    expect(afterKeyboard[0] + afterKeyboard[1] + afterKeyboard[2]).toBeCloseTo(
      15,
      1,
    );

    // Restore the approved defaults before trimming.
    await page.getByRole('button', {name: '30초'}).click();
    await page.getByRole('button', {name: '15초'}).click();
    expect(await sceneDurations(page)).toEqual([2, 10, 3]);

    // Scene selection drives the inspector.
    await page.getByTestId('timeline-clip-gameplay').click();
    await expect(page.getByTestId('inspector-scene')).toHaveText('Gameplay');

    // Trim in/out clamped to the 12 second source.
    await fillField(page, 'trim-in', '1.5');
    await expect(page.getByTestId('trim-range')).toContainText('1.50s – 11.50s');

    await fillField(page, 'trim-in', '99');
    await expect(page.getByTestId('trim-range')).toContainText('2.00s – 12.00s');

    // Three-Scene Trim Parity FR-P05 — trim out is `in + window`, so it is a
    // readout that follows trim in rather than a field of its own.
    await expect(page.getByTestId('trim-out')).toHaveText('12.00');

    // Transform controls.
    await page.getByTestId('transform-scale').fill('1.4');
    await page.getByTestId('transform-x').fill('-12');
    await page.getByTestId('transform-y').fill('8');
    await expect(page.getByText('140%')).toBeVisible();
    await expect(page.getByText('-12%')).toBeVisible();
    await page.getByRole('button', {name: 'Transform 초기화'}).click();
    await expect(page.getByText('100%')).toBeVisible();

    // Preview transport.
    await page.getByRole('button', {name: '재생'}).click();
    await expect(page.getByRole('button', {name: '일시정지'})).toBeVisible();
    await page.getByRole('button', {name: '일시정지'}).click();
    await page.getByLabel('재생 위치').fill('300');
    await expect(page.getByTestId('transport-time')).toContainText('00:05.0');
    await expect(page.getByTestId('transport-time')).toContainText('00:15.0');

    // Source shorter than the scene is surfaced, not silently accepted.
    await page.getByRole('button', {name: '30초'}).click();
    await page.getByTestId('timeline-clip-gameplay').click();
    await expect(
      page.getByText('원본이 장면보다 짧아 남은 시간은 검은 화면으로 출력됩니다.'),
    ).toBeVisible();
    await page.getByRole('button', {name: '15초'}).click();

    // Per-scene source intervals used by the render assertions below.
    await page.getByTestId('timeline-clip-hook').click();
    await fillField(page, 'trim-in', '6');
    await expect(page.getByTestId('trim-range')).toContainText('6.00s – 8.00s');

    await page.getByTestId('timeline-clip-gameplay').click();
    await fillField(page, 'trim-in', '99');
    await expect(page.getByTestId('trim-range')).toContainText('2.00s – 12.00s');

    await page.getByTestId('timeline-clip-cta').click();
    await fillField(page, 'trim-in', '9');
    await expect(page.getByTestId('trim-range')).toContainText('9.00s – 12.00s');

    // Cancellation returns the editor to a usable state.
    await page.getByRole('button', {name: 'MP4 렌더'}).click();
    await expect(page.getByTestId('editor-render-status')).toContainText('렌더 중');
    await page.getByRole('button', {name: '취소', exact: true}).click();
    await expect(page.getByTestId('editor-render-status')).toContainText('취소됨', {
      timeout: 60_000,
    });
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeEnabled();

    // Full render of the current edit.
    await page.getByRole('button', {name: 'MP4 렌더'}).click();
    await expect(page.getByTestId('editor-render-status')).toContainText('완료', {
      timeout: 10 * 60 * 1000,
    });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', {name: '다운로드'}).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('ua-video_ko_9x16_15s_60fps.mp4');

    await mkdir(outputDirectory, {recursive: true});
    const outputPath = resolve(outputDirectory, 'editor-vertical-slice.mp4');
    await download.saveAs(outputPath);

    const {stdout} = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=codec_name,codec_type,width,height,r_frame_rate,nb_frames',
      '-of',
      'json',
      outputPath,
    ]);
    const probe = JSON.parse(stdout) as {
      format: {duration: string};
      streams: Array<{
        codec_name: string;
        codec_type: string;
        width?: number;
        height?: number;
        r_frame_rate?: string;
        nb_frames?: string;
      }>;
    };
    const video = probe.streams.find((stream) => stream.codec_type === 'video');
    const audio = probe.streams.find((stream) => stream.codec_type === 'audio');

    expect(video).toMatchObject({
      codec_name: 'h264',
      width: 1080,
      height: 1920,
      r_frame_rate: '60/1',
    });
    expect(audio?.codec_name).toBe('aac');
    expect(Number(probe.format.duration)).toBeGreaterThan(14.5);
    expect(Number(probe.format.duration)).toBeLessThan(15.6);

    // Each output second maps back to the trimmed source second of its scene,
    // proving per-scene trim offsets and boundaries survive the render.
    expect(await sourceSecondOf(outputPath, 0.5)).toBe(6); // hook, trim 6s
    expect(await sourceSecondOf(outputPath, 1.5)).toBe(7);
    expect(await sourceSecondOf(outputPath, 2.5)).toBe(2); // gameplay, trim 2s
    expect(await sourceSecondOf(outputPath, 11.5)).toBe(11);

    // Module 4: with no dedicated CTA media the CTA background is generated by
    // freezing the last gameplay frame, so both CTA samples show that frame.
    expect(await sourceSecondOf(outputPath, 12.5)).toBe(11);
    expect(await sourceSecondOf(outputPath, 14.5)).toBe(11);
  });

  test('rejects a file Chrome cannot decode as video', async ({page}) => {
    await page.goto('/');

    await page.getByTestId('source-input').setInputFiles({
      name: 'broken.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('not a real mp4'),
    });

    await expect(page.getByTestId('source-error')).toContainText('H.264');
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeDisabled();
  });
});
