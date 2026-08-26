// Endcard-Video Design §8.3/§8.4 — the video end-card treatment. L2 covers the
// mode toggle and its conditional controls; L3 renders real MP4s, once with a
// long source (trim window) and once with a 2s source (the always-on loop
// filling the 3s card, D-01).
import {execFile} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import {expect, test, type Page} from '@playwright/test';
import {switchTemplate} from './helpers/template';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);
const outputDirectory = resolve(projectRoot, 'artifacts/endcard-video');

const PANEL_A_SOURCE = fixture('gameplay-sample.mp4');
const PANEL_B_SOURCE = fixture('day1-panel-b.mp4');
/** 12s portrait source — long enough that the 3s window actually trims. */
const ENDCARD_LONG = fixture('day1-panel-b.mp4');
/** 2s source from scripts/generate-editor-fixture.mjs — the loop path (D-06). */
const ENDCARD_SHORT = fixture('endcard-2s.mp4');

const RENDER_TIMEOUT = 10 * 60 * 1000;

const selectDay1 = async (page: Page) => {
  await switchTemplate(page, 'day1');
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

/** Mean luma of the centre crop — near 0 means the card rendered black. */
const centerLumaAt = async (filePath: string, seconds: number) => {
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
      'crop=400:400:340:760,scale=1:1',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-',
    ],
    {encoding: 'buffer'},
  );
  const [r, g, b] = [stdout[0] as number, stdout[1] as number, stdout[2] as number];

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const probeDuration = async (filePath: string) => {
  const {stdout} = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    filePath,
  ]);

  return Number(stdout);
};

test.describe('end-card video mode — inspector', () => {
  test.use({actionTimeout: 20_000});

  test('toggles between the two treatments without losing either (L2 #1-2/#5)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectDay1(page);
    await page.getByTestId('section-day1-endcard').click();

    // Banner mode is the default with its existing controls.
    await expect(page.getByTestId('day1-endcard-mode-banner')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('day1-endcard-banner')).toBeAttached();
    await expect(page.getByTestId('day1-icon-animation-pop')).toBeVisible();

    // Switch to video: banner controls give way to the video ones; the shared
    // card motion stays.
    await page.getByTestId('day1-endcard-mode-video').click();
    await expect(page.getByTestId('day1-endcard-video-missing')).toBeVisible();
    await expect(page.getByTestId('day1-endcard-video')).toBeAttached();
    await expect(page.getByTestId('day1-endcard-banner')).toHaveCount(0);
    await expect(page.getByTestId('day1-icon-animation-pop')).toHaveCount(0);
    await expect(page.getByTestId('day1-icon-dx')).toHaveCount(0);
    await expect(page.getByTestId('day1-card-motion-fade')).toBeVisible();

    // And back — the banner side returns untouched (SC1).
    await page.getByTestId('day1-endcard-mode-banner').click();
    await expect(page.getByTestId('day1-endcard-banner')).toBeAttached();
    await expect(page.getByTestId('day1-endcard-video')).toHaveCount(0);
  });

  test('shows the loop note only for a source shorter than the card (L2 #3-4)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectDay1(page);
    await openEndCardInVideoMode(page);

    await page.getByTestId('day1-endcard-video').setInputFiles(ENDCARD_LONG);
    await expect(page.getByTestId('day1-endcard-video-missing')).toHaveCount(0);
    await expect(page.getByTestId('day1-endcard-loop-note')).toHaveCount(0);

    await page.getByTestId('day1-endcard-video').setInputFiles(ENDCARD_SHORT);
    await expect(page.getByTestId('day1-endcard-loop-note')).toBeVisible();
  });
});

test.describe('end-card video mode — render', () => {
  test.setTimeout(15 * 60 * 1000);
  test.use({actionTimeout: 20_000});

  test('renders the video end card through the trim window (L3 #1 / SC3)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectDay1(page);
    await uploadPanels(page);
    await openEndCardInVideoMode(page);
    await page.getByTestId('day1-endcard-video').setInputFiles(ENDCARD_LONG);

    const outputPath = await renderAndSave(page, 'endcard-video-long.mp4');

    expect(await probeDuration(outputPath)).toBeGreaterThan(14.5);
    expect(await probeDuration(outputPath)).toBeLessThan(15.6);
    // The end card occupies 12s..15s; a black frame there means the video
    // never reached the composition.
    expect(await centerLumaAt(outputPath, 13.5)).toBeGreaterThan(16);
  });

  test('loops a 2s source to fill the 3s card (L3 #2 / SC4)', async ({page}) => {
    await page.goto('/');
    await selectDay1(page);
    await uploadPanels(page);
    await openEndCardInVideoMode(page);
    await page.getByTestId('day1-endcard-video').setInputFiles(ENDCARD_SHORT);
    await expect(page.getByTestId('day1-endcard-loop-note')).toBeVisible();

    const outputPath = await renderAndSave(page, 'endcard-video-loop.mp4');

    expect(await probeDuration(outputPath)).toBeGreaterThan(14.5);
    // 12s + 2s source = 14s is where an unlooped card would go black; sample
    // past it to prove the loop filled the remainder (D-01).
    expect(await centerLumaAt(outputPath, 14.5)).toBeGreaterThan(16);
  });
});
