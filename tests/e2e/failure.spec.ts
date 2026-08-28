// failure-video Design §8.2 / Plan SC1–SC6 — the failure template through the
// real editor: the four-section axis with its narrowed presets and ratios, the
// orientation-bound uploads, and a real MP4 whose pixels carry the FAIL stamp,
// the colour drain, the punch transition, and the three caption bars.
//
// The parts that are not failure-specific (trim, the end card, the split-frame
// panel) live in their own specs; this file asserts only what this template adds.
//
// The render test needs an H.264 encoder *and* decoder. Neither exists in the
// project's container image, so there it is an environment failure rather than a
// code one — the same split day1-quad reported (docs/04-report/day1-quad.report.md).
import {mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';

import {chooseTemplate, switchTemplate} from './helpers/template';
import {
  hexToRgb,
  meanRgb,
  meanSaturation,
  probeVideo,
  sampleRegion,
  saturation,
} from './helpers/videoSampling';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);
const outputDirectory = resolve(projectRoot, 'artifacts/failure');

/**
 * Three distinct sources: Remotion's video cache keys on `src`, so reusing one
 * file would share a decoder and hide a per-segment bug.
 */
const SEGMENT_SOURCES = [
  fixture('gameplay-sample.mp4'),
  fixture('day1-panel-b.mp4'),
  fixture('endcard-2s.mp4'),
];

const SEGMENT_LETTERS = ['a', 'b', 'c'] as const;

/** The 30s preset's own split (Design §6.1), in seconds. */
const LEVEL_ONE_END = 5.4;
const LEVEL_TWO_END = 8.1;

const selectFailure = async (page: Page) => {
  await switchTemplate(page, 'failure');
  await expect(page.getByTestId('inspector-template')).toHaveText('실패(FAIL)');
};

const uploadSegments = async (page: Page) => {
  for (const [index, letter] of SEGMENT_LETTERS.entries()) {
    await page
      .getByTestId(`failure-asset-${letter}-input`)
      .setInputFiles(SEGMENT_SOURCES[index] as string);
    // Each upload probes its source, so let the previous one land before the
    // next: `retain` releases object URLs the project no longer references, and
    // a half-applied upload would look like a missing segment.
    await expect(
      page.getByTestId(`failure-asset-${letter}-metadata`),
    ).toContainText('초', {timeout: 30_000});
  }

  await expect(page.getByTestId('failure-render-blocker')).toHaveCount(0, {
    timeout: 30_000,
  });
};

