// day1-endcard-audio Plan SC4/SC5 — the toggle+volume controls (L2) and the
// rendered proof (L3): an enabled card carries its tone into 12..15s, the
// closing 0.25s fades, and a disabled card stays digitally silent. The panel
// fixtures embed distinct tones (generate-editor-fixture.mjs), which is what
// makes the audio measurable.
import {execFile} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import {expect, test, type Page} from '@playwright/test';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);
const outputDirectory = resolve(projectRoot, 'artifacts/endcard-audio');

const PANEL_A_SOURCE = fixture('gameplay-sample.mp4');
const PANEL_B_SOURCE = fixture('day1-panel-b.mp4');
/** 12s source with an AAC tone — long enough that the 3s window trims. */
const ENDCARD_SOURCE = fixture('day1-panel-b.mp4');

const RENDER_TIMEOUT = 10 * 60 * 1000;

const selectDay1 = async (page: Page) => {
  await page.getByTestId('template-day1').click();
  await page.getByTestId('template-switch-confirm').click();
  await expect(page.getByTestId('inspector-template')).toHaveText('Day1 비교');
};

const uploadPanels = async (page: Page) => {
  await page.getByTestId('day1-panel-a-input').setInputFiles(PANEL_A_SOURCE);
  await page.getByTestId('day1-panel-b-input').setInputFiles(PANEL_B_SOURCE);
  await expect(page.getByTestId('day1-panels-blocker')).toHaveCount(0);
};

const openEndCardInVideoMode = async (page: Page) => {
  await page.getByTestId('section-day1-endcard').click();
  await page.getByTestId('day1-endcard-mode-video').click();
};

const renderAndSave = async (page: Page, fileName: string) => {
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

  return outputPath;
};

/** Mean loudness (dB) of a time slice — ffmpeg volumedetect. */
const meanVolumeAt = async (filePath: string, start: number, duration: number) => {
  const {stderr} = await execFileAsync('ffmpeg', [
    '-v',
    'info',
    '-ss',
    String(start),
    '-t',
    String(duration),
    '-i',
    filePath,
    '-af',
    'volumedetect',
    '-f',
    'null',
    '-',
  ]);
  const match = /mean_volume:\s*(-?[\d.]+) dB/.exec(stderr);

  if (!match) {
    throw new Error(`no mean_volume in ffmpeg output for ${filePath}`);
  }

  return Number(match[1]);
};

test.describe('end-card audio — inspector (L2)', () => {
  test.use({actionTimeout: 20_000});

  test('shows the toggle and volume in video mode only, on by default (SC4)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectDay1(page);
    await page.getByTestId('section-day1-endcard').click();

    // Banner mode has no audio controls.
    await expect(page.getByTestId('day1-endcard-audio-toggle')).toHaveCount(0);

    await page.getByTestId('day1-endcard-mode-video').click();

    const toggle = page.getByTestId('day1-endcard-audio-toggle');

    await expect(toggle).toBeVisible();
    await expect(toggle).toBeChecked();
    // No video picked yet — controls wait for one.
    await expect(toggle).toBeDisabled();

    await page.getByTestId('day1-endcard-video').setInputFiles(ENDCARD_SOURCE);
    await expect(toggle).toBeEnabled();
    await expect(page.getByTestId('day1-endcard-audio-volume')).toBeEnabled();

    // Turning the audio off parks the volume control.
    await toggle.uncheck();
    await expect(page.getByTestId('day1-endcard-audio-volume')).toBeDisabled();
  });
});

test.describe('end-card audio — render (L3)', () => {
  test.setTimeout(15 * 60 * 1000);
  test.use({actionTimeout: 20_000});

  test('carries the card audio into the output and fades the close (SC5)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectDay1(page);
    await uploadPanels(page);
    await openEndCardInVideoMode(page);
    await page.getByTestId('day1-endcard-video').setInputFiles(ENDCARD_SOURCE);
    await expect(page.getByTestId('day1-endcard-audio-toggle')).toBeChecked();

    // FR-02 — shorten the window to 2s so the card loops: sound measured past
    // 14s can only come from the second pass of the looped window.
    const handle = page.getByTestId('day1-endcard-trim-length');

    await handle.focus();
    await handle.press('Shift+ArrowLeft');
    await expect(handle).toHaveAttribute('aria-valuenow', '2000');

    const outputPath = await renderAndSave(page, 'endcard-audio-on.mp4');

    // The card body carries the fixture tone — 14.0..14.5s sits inside the
    // loop's second pass, so this asserts the audio loops with the video.
    const body = await meanVolumeAt(outputPath, 13, 1.5);
    const loopPass = await meanVolumeAt(outputPath, 14.1, 0.4);

    expect(body).toBeGreaterThan(-55);
    expect(loopPass).toBeGreaterThan(-55);

    // FR-03 — deep in the closing fade the level has clearly dropped. Measured
    // profile on a real render: body -21.1dB, 14.9s+ -30.1dB (a 9dB drop);
    // the 6dB threshold leaves headroom for encoder variance.
    const tail = await meanVolumeAt(outputPath, 14.9, 0.18);

    expect(tail).toBeLessThan(body - 6);
  });

  test('keeps the card silent when the toggle is off (SC5)', async ({page}) => {
    await page.goto('/');
    await selectDay1(page);
    await uploadPanels(page);
    await openEndCardInVideoMode(page);
    await page.getByTestId('day1-endcard-video').setInputFiles(ENDCARD_SOURCE);
    await page.getByTestId('day1-endcard-audio-toggle').uncheck();

    const outputPath = await renderAndSave(page, 'endcard-audio-off.mp4');

    // 12.5s onward skips the panel fade tail; this must be silence again.
    expect(await meanVolumeAt(outputPath, 12.5, 2.5)).toBeLessThan(-70);
  });
});
