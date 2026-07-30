// Module 6 verification: the Day1 template rendered through the real browser
// render path, measured on the output MP4 rather than on the preview DOM.
//
// Day1 Design Ref: §8.2 Test Plan. Plan SC1 (three ratios), SC2 (grayscale),
// SC4 (split line colour), SC5 (icon overlay within 2px), SC3 (three-scene
// regression), FR-D03 (both panels required), FR-D14 (Batch reuse).
//
// Sources are the generated colour-per-second fixtures, so a sampled pixel says
// both *which source second* is on screen and *whether it was desaturated*.
// Run `npm run generate:editor-fixture` first.
import {execFile} from 'node:child_process';
import {mkdir, readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import {expect, test, type Page} from '@playwright/test';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);
const outputDirectory = resolve(projectRoot, 'artifacts/module-6');

const PANEL_A_SOURCE = fixture('gameplay-sample.mp4');
const PANEL_B_SOURCE = fixture('day1-panel-b.mp4');
const BANNER = fixture('day1-endcard-banner.png');
const APP_ICON = fixture('day1-app-icon.png');

const RENDER_TIMEOUT = 8 * 60 * 1000;

// Day1 Design Ref: §4.2 — a 15s preset is [6s panel A, 6s panel B, 3s end card].
const SECTION_A_SAMPLE_SECONDS = 3;
const SECTION_B_SAMPLE_SECONDS = 9;
const END_CARD_SAMPLE_SECONDS = 13;

/** A wide divider makes the SC4 pixel sample immune to chroma subsampling. */
const SPLIT_WIDTH_PX = 24;
const SPLIT_COLOR = '#38bdf8';

type Rgb = [number, number, number];

const hexToRgb = (hex: string): Rgb => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

const saturation = ([r, g, b]: Rgb) =>
  Math.max(r, g, b) - Math.min(r, g, b);

/**
 * Grey level of a source's own first frame, read from its luma plane.
 *
 * Measured rather than computed: Chrome's `grayscale(1)` over a `<Video>` lands
 * on the video's BT.601 luma, not the BT.709 matrix the CSS filter spec lists for
 * RGB content. Deriving the expected value from the source itself keeps the
 * assertion about *which frame is frozen* instead of about colour-space
 * coefficients.
 */
const sourceFirstFrameGray = async (sourcePath: string) => {
  const {stdout} = await execFileAsync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      sourcePath,
      '-frames:v',
      '1',
      '-vf',
      'format=gray,crop=64:64',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'gray',
      '-',
    ],
    {encoding: 'buffer'},
  );

  let total = 0;

  for (const value of stdout) {
    total += value;
  }

  return total / stdout.length;
};

/**
 * Which source second a sampled pixel came from, by nearest palette entry. The
 * same trick the module-3a spec uses: absolute channel values drift under 4:2:0
 * on saturated colours, but the *nearest* palette entry stays unambiguous, and it
 * asserts the stronger claim — which frame of which source is on screen.
 */
const nearestPaletteIndex = (pixel: Rgb, palette: readonly string[]) => {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  palette.forEach((hex, index) => {
    const [r, g, b] = hexToRgb(hex);
    const distance =
      (r - pixel[0]) ** 2 + (g - pixel[1]) ** 2 + (b - pixel[2]) ** 2;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
};

/** Two H.264 generations plus 4:2:0 chroma leave this much drift on a flat fill. */
const CHANNEL_TOLERANCE = 10;

const expectChannelsNear = (actual: Rgb, expected: Rgb) => {
  for (const channel of [0, 1, 2] as const) {
    expect(Math.abs(actual[channel] - expected[channel])).toBeLessThanOrEqual(
      CHANNEL_TOLERANCE,
    );
  }
};

const probeVideo = async (filePath: string) => {
  const {stdout} = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=codec_name,codec_type,width,height',
    '-of',
    'json',
    filePath,
  ]);

  return JSON.parse(stdout) as {
    format: {duration: string};
    streams: {
      codec_name: string;
      codec_type: string;
      width?: number;
      height?: number;
    }[];
  };
};

/**
 * Every RGB pixel of one region of one output frame.
 *
 * Deliberately unscaled: asking ffmpeg to `scale` a crop down to a few samples
 * uses bilinear taps that reach outside the crop, which silently mixes the
 * divider with the panels either side of it. Averaging here instead keeps the
 * region boundaries exact.
 */
