// Verifies the header fps toggle all the way to the encoded file: renders the
// same project at 30fps and at 60fps and probes the resulting MP4s for their
// real frame rate and frame count. Everything else asserts the UI state or the
// file name — this asserts the pixels' timebase.
//
// Opt-in: two real 15s renders. Run when the fps or render path changes:
//   RENDER_FPS_OUTPUT=1 npx playwright test tests/e2e/render-fps-output.spec.ts
import {execFile} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import {expect, test, type Page} from '@playwright/test';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = resolve(projectRoot, 'tests/fixtures/gameplay-sample.mp4');
const outputDirectory = resolve(projectRoot, 'artifacts/render-fps');

const RENDER_TIMEOUT = 10 * 60 * 1000;
/** The default duration preset every render below uses. */
const PRESET_SECONDS = 15;

interface VideoProbe {
  rFrameRate: string;
  avgFrameRate: string;
  frameCount: number;
  durationSeconds: number;
}

const probeVideo = async (filePath: string): Promise<VideoProbe> => {
  const {stdout} = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-count_frames',
    '-show_entries',
    'stream=r_frame_rate,avg_frame_rate,nb_read_frames:format=duration',
    '-print_format',
    'json',
    filePath,
  ]);
  const parsed = JSON.parse(stdout) as {
    streams: Array<{
      r_frame_rate: string;
      avg_frame_rate: string;
      nb_read_frames: string;
    }>;
    format: {duration: string};
  };
  const stream = parsed.streams[0];

  if (!stream) {
    throw new Error(`no video stream in ${filePath}`);
  }

  return {
    rFrameRate: stream.r_frame_rate,
    avgFrameRate: stream.avg_frame_rate,
    // Counted, not read from a header field — this is the real decoded total.
    frameCount: Number(stream.nb_read_frames),
    durationSeconds: Number(parsed.format.duration),
  };
};

/** ffprobe reports frame rates as a rational string like "30/1". */
const asFps = (rational: string) => {
  const [numerator, denominator] = rational.split('/').map(Number);

  return (numerator ?? 0) / (denominator || 1);
};

const uploadFixture = async (page: Page) => {
  await page.getByTestId('source-input').setInputFiles(fixturePath);
  await expect(page.getByTestId('source-metadata')).toContainText(
    'gameplay-sample.mp4',
  );
};

const renderAtFps = async (page: Page, fps: 30 | 60, fileName: string) => {
  await page.getByTestId(`stage-fps-${fps}`).click();
  await expect(page.getByTestId(`stage-fps-${fps}`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const downloadPromise = page.waitForEvent('download', {
    timeout: RENDER_TIMEOUT,
  });

  await page.getByRole('button', {name: 'MP4 렌더'}).click();
  await expect(page.getByTestId('open-batch')).toBeDisabled();
  await expect(page.getByTestId('open-batch')).toBeEnabled({
    timeout: RENDER_TIMEOUT,
  });
  await expect(page.getByTestId('editor-render-status')).toContainText('완료');
  await page.getByRole('button', {name: '다운로드'}).click();

  const download = await downloadPromise;

  await mkdir(outputDirectory, {recursive: true});

  const outputPath = resolve(outputDirectory, fileName);

  await download.saveAs(outputPath);

  return {outputPath, suggestedFilename: download.suggestedFilename()};
};

test.describe('rendered MP4 honours the selected frame rate', () => {
  test.skip(
    !process.env.RENDER_FPS_OUTPUT,
    'Opt-in measurement: set RENDER_FPS_OUTPUT=1',
  );
  test.setTimeout(20 * 60 * 1000);
  test.use({actionTimeout: 30_000});

  test('encodes 30fps and 60fps files with the matching frame counts', async ({
    page,
  }) => {
    await page.goto('/');
    await uploadFixture(page);

    // --- 30fps (the new default) --------------------------------------------
    const thirty = await renderAtFps(page, 30, 'render-30fps.mp4');
    const thirtyProbe = await probeVideo(thirty.outputPath);

    console.log('[render-fps] 30fps ->', JSON.stringify(thirtyProbe));

    expect(thirty.suggestedFilename).toContain('_30fps.mp4');
    expect(thirtyProbe.rFrameRate).toBe('30/1');
    // avg_frame_rate spans first-to-last frame (N frames = N-1 intervals), so
    // it sits a fraction above nominal — check the value, not the string.
    expect(asFps(thirtyProbe.avgFrameRate)).toBeCloseTo(30, 0);
    // 15s x 30fps = 450 frames, exactly.
    expect(thirtyProbe.frameCount).toBe(PRESET_SECONDS * 30);
    expect(thirtyProbe.durationSeconds).toBeGreaterThan(14.5);
    expect(thirtyProbe.durationSeconds).toBeLessThan(15.6);

    // --- 60fps, same project -------------------------------------------------
    const sixty = await renderAtFps(page, 60, 'render-60fps.mp4');
    const sixtyProbe = await probeVideo(sixty.outputPath);

    console.log('[render-fps] 60fps ->', JSON.stringify(sixtyProbe));

    expect(sixty.suggestedFilename).toContain('_60fps.mp4');
    expect(sixtyProbe.rFrameRate).toBe('60/1');
    expect(asFps(sixtyProbe.avgFrameRate)).toBeCloseTo(60, 0);
    // 15s x 60fps = 900 frames — exactly twice the 30fps file.
    expect(sixtyProbe.frameCount).toBe(PRESET_SECONDS * 60);
    expect(sixtyProbe.frameCount).toBe(thirtyProbe.frameCount * 2);
    expect(sixtyProbe.durationSeconds).toBeGreaterThan(14.5);
    expect(sixtyProbe.durationSeconds).toBeLessThan(15.6);

    // Same wall-clock length, different timebase — that is the whole point.
    expect(
      Math.abs(sixtyProbe.durationSeconds - thirtyProbe.durationSeconds),
    ).toBeLessThan(0.2);
  });
});
