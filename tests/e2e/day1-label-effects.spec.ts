// day1-label-effects Plan SC4/SC5 — the two label effects through the real
// editor: the controls appear only while their toggle is on (L2), and the
// effects reach the MP4 (L3).
//
// L3 needs the `chrome` channel the root config pins: the fixtures are H.264
// and the output is H.264, neither of which open-source Chromium builds carry.
//
// The two rendered cases prove each other's negative: the box render carries no
// green-dominant pixel because its glow is off, and the glow render carries no
// plate pixel because its box is off. That is what pins "default off changes
// nothing" to the output rather than to the schema alone.
import {mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';

import {ensureTemplate, switchTemplate} from './helpers/template';
import {hexToRgb, sampleRegion, type Rgb} from './helpers/videoSampling';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);
const outputDirectory = resolve(projectRoot, 'artifacts/day1-label-effects');

const PANEL_A_SOURCE = fixture('gameplay-sample.mp4');
const PANEL_B_SOURCE = fixture('day1-panel-b.mp4');

const RENDER_TIMEOUT = 10 * 60 * 1000;

/** Neither fixture palette holds it, so a match in the output is the plate. */
const BOX_HEX = '#ff00ff';
const GLOW_HEX = '#00ff00';
/** Yellow is dominant in neither the plate (magenta) nor the glyph glow. */
const BOX_GLOW_HEX = '#ffff00';

/**
 * The whole 9:16 frame, deliberately: counting effect pixels anywhere beats
 * guessing where the label's box lands, which depends on the system font's
 * metrics. At 0.5s panel A is live on `#e6194b` and panel B is frozen in
 * greyscale, so neither the plate colour nor a green-dominant pixel can come
 * from the footage.
 */
const FRAME = {x: 0, y: 0, width: 1080, height: 1920};
const SAMPLE_SECONDS = 0.5;

/**
 * A 72px label is at least ~250x130px of plate, so five thousand pixels is a
 * tenth of the smallest plate the default style can draw — far above chroma
 * noise, far below what an actually-rendered effect produces.
 */
const EFFECT_PIXELS = 5_000;
const GLOW_PIXELS = 2_000;

/** Loose enough for 4:2:0 chroma on a saturated fill, tight enough to exclude
    the fixture palettes, the white glyph, and the black outline. */
const PLATE_TOLERANCE = 40;
const DOMINANCE = 40;

const countNear = (pixels: Rgb[], hex: string) => {
  const target = hexToRgb(hex);

  return pixels.filter((pixel) =>
    pixel.every(
      (channel, index) =>
        Math.abs(channel - (target[index] as number)) <= PLATE_TOLERANCE,
    ),
  ).length;
};

const countGreenDominant = (pixels: Rgb[]) =>
  pixels.filter(([r, g, b]) => g > r + DOMINANCE && g > b + DOMINANCE).length;

/** FR-07 — the plate's halo. Magenta and white both fail this test. */
const countYellowDominant = (pixels: Rgb[]) =>
  pixels.filter(([r, g, b]) => r > b + DOMINANCE && g > b + DOMINANCE).length;

const openDay1WithLabel = async (page: Page) => {
  await page.goto('/');
  await ensureTemplate(page, 'day1');
  // Each upload probes its source; the quad spec learned the hard way that a
  // second `setInputFiles` before the first has landed loses one of them.
  await page.getByTestId('day1-panel-a-input').setInputFiles(PANEL_A_SOURCE);
  await expect(page.getByTestId('day1-panel-a-metadata')).toContainText(
    '1920×1080',
    {timeout: 30_000},
  );
  await page.getByTestId('day1-panel-b-input').setInputFiles(PANEL_B_SOURCE);
  await expect(page.getByTestId('day1-panel-b-metadata')).toContainText(
    '1080×1920',
    {timeout: 30_000},
  );
  await expect(page.getByTestId('day1-panels-blocker')).toHaveCount(0, {
    timeout: 30_000,
  });
  await page.getByTestId('section-day1-label').click();
  await page.getByTestId('day1-label-ko-a').fill('DAY 1');
};

const renderAndSample = async (page: Page, fileName: string) => {
  const downloadPromise = page.waitForEvent('download', {
    timeout: RENDER_TIMEOUT,
  });

  await page.getByRole('button', {name: 'MP4 렌더'}).click();
  await expect(page.getByTestId('editor-render-status')).toContainText('완료', {
    timeout: RENDER_TIMEOUT,
  });
  await page.getByRole('button', {name: '다운로드'}).click();

  const download = await downloadPromise;

  await mkdir(outputDirectory, {recursive: true});

  const outputPath = resolve(outputDirectory, fileName);

  await download.saveAs(outputPath);

  return sampleRegion(outputPath, SAMPLE_SECONDS, FRAME);
};