const sampleRegion = async (
  filePath: string,
  seconds: number,
  crop: {x: number; y: number; width: number; height: number},
): Promise<Rgb[]> => {
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
      `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`,
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-',
    ],
    {encoding: 'buffer', maxBuffer: 64 * 1024 * 1024},
  );

  const pixels: Rgb[] = [];

  for (let index = 0; index + 2 < stdout.length; index += 3) {
    pixels.push([
      stdout[index] as number,
      stdout[index + 1] as number,
      stdout[index + 2] as number,
    ]);
  }

  return pixels;
};

const meanRgb = (pixels: Rgb[]): Rgb => [0, 1, 2].map(
  (channel) =>
    pixels.reduce((sum, pixel) => sum + (pixel[channel] as number), 0) /
    pixels.length,
) as Rgb;

const meanSaturation = (pixels: Rgb[]) =>
  pixels.reduce((sum, pixel) => sum + saturation(pixel), 0) / pixels.length;

/**
 * Bounding box of every pixel matching `colour`, in output pixels. Used for SC5:
 * the overlay's box *is* its placement, so this measures the 2px tolerance
 * directly instead of inferring it.
 */
const colorBoundingBox = async (
  filePath: string,
  seconds: number,
  color: Rgb,
  frameSize: {width: number; height: number},
  tolerance = 60,
) => {
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
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-',
    ],
    {encoding: 'buffer', maxBuffer: 256 * 1024 * 1024},
  );

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let matched = 0;

  for (let y = 0; y < frameSize.height; y += 1) {
    for (let x = 0; x < frameSize.width; x += 1) {
      const offset = (y * frameSize.width + x) * 3;
      const distance =
        Math.abs((stdout[offset] as number) - color[0]) +
        Math.abs((stdout[offset + 1] as number) - color[1]) +
        Math.abs((stdout[offset + 2] as number) - color[2]);

      if (distance <= tolerance) {
        matched += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return {minX, minY, maxX, maxY, matched};
};

/** Selects Day1 through the real confirmation dialog. */
const selectDay1 = async (page: Page) => {
  await page.getByTestId('template-day1').click();
  await page.getByTestId('template-switch-confirm').click();
  await expect(page.getByTestId('inspector-template')).toHaveText('Day1 비교');
};

const uploadPanels = async (page: Page) => {
  await page.getByTestId('day1-panel-a-input').setInputFiles(PANEL_A_SOURCE);
  await page.getByTestId('day1-panel-b-input').setInputFiles(PANEL_B_SOURCE);

  await expect(page.getByTestId('day1-panel-a-metadata')).toContainText(
    '1920×1080',
  );
  await expect(page.getByTestId('day1-panel-b-metadata')).toContainText(
    '1080×1920',
  );
  await expect(page.getByTestId('day1-panels-blocker')).toHaveCount(0);
};

/** The label and end card groups are collapsed by default (Design §6.3). */
const expandSection = async (page: Page, id: string) => {
  await page.getByTestId(`section-${id}`).click();
};

const uploadEndCard = async (page: Page) => {
  await expandSection(page, 'day1-endcard');
  await page.getByTestId('day1-endcard-banner').setInputFiles(BANNER);
  await page.getByTestId('day1-endcard-appIcon').setInputFiles(APP_ICON);
  await expect(page.getByTestId('day1-banner-missing')).toHaveCount(0);
};

/**
 * Renders the current project and saves the MP4. Returns the file path and the
 * wall-clock render time — Design §2.3 left "re-measure with two *different*
 * sources" open, and this is where the number comes from.
 */
const renderAndSave = async (page: Page, fileName: string) => {
  const downloadPromise = page.waitForEvent('download', {
    timeout: RENDER_TIMEOUT,
  });
  const startedAt = Date.now();

  await page.getByRole('button', {name: 'MP4 렌더'}).click();

  // The status text survives a completed render, so it cannot tell this render
  // from the previous one. `open-batch` mirrors `isRendering`, so its disabled ->
  // enabled edge is an unambiguous per-render signal.
  await expect(page.getByTestId('open-batch')).toBeDisabled();
  await expect(page.getByTestId('open-batch')).toBeEnabled({
    timeout: RENDER_TIMEOUT,
  });
  await expect(page.getByTestId('editor-render-status')).toContainText('완료');

  const renderMs = Date.now() - startedAt;

  await page.getByRole('button', {name: '다운로드'}).click();

  const download = await downloadPromise;

  await mkdir(outputDirectory, {recursive: true});

  const outputPath = resolve(outputDirectory, fileName);

  await download.saveAs(outputPath);

  return {outputPath, renderMs, suggestedFilename: download.suggestedFilename()};
};

test.describe('module-6 Day1 render integration', () => {
  test.setTimeout(20 * 60 * 1000);
  // The long test timeout above exists for the real renders. Without a bounded
  // action timeout a mistyped locator would sit on it instead of failing.
  test.use({actionTimeout: 20_000});

  // Plan SC1 — a real MP4 in every output ratio, plus the Design §2.3 timing.
  test('renders all three ratios from two different sources', async ({page}) => {
    await page.goto('/');
    await selectDay1(page);
    await uploadPanels(page);
    await uploadEndCard(page);

    const expected = {
      '1:1': {width: 1080, height: 1080, file: '1x1'},
      '9:16': {width: 1080, height: 1920, file: '9x16'},
      '16:9': {width: 1920, height: 1080, file: '16x9'},
    } as const;
    const timings: string[] = [];

    for (const [ratio, spec] of Object.entries(expected)) {
      await page.getByTestId(`ratio-${ratio}`).click();
      await expect(page.getByTestId('output-size')).toHaveText(
        `${spec.width}×${spec.height}`,
      );

      const {outputPath, renderMs, suggestedFilename} = await renderAndSave(
        page,
        `day1-${spec.file}.mp4`,
      );

      expect(suggestedFilename).toBe(
        `ua-video_ko_${spec.file}_15s_60fps.mp4`,
      );

      const probe = await probeVideo(outputPath);
      const video = probe.streams.find(
        (stream) => stream.codec_type === 'video',
      );

      expect(video).toMatchObject({
        codec_name: 'h264',
        width: spec.width,
        height: spec.height,
      });
      expect(probe.streams.some((s) => s.codec_name === 'aac')).toBe(true);
      expect(Number(probe.format.duration)).toBeGreaterThan(14.5);
      expect(Number(probe.format.duration)).toBeLessThan(15.6);

      timings.push(`${ratio}: ${(renderMs / 1000).toFixed(2)}s`);
    }

    // Reported, not asserted: the Plan §4.3 gate was already cleared by the
    // spike at 0.99x, and an assertion here would be a machine-speed test.
    console.log(`[module-6] Day1 render wall clock — ${timings.join(' · ')}`);
  });

  // Plan SC2 + SC4 — measured on the 9:16 output's pixels.
  test('desaturates the idle panel and paints the divider', async ({page}) => {
    await page.goto('/');
    await selectDay1(page);
    await uploadPanels(page);

    // A wide, distinctly coloured divider. Design §6.3 / FR-D08.
    await page.getByTestId('day1-split-width-number').fill(String(SPLIT_WIDTH_PX));
    await page.getByTestId('day1-split-color').fill(SPLIT_COLOR);

    await page.getByTestId('ratio-9:16').click();
    await expect(page.getByTestId('output-size')).toHaveText('1080×1920');

    const {outputPath} = await renderAndSave(page, 'day1-grayscale-9x16.mp4');

    // Day1 Design Ref: §4.1 — 1920 tall, 24px divider: A is 0..947, the divider
    // 948..971, B is 972..1919.
    const aRegion = {x: 340, y: 400, width: 400, height: 200};
    const bRegion = {x: 340, y: 1400, width: 400, height: 200};
    const dividerRegion = {x: 340, y: 954, width: 400, height: 12};

    const paletteA = JSON.parse(
      await readFile(fixture('gameplay-sample.colors.json'), 'utf8'),
    ) as string[];
    const paletteB = JSON.parse(
      await readFile(fixture('day1-panel-b.colors.json'), 'utf8'),
    ) as string[];

    const grayOfA = await sourceFirstFrameGray(PANEL_A_SOURCE);
    const grayOfB = await sourceFirstFrameGray(PANEL_B_SOURCE);

    // --- Section A: panel A plays, panel B is frozen and grey ---------------
    const aLive = meanRgb(
      await sampleRegion(outputPath, SECTION_A_SAMPLE_SECONDS, aRegion),
    );
    const bFrozenPixels = await sampleRegion(
      outputPath,
      SECTION_A_SAMPLE_SECONDS,
      bRegion,
    );

    // Panel A is playing its own source second 3, in colour.
    expect(nearestPaletteIndex(aLive, paletteA)).toBe(SECTION_A_SAMPLE_SECONDS);
    expect(saturation(aLive)).toBeGreaterThan(60);

    // Panel B holds *its own* first frame (D11), desaturated. Comparing against
    // B's grey and not A's is what proves each panel freezes its own source.
    expect(meanSaturation(bFrozenPixels)).toBeLessThan(8);
    expect(Math.abs(meanRgb(bFrozenPixels)[0] - grayOfB)).toBeLessThanOrEqual(
      CHANNEL_TOLERANCE,
    );
    expect(Math.abs(grayOfA - grayOfB)).toBeGreaterThan(3 * CHANNEL_TOLERANCE);

    // --- Section B: the roles swap ------------------------------------------
    const bLive = meanRgb(
      await sampleRegion(outputPath, SECTION_B_SAMPLE_SECONDS, bRegion),
    );
    const aFrozenPixels = await sampleRegion(
      outputPath,
      SECTION_B_SAMPLE_SECONDS,
      aRegion,
    );

    // Panel B is playing *its own* second 3 — six seconds into the timeline, but
    // three seconds into panel B's own section (FR-D06).
    expect(nearestPaletteIndex(bLive, paletteB)).toBe(
      SECTION_B_SAMPLE_SECONDS - 6,
    );
    expect(saturation(bLive)).toBeGreaterThan(60);
    expect(meanSaturation(aFrozenPixels)).toBeLessThan(8);
    expect(Math.abs(meanRgb(aFrozenPixels)[0] - grayOfA)).toBeLessThanOrEqual(
      CHANNEL_TOLERANCE,
    );

    // --- SC4: the divider is the colour that was picked ----------------------
    expectChannelsNear(
      meanRgb(
        await sampleRegion(outputPath, SECTION_A_SAMPLE_SECONDS, dividerRegion),
      ),
      hexToRgb(SPLIT_COLOR),
    );
  });

  // Plan SC5 — the overlay's bounding box against the bannerdesigner constants.
  // Both automatic ratios are measured: the placement is one pure function, but
  // its two constant rows come from two different app-badge layouts.
  const END_CARD_PLACEMENTS = [
    {
      // Day1 Design Ref: §4.3 APP_ICON_RECT['9:16'].
      ratio: '9:16' as const,
      file: 'day1-endcard-9x16.mp4',
      frame: {width: 1080, height: 1920},
      rect: {x: 0.18519, y: 0.42708, w: 0.62963, h: 0.35417},
    },
    {
      // Day1 Design Ref: §4.3 APP_ICON_RECT['1:1'].
      ratio: '1:1' as const,
      file: 'day1-endcard-1x1.mp4',
      frame: {width: 1080, height: 1080},
      rect: {x: 0.26111, y: 0.34722, w: 0.47685, h: 0.47685},
    },
    {
      // Day1 Design Ref: §4.3 APP_ICON_RECT['16:9'] — added once bannerdesigner
      // v1.18 shipped the app-badge 1920×1080 layout (1096, 238, 640×640).
      ratio: '16:9' as const,
      file: 'day1-endcard-16x9.mp4',
      frame: {width: 1920, height: 1080},
      rect: {x: 0.57083, y: 0.22037, w: 0.33333, h: 0.59259},
    },
  ];

  for (const placement of END_CARD_PLACEMENTS) {
    test(`places the ${placement.ratio} end card icon within 2px of the banner coordinates`, async ({
      page,
    }) => {
      await page.goto('/');
      await selectDay1(page);
      await uploadPanels(page);
      await uploadEndCard(page);

      // `glow` is the only preset with no transform at all (Design §5.3), so the
      // measured box is the placement and nothing else. `none` would hide it.
      await page.getByTestId('day1-icon-animation-glow').click();
      await page.getByTestId('day1-card-motion-none').click();

      await page.getByTestId(`ratio-${placement.ratio}`).click();

      const {outputPath} = await renderAndSave(page, placement.file);

      const {frame} = placement;
      const expectedRect = {
        x: placement.rect.x * frame.width,
        y: placement.rect.y * frame.height,
        w: placement.rect.w * frame.width,
        h: placement.rect.h * frame.height,
      };

      const box = await colorBoundingBox(
        outputPath,
        END_CARD_SAMPLE_SECONDS,
        hexToRgb('#ff00ff'),
        frame,
      );

      expect(box.matched).toBeGreaterThan(1000);
      expect(box.minX).toBeGreaterThanOrEqual(Math.round(expectedRect.x) - 2);
      expect(box.minX).toBeLessThanOrEqual(Math.round(expectedRect.x) + 2);
      expect(box.minY).toBeGreaterThanOrEqual(Math.round(expectedRect.y) - 2);
      expect(box.minY).toBeLessThanOrEqual(Math.round(expectedRect.y) + 2);
      expect(box.maxX).toBeCloseTo(
        Math.round(expectedRect.x + expectedRect.w) - 1,
        -0.5,
      );
      expect(box.maxY).toBeCloseTo(
        Math.round(expectedRect.y + expectedRect.h) - 1,
        -0.5,
      );
    });
  }

  // Panel restore parity with the three-scene path: a dropzone upload leaves no
  // handle, so a reload has to land on the relink prompt and the relink has to
  // keep the panel's trim. The stored-handle path itself needs the OS file
  // picker, which Playwright cannot drive — the same gap the three-scene source
  // has in `persistence-recovery.spec.ts`.
  test('restores Day1 panels after a reload through the relink prompt', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByLabel('프로젝트 이름').fill('day1-restore');
    await selectDay1(page);
    await uploadPanels(page);

    await page.getByTestId('day1-a-trim-in').fill('2');
    await page.getByTestId('day1-a-trim-in').blur();
    await expect(page.getByTestId('day1-a-trim-range')).toContainText('2.00s');

    await expect(page.getByTestId('editor-save-state')).toHaveText('저장됨', {
      timeout: 10_000,
    });

    await page.reload();

    await expect(page.getByLabel('프로젝트 이름')).toHaveValue('day1-restore');
    await expect(page.getByTestId('inspector-template')).toHaveText('Day1 비교');

    // Both panels come back as metadata only, so each gets its own prompt and the
    // render stays blocked until they are reconnected.
    await expect(page.getByTestId('day1-panel-a-repair')).toBeVisible();
    await expect(page.getByTestId('day1-panel-b-repair')).toBeVisible();
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeDisabled();

    await page
      .getByTestId('day1-panel-a-relink')
      .setInputFiles(PANEL_A_SOURCE);
    await page
      .getByTestId('day1-panel-b-relink')
      .setInputFiles(PANEL_B_SOURCE);

    await expect(page.getByTestId('day1-panel-a-repair')).toBeHidden();
    await expect(page.getByTestId('day1-panel-b-repair')).toBeHidden();
    await expect(page.getByTestId('day1-panel-a-metadata')).toContainText(
      '디코딩 확인됨',
    );
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeEnabled();

    // Relink keeps the media id, so the trim edit survives (module-5 §3.5).
    await expect(page.getByTestId('day1-a-trim-range')).toContainText('2.00s');
  });

  // FR-D03 / Design §7 — the gate that module 5 could only show in the preview.
  test('blocks the render and Batch until both panels are present', async ({
    page,
  }) => {
    await page.goto('/');
    await selectDay1(page);

    const renderButton = page.getByRole('button', {name: 'MP4 렌더'});

    await expect(page.getByTestId('day1-render-blocker')).toContainText(
      '영상 2개가 더 필요합니다',
    );
    await expect(renderButton).toBeDisabled();

    // The Batch dialog opens, but its preflight refuses to start.
    await page.getByTestId('open-batch').click();
    await page.getByTestId('batch-start').click();
    await expect(page.getByTestId('batch-preflight')).toContainText(
      '영상 2개를 모두 올려야 렌더할 수 있습니다. 남은 패널: A · B',
    );
    await page.getByTestId('batch-close').click();

    // One panel is still not enough.
    await page
      .getByTestId('day1-panel-a-input')
      .setInputFiles(PANEL_A_SOURCE);
    await expect(page.getByTestId('day1-render-blocker')).toContainText(
      '영상 1개가 더 필요합니다',
    );
    await expect(renderButton).toBeDisabled();

    await page
      .getByTestId('day1-panel-b-input')
      .setInputFiles(PANEL_B_SOURCE);
    await expect(page.getByTestId('day1-render-blocker')).toHaveCount(0);
    await expect(renderButton).toBeEnabled();
  });

  // FR-D14 — Day1 reuses the existing queue, naming, and locale x ratio matrix.
  test('expands and renders a Day1 batch across locales and ratios', async ({
    page,
  }) => {
    await page.goto('/');
    await selectDay1(page);
    await uploadPanels(page);

    // FR-D09 — the panel labels are the Day1 per-locale copy, and a batch job
    // renders the locale it was expanded for.
    await expandSection(page, 'day1-label');
    await page.getByTestId('day1-label-ko-a').fill('DAY 1');
    await page.getByTestId('day1-label-ko-b').fill('DAY 30');
    await page.getByTestId('day1-label-en-a').fill('DAY 1');
    await page.getByTestId('day1-label-en-b').fill('DAY 30');

    await page.getByTestId('open-batch').click();
    // 30fps keeps four real renders inside the suite's time budget.
    await page.getByTestId('batch-profile-fast').click();
    await page.getByTestId('batch-locale-en').check();
    await page.getByTestId('batch-ratio-1:1').check();
    await expect(page.getByTestId('batch-summary')).toContainText('작업 4개');

    const downloads: string[] = [];

    page.on('download', (download) =>
      downloads.push(download.suggestedFilename()),
    );

    await page.getByTestId('batch-start').click();
    await expect(page.getByTestId('batch-progress')).toHaveText('완료 4/4', {
      timeout: RENDER_TIMEOUT,
    });

    const rows = page.getByTestId('batch-queue').locator('tbody tr');

    await expect(rows).toHaveCount(4);

    for (let index = 0; index < 4; index += 1) {
      await expect(rows.nth(index)).toContainText('완료');
    }

    expect([...downloads].sort()).toEqual([
      'ua-video_en_1x1_15s_30fps.mp4',
      'ua-video_en_9x16_15s_30fps.mp4',
      'ua-video_ko_1x1_15s_30fps.mp4',
      'ua-video_ko_9x16_15s_30fps.mp4',
    ]);
  });

  // Plan SC3 — the regression half the field-level v1 import test cannot cover:
  // a v1 document still reaches a real MP4 through the three-scene path.
  test('renders a migrated v1 project through the three-scene path', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('project-menu-toggle').click();
    await page
      .getByTestId('project-import-input')
      .setInputFiles(fixture('project-v1.json'));

    await expect(page.getByLabel('프로젝트 이름')).toHaveValue('v1-regression');
    // The three-scene inspector, not the Day1 one.
    await expect(page.getByTestId('inspector-scene')).toBeVisible();
    await expect(page.getByTestId('inspector-template')).toHaveCount(0);

    // An import carries metadata only, so the source has to be relinked.
    await page.getByTestId('relink-input').setInputFiles(PANEL_A_SOURCE);
    await expect(page.getByTestId('source-repair')).toHaveCount(0);

    await page.getByTestId('ratio-9:16').click();

    const {outputPath, renderMs, suggestedFilename} = await renderAndSave(
      page,
      'v1-migrated-9x16.mp4',
    );

    expect(suggestedFilename).toBe('v1-regression_ko_9x16_15s_60fps.mp4');

    // The three-scene baseline through the same harness and output settings, so
    // the Day1 number logged above is comparable. Design §2.3.
    console.log(
      `[module-6] three-scene 9:16 render wall clock — ${(
        renderMs / 1000
      ).toFixed(2)}s`,
    );

    const probe = await probeVideo(outputPath);

    expect(
      probe.streams.find((stream) => stream.codec_type === 'video'),
    ).toMatchObject({codec_name: 'h264', width: 1080, height: 1920});
  });
});
