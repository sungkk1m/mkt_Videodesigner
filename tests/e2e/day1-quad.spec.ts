// day1-quad Plan SC1–SC4 — the four-panel template through the real editor: the
// five-section axis, the narrowed presets, four uploads, and a real MP4 whose
// pixels carry the 2x2 grid, the cross divider, and the greyscale idle panels.
//
// The Day1 equivalents live in day1-template.spec.ts; this file asserts only what
// the four-panel path adds.
import {mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';

import {chooseTemplate, switchTemplate} from './helpers/template';
import {
  CHANNEL_TOLERANCE,
  hexToRgb,
  meanRgb,
  meanSaturation,
  probeVideo,
  sampleRegion,
} from './helpers/videoSampling';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);
const outputDirectory = resolve(projectRoot, 'artifacts/day1-quad');

/**
 * Four distinct sources: Remotion's video cache keys on src, so reusing one file
 * would share a decoder and hide a per-panel bug. Two of the three fixtures are
 * reused for panels C and D, which is enough for the pixel checks below because
 * only panel A's colour is asserted.
 */
const PANEL_SOURCES = [
  fixture('gameplay-sample.mp4'),
  fixture('day1-panel-b.mp4'),
  fixture('endcard-2s.mp4'),
  fixture('day1-panel-b.mp4'),
];

const PANEL_LETTERS = ['a', 'b', 'c', 'd'] as const;

/** Not in any fixture palette, so a match in the output is the divider. */
const DIVIDER_HEX = '#ff00ff';

const selectQuad = async (page: Page) => {
  await switchTemplate(page, 'day1-quad');
  await expect(page.getByTestId('inspector-template')).toHaveText(
    'Day1(4 video)',
  );
};

const uploadFourPanels = async (page: Page) => {
  for (const [index, letter] of PANEL_LETTERS.entries()) {
    await page
      .getByTestId(`day1-panel-${letter}-input`)
      .setInputFiles(PANEL_SOURCES[index] as string);
    // Each upload probes its source, so give the previous one time to land
    // before the next: `retain` releases object URLs the project no longer
    // references, and a half-applied upload would look like a missing panel.
    await expect(
      page.getByTestId(`day1-panel-${letter}-metadata`),
    ).toContainText('초', {timeout: 30_000});
  }

  await expect(page.getByTestId('day1-panels-blocker')).toHaveCount(0, {
    timeout: 30_000,
  });
};

test.describe('day1-quad — the four-panel template', () => {
  test.use({actionTimeout: 30_000});

  test('opens a five-section axis with the presets narrowed (FR-Q01/Q14)', async ({
    page,
  }) => {
    await page.goto('/');

    // Plan Q8a — a 60s project is coerced, and the dialog says so first.
    await page.getByRole('button', {name: '60초'}).click();
    await chooseTemplate(page, 'day1-quad');
    await expect(
      page.getByTestId('template-switch-preset-note'),
    ).toBeVisible();
    await page.getByTestId('template-switch-confirm').click();

    for (const id of ['panel-a', 'panel-b', 'panel-c', 'panel-d', 'endcard']) {
      await expect(page.getByTestId(`timeline-clip-${id}`)).toBeVisible();
    }

    await expect(page.getByRole('button', {name: '30초'})).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', {name: '60초'})).toHaveCount(0);

    // Four inspector panel sections, and four label inputs per locale (Q9).
    for (const letter of PANEL_LETTERS) {
      await expect(
        page.getByTestId(`section-day1-panel-${letter}`),
      ).toBeVisible();
      await expect(page.getByTestId(`day1-label-ko-${letter}`)).toHaveValue(
        /Day\d/,
      );
    }
  });

  test('renders a real MP4 carrying the grid, the divider, and the greyscale (SC1–SC4)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectQuad(page);
    await uploadFourPanels(page);

    // Plan SC4 — a divider colour that no fixture frame contains, so finding it
    // in the output is unambiguous.
    await page.getByTestId('day1-split-color').fill(DIVIDER_HEX);

    const downloadPromise = page.waitForEvent('download', {timeout: 600_000});

    await page.getByRole('button', {name: 'MP4 렌더'}).click();
    await expect(page.getByTestId('editor-render-status')).toContainText(
      '완료',
      {timeout: 600_000},
    );
    await page.getByRole('button', {name: '다운로드'}).click();

    const download = await downloadPromise;

    // Plan Q12 — the template segment separates a quad output from a Day1 one.
    expect(download.suggestedFilename()).toBe(
      'ua-video_day1x4_ko_9x16_15s_30fps.mp4',
    );

    await mkdir(outputDirectory, {recursive: true});

    const outputPath = resolve(outputDirectory, 'quad-9x16.mp4');

    await download.saveAs(outputPath);

    const probe = await probeVideo(outputPath);
    const video = probe.streams.find(
      (stream) => stream.codec_type === 'video',
    );

    expect(video?.width).toBe(1080);
    expect(video?.height).toBe(1920);

    // Half a second in, panel A is live. Design §5.1 puts the 9:16 cells at
    // 537x957 with a 6px cross, so these squares sit well inside each cell and
    // clear of the divider.
    const cellSample = async (x: number, y: number) =>
      sampleRegion(outputPath, 0.5, {x, y, width: 80, height: 80});

    const [a, b, c, d] = await Promise.all([
      cellSample(230, 440),
      cellSample(773, 440),
      cellSample(230, 1403),
      cellSample(773, 1403),
    ]);

    // Plan SC3 / Q2 — one panel live in colour, the other three desaturated.
    expect(meanSaturation(a as never)).toBeGreaterThan(0.25);
    for (const idle of [b, c, d]) {
      expect(meanSaturation(idle as never)).toBeLessThan(0.12);
    }

    // Plan SC4 — both bars of the cross render as the configured hex. Sampled
    // one pixel wide so no panel pixel can bleed into the average.
    const expected = hexToRgb(DIVIDER_HEX);
    const [vertical, horizontal] = await Promise.all([
      sampleRegion(outputPath, 0.5, {x: 538, y: 300, width: 2, height: 40}),
      sampleRegion(outputPath, 0.5, {x: 300, y: 958, width: 40, height: 2}),
    ]);

    for (const bar of [vertical, horizontal]) {
      const mean = meanRgb(bar as never);

      mean.forEach((channel, index) => {
        expect(Math.abs(channel - (expected[index] as number))).toBeLessThan(
          CHANNEL_TOLERANCE,
        );
      });
    }
  });

  test('leaves the two-panel template untouched (SC6)', async ({page}) => {
    // Day1 is the default template, so a new project already is the two-panel
    // one — there is nothing to switch to.
    await page.goto('/');

    await expect(page.getByTestId('inspector-template')).toHaveText('Day1 비교');
    await expect(page.getByTestId('section-day1-panel-a')).toBeVisible();
    await expect(page.getByTestId('section-day1-panel-c')).toHaveCount(0);
    await expect(page.getByRole('button', {name: '60초'})).toBeVisible();
  });
});