test.describe('day1-label-effects — inspector (L2)', () => {
  test.use({actionTimeout: 30_000});

  test('reveals each effect’s settings only while its toggle is on (SC4)', async ({
    page,
  }) => {
    await page.goto('/');
    await ensureTemplate(page, 'day1');
    await page.getByTestId('section-day1-label').click();

    // FR-01/FR-03 — both effects start off, so neither carries settings yet.
    await expect(page.getByTestId('day1-label-background')).not.toBeChecked();
    await expect(page.getByTestId('day1-label-glow')).not.toBeChecked();
    await expect(page.getByTestId('day1-label-background-color')).toHaveCount(0);
    await expect(page.getByTestId('day1-label-glow-color')).toHaveCount(0);

    await page.getByTestId('day1-label-background').check();

    await expect(page.getByTestId('day1-label-background-color')).toBeVisible();
    await expect(
      page.getByTestId('day1-label-background-opacity-number'),
    ).toHaveValue('60');
    // Q4 — the effects are independent, so the box does not pull the glow in.
    await expect(page.getByTestId('day1-label-glow-color')).toHaveCount(0);

    // FR-07/FR-08 — the plate's own halo lives under the plate, off by default,
    // and reveals its own colour and radius rather than the lettering's.
    await expect(page.getByTestId('day1-label-box-glow')).not.toBeChecked();
    await expect(page.getByTestId('day1-label-box-glow-color')).toHaveCount(0);

    await page.getByTestId('day1-label-box-glow').check();

    await expect(page.getByTestId('day1-label-box-glow-color')).toBeVisible();
    await expect(
      page.getByTestId('day1-label-box-glow-strength-number'),
    ).toHaveValue('16');
    await expect(page.getByTestId('day1-label-glow-color')).toHaveCount(0);

    await page.getByTestId('day1-label-glow').check();

    await expect(page.getByTestId('day1-label-glow-color')).toBeVisible();
    await expect(
      page.getByTestId('day1-label-glow-strength-number'),
    ).toHaveValue('16');

    await page.getByTestId('day1-label-background').uncheck();

    await expect(page.getByTestId('day1-label-background-color')).toHaveCount(0);
    // The plate's halo is a plate setting, so it hides with the plate.
    await expect(page.getByTestId('day1-label-box-glow')).toHaveCount(0);
    await expect(page.getByTestId('day1-label-glow-color')).toBeVisible();
  });

  test('offers the same two effects on the four-panel template (FR-05)', async ({
    page,
  }) => {
    await page.goto('/');
    await switchTemplate(page, 'day1-quad');
    await page.getByTestId('section-day1-label').click();

    await page.getByTestId('day1-label-background').check();
    await page.getByTestId('day1-label-box-glow').check();
    await page.getByTestId('day1-label-glow').check();

    await expect(page.getByTestId('day1-label-background-color')).toBeVisible();
    await expect(page.getByTestId('day1-label-box-glow-strength')).toBeVisible();
    await expect(page.getByTestId('day1-label-glow-strength')).toBeVisible();
  });
});

test.describe('day1-label-effects — render (L3)', () => {
  test.use({actionTimeout: 30_000});
  test.setTimeout(15 * 60 * 1000);

  test('bakes the plate into the MP4 and leaves the glow out (SC5)', async ({
    page,
  }) => {
    await openDay1WithLabel(page);

    await page.getByTestId('day1-label-background').check();
    await page.getByTestId('day1-label-background-color').fill(BOX_HEX);
    await page.getByTestId('day1-label-background-opacity-number').fill('100');
    // FR-07 — the plate's halo rides out on the same render.
    await page.getByTestId('day1-label-box-glow').check();
    await page.getByTestId('day1-label-box-glow-color').fill(BOX_GLOW_HEX);
    await page.getByTestId('day1-label-box-glow-strength-number').fill('32');

    const frame = await renderAndSample(page, 'label-box.mp4');

    expect(countNear(frame, BOX_HEX)).toBeGreaterThan(EFFECT_PIXELS);
    expect(countYellowDominant(frame)).toBeGreaterThan(GLOW_PIXELS);
    // FR-06 — the glyph glow stayed off, so no letter in the frame glows.
    expect(countGreenDominant(frame)).toBeLessThan(GLOW_PIXELS);
  });

  test('bakes the glow into the MP4 and leaves the plate out (SC5)', async ({
    page,
  }) => {
    await openDay1WithLabel(page);

    await page.getByTestId('day1-label-glow').check();
    await page.getByTestId('day1-label-glow-color').fill(GLOW_HEX);
    await page.getByTestId('day1-label-glow-strength-number').fill('32');

    // FR-07 — switch the plate's halo on and then take the plate away. The
    // setting stays stored, and the render must show no halo at all.
    await page.getByTestId('day1-label-background').check();
    await page.getByTestId('day1-label-box-glow').check();
    await page.getByTestId('day1-label-box-glow-color').fill(BOX_GLOW_HEX);
    await page.getByTestId('day1-label-background').uncheck();

    const frame = await renderAndSample(page, 'label-glow.mp4');

    expect(countGreenDominant(frame)).toBeGreaterThan(GLOW_PIXELS);
    // FR-06 — the box stayed off, so there is no plate anywhere.
    expect(countNear(frame, BOX_HEX)).toBeLessThan(EFFECT_PIXELS);
    expect(countYellowDominant(frame)).toBeLessThan(GLOW_PIXELS);
  });
});