test.describe('failure — the growth-story template', () => {
  test.use({actionTimeout: 30_000});

  test('opens a four-section axis with the presets and ratios narrowed (FR-01/08/09)', async ({
    page,
  }) => {
    await page.goto('/');

    // Plan Q4 — a 15s project is coerced, and the dialog says so first, next to
    // the note about the ratios (Q2).
    await chooseTemplate(page, 'failure');
    await expect(page.getByTestId('template-switch-preset-note')).toBeVisible();
    await expect(
      page.getByTestId('template-switch-failure-ratio-note'),
    ).toBeVisible();
    await page.getByTestId('template-switch-confirm').click();

    for (const id of ['panel-a', 'panel-b', 'panel-c', 'endcard']) {
      await expect(page.getByTestId(`timeline-clip-${id}`)).toBeVisible();
    }
    // The clips are named by level, which is what the story is.
    await expect(page.getByTestId('timeline-clip-panel-a')).toContainText(
      '레벨 1',
    );

    await expect(page.getByRole('button', {name: '30초'})).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', {name: '15초'})).toHaveCount(0);
    await expect(page.getByRole('button', {name: '60초'})).toBeVisible();

    // Plan Q2 — 1:1 is not offered at all.
    await expect(page.getByTestId('ratio-1:1')).toBeDisabled();
    await expect(page.getByTestId('ratio-9:16')).toBeEnabled();
    await expect(page.getByTestId('ratio-16:9')).toBeEnabled();

    // Plan Q1 — three segments and three captions, prefilled in every locale.
    for (const letter of SEGMENT_LETTERS) {
      await expect(
        page.getByTestId(`section-failure-panel-${letter}`),
      ).toBeVisible();
      await expect(page.getByTestId(`failure-caption-ko-${letter}`)).toHaveValue(
        /LEVEL \d+/,
      );
    }
  });

  // D-1 — the preview ratio toggle *is* the orientation toggle, and there is no
  // fallback between the two source groups (Q2).
  test('binds the uploads to the orientation the ratio selects (FR-03)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectFailure(page);
    await uploadSegments(page);

    await expect(page.getByTestId('failure-ratio-orientation')).toHaveText(
      '세로 소재',
    );

    // Switching to 16:9 reveals an empty horizontal group, not the vertical one.
    await page.getByTestId('ratio-16:9').click();
    await expect(page.getByTestId('failure-ratio-orientation')).toHaveText(
      '가로 소재',
    );
    await expect(page.getByTestId('failure-asset-a-metadata')).toHaveCount(0);
    await expect(page.getByTestId('failure-render-blocker')).toContainText(
      '가로용 영상 3개',
    );

    // And switching back finds the vertical uploads where they were left.
    await page.getByTestId('ratio-9:16').click();
    await expect(page.getByTestId('failure-asset-a-metadata')).toContainText(
      '초',
    );
    await expect(page.getByTestId('failure-render-blocker')).toHaveCount(0);
  });

  // §7.5 — the batch preflight names the group, because "3 more videos" with the
  // other group full is exactly the confusing case.
  test('blocks a 16:9 batch that has no horizontal footage (Q2)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectFailure(page);
    await uploadSegments(page);

    await page.getByTestId('open-batch').click();
    await page.getByTestId('batch-ratio-16:9').click();
    await page.getByTestId('batch-start').click();

    await expect(page.getByTestId('batch-preflight')).toContainText(
      '가로(16:9)용 영상',
    );
  });

  test('renders a real MP4 carrying the beat, the transition, and the bars (SC2–SC5)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectFailure(page);
    await uploadSegments(page);

    const downloadPromise = page.waitForEvent('download', {timeout: 600_000});

    await page.getByRole('button', {name: 'MP4 렌더'}).click();
    await expect(page.getByTestId('editor-render-status')).toContainText('완료', {
      timeout: 600_000,
    });
    await page.getByRole('button', {name: '다운로드'}).click();

    const download = await downloadPromise;

    // §4.2 — the template segment separates this output from every other one.
    expect(download.suggestedFilename()).toBe(
      'ua-video_fail_ko_9x16_30s_30fps.mp4',
    );

    await mkdir(outputDirectory, {recursive: true});

    const outputPath = resolve(outputDirectory, 'failure-9x16.mp4');

    await download.saveAs(outputPath);

    const probe = await probeVideo(outputPath);
    const video = probe.streams.find((stream) => stream.codec_type === 'video');

    expect(video?.width).toBe(1080);
    expect(video?.height).toBe(1920);
    expect(Number(probe.format.duration)).toBeCloseTo(30, 0);

    // --- SC4: the caption bar, on all three segments ------------------------
    // §6.5 — the bar is the bottom 10% (y 1728-1920). Sampled clear of the
    // glyphs so the average is the bar's own colour.
    const barSample = (seconds: number) =>
      sampleRegion(outputPath, seconds, {
        x: 20,
        y: 1780,
        width: 60,
        height: 60,
      });
    // The glyph band, where the white text lives.
    const textSample = (seconds: number) =>
      sampleRegion(outputPath, seconds, {
        x: 300,
        y: 1790,
        width: 480,
        height: 90,
      });

    for (const seconds of [1, 6.5, 12]) {
      const bar = meanRgb((await barSample(seconds)) as never);

      // A black bar: every channel near zero.
      bar.forEach((channel) => expect(channel).toBeLessThan(24));
    }

    // The three captions differ, so the glyph band's coverage differs with them.
    // `LEVEL 1` is the shortest word and `LEVEL 99` the longest.
    const whiteRatio = async (seconds: number) => {
      const pixels = await textSample(seconds);

      return (
        pixels.filter(([r, g, b]) => r > 200 && g > 200 && b > 200).length /
        pixels.length
      );
    };
    const [one, twenty, ninetyNine] = await Promise.all([
      whiteRatio(1),
      whiteRatio(6.5),
      whiteRatio(12),
    ]);

    for (const ratio of [one, twenty, ninetyNine]) {
      expect(ratio).toBeGreaterThan(0.02);
    }
    expect(ninetyNine).toBeGreaterThan(one);

    // --- SC2: the FAIL beat, in the last second of level 1 -------------------
    // §6.2 — the stamp is on screen for the last 1.0s (4.4s-5.4s), settled by
    // ~4.65s. Sampled in the band §6.4 puts it in (15-55% of the height).
    const stampBand = await sampleRegion(outputPath, 5.0, {
      x: 0,
      y: 300,
      width: 1080,
      height: 700,
    });
    const stampRed = hexToRgb('#c8102e');
    const redPixels = stampBand.filter(
      ([r, g, b]) =>
        r > 120 &&
        r - g > 60 &&
        r - b > 40 &&
        Math.abs(r - (stampRed[0] as number)) < 90,
    );

    expect(redPixels.length / stampBand.length).toBeGreaterThan(0.02);

    // The same frame's footage is drained (§6.2 desaturate). Sampled from the
    // video band well away from the stamp's own colour.
    const drained = await sampleRegion(outputPath, 5.0, {
      x: 40,
      y: 1400,
      width: 200,
      height: 200,
    });

    expect(meanSaturation(drained as never)).toBeLessThan(0.12);

    // And a frame before the beat opens is in full colour, so the drain is the
    // effect and not the source.
    const coloured = await sampleRegion(outputPath, 1.5, {
      x: 40,
      y: 1400,
      width: 200,
      height: 200,
    });

    expect(meanSaturation(coloured as never)).toBeGreaterThan(0.25);

    // No stamp at all a second earlier — it is a beat, not a watermark.
    const beforeBeat = await sampleRegion(outputPath, 2.0, {
      x: 0,
      y: 300,
      width: 1080,
      height: 700,
    });

    expect(
      beforeBeat.filter(([r, g, b]) => r > 120 && r - g > 60 && r - b > 40)
        .length / beforeBeat.length,
    ).toBeLessThan(0.01);

    // --- SC3: the punch transition ------------------------------------------
    // §6.2 — the outgoing frame is scaled 2x over the last 0.25s, which lifts
    // the caption bar's top edge off its resting row. At rest the row at y=1700
    // is footage and the row at y=1750 is bar; at full zoom the bar has been
    // scaled past both.
    const edgeAt = async (seconds: number) => {
      const pixels = await sampleRegion(outputPath, seconds, {
        x: 500,
        y: 1750,
        width: 80,
        height: 20,
      });

      return meanRgb(pixels as never);
    };

    const resting = await edgeAt(LEVEL_ONE_END - 1);
    const punched = await edgeAt(LEVEL_ONE_END - 0.02);

    // At rest this is the black bar; mid-punch it is anything but.
    resting.forEach((channel) => expect(channel).toBeLessThan(24));
    expect(Math.max(...punched)).toBeGreaterThan(40);

    // The incoming frame settles back: 0.4s into level 2 the bar is home again.
    const settled = await edgeAt(LEVEL_ONE_END + 0.5);

    settled.forEach((channel) => expect(channel).toBeLessThan(24));

    // --- SC5: the end card ---------------------------------------------------
    // The last 3s are the end card, which has no caption bar over it: with no
    // banner uploaded the frame is the canvas colour end to end.
    const endCard = await sampleRegion(outputPath, 28.5, {
      x: 400,
      y: 1800,
      width: 200,
      height: 80,
    });

    expect(saturation(meanRgb(endCard as never))).toBeLessThan(0.2);
    // Level 3's own frame, a second earlier, still carries its bar.
    const beforeEndCard = meanRgb((await barSample(26)) as never);

    beforeEndCard.forEach((channel) => expect(channel).toBeLessThan(24));
    expect(LEVEL_TWO_END).toBeLessThan(28.5);
  });

  test('leaves the other templates untouched (SC6)', async ({page}) => {
    await page.goto('/');
    await switchTemplate(page, 'day1');

    await expect(page.getByTestId('inspector-template')).toHaveText('Day1 비교');
    await expect(page.getByTestId('section-day1-panel-a')).toBeVisible();
    await expect(page.getByTestId('section-failure-panel-a')).toHaveCount(0);
    await expect(page.getByRole('button', {name: '15초'})).toBeVisible();
    await expect(page.getByTestId('ratio-1:1')).toBeEnabled();
  });
});
