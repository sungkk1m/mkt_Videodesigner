// Day1 Trim UX Design Ref: §7.2 — E1, E3, E6, E7 (module-3). The render
// correlation (E2) and the short-source gate (E4, E5) land with module-4.
//
// The strip needs a real <video>, a canvas, and layout, so none of it can be
// unit tested; §4.1's arithmetic is covered in `trimWindow.test.ts` and this
// file covers what only a browser can answer.
import {mkdir, readFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';

import {
  meanRgb,
  nearestPaletteIndex,
  sampleRegion,
} from './helpers/videoSampling';
import {switchTemplate} from './helpers/template';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);
const outputDirectory = resolve(projectRoot, 'artifacts/day1-trim-ux');

const BANNER = fixture('day1-endcard-banner.png');
const APP_ICON = fixture('day1-app-icon.png');

const RENDER_TIMEOUT = 8 * 60 * 1000;

const PANEL_A_SOURCE = fixture('gameplay-sample.mp4');
const PANEL_B_SOURCE = fixture('day1-panel-b.mp4');

// The 15s preset gives panel A a 6s section, and the fixtures are 12s, so the
// window has 6s of travel. Design Ref: §4.2.
const SECTION_MS = 6000;
const SOURCE_MS = 12_000;
const MAX_TRIM_IN_MS = SOURCE_MS - SECTION_MS;

/** Mirrors `STRIP_CELL_COUNT` in `useTrimThumbnails`. */
const STRIP_CELLS = 16;

const selectDay1 = async (page: Page) => {
  await switchTemplate(page, 'day1');
  await expect(page.getByTestId('inspector-template')).toHaveText('Day1 비교');
};

const uploadPanels = async (page: Page) => {
  await page.getByTestId('day1-panel-a-input').setInputFiles(PANEL_A_SOURCE);
  await page.getByTestId('day1-panel-b-input').setInputFiles(PANEL_B_SOURCE);

  await expect(page.getByTestId('day1-panel-a-metadata')).toContainText(
    '1920×1080',
  );
};

const openDay1 = async (page: Page) => {
  await page.goto('/');
  await selectDay1(page);
  await uploadPanels(page);
};

/**
 * The strip grows as thumbnails and the enlarged frame arrive, and a drag that
 * measures the window before that settles can press on empty space. Wait for the
 * layout to stop moving before taking coordinates.
 */
const waitForStripReady = async (page: Page) => {
  const strip = page.getByTestId('day1-a-trim-strip');

  await expect(strip.locator('.trim__cell img')).toHaveCount(STRIP_CELLS, {
    timeout: 30_000,
  });
  await expect(page.getByTestId('day1-a-trim-preview')).toBeVisible({
    timeout: 30_000,
  });
};

/** Drags the window so its centre lands at `ratio` across the track. */
const dragWindowTo = async (page: Page, ratio: number) => {
  await waitForStripReady(page);

  const track = page.getByTestId('day1-a-trim-strip').locator('.trim__track');
  const box = await track.boundingBox();

  expect(box).not.toBeNull();

  const {x, y, width, height} = box as NonNullable<typeof box>;
  const window = page.getByTestId('day1-a-trim-window');
  const windowBox = await window.boundingBox();

  expect(windowBox).not.toBeNull();

  const start = windowBox as NonNullable<typeof windowBox>;

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(x + width * ratio, y + height / 2, {steps: 8});
  await page.mouse.up();
};

/**
 * `SecondsField` mirrors its prop into local draft state, so the number catches
 * up one render after the window's `aria-valuenow` does. Poll rather than read
 * once, so the assertion is about the settled value.
 */
const expectTrimInSeconds = async (page: Page, seconds: number) => {
  await expect
    .poll(async () => Number(await page.getByTestId('day1-a-trim-in').inputValue()))
    .toBeCloseTo(seconds, 2);
};

const trimInSeconds = async (page: Page) =>
  Number(await page.getByTestId('day1-a-trim-in').inputValue());

const expandSection = async (page: Page, id: string) => {
  await page.getByTestId(`section-${id}`).click();
};

const uploadEndCard = async (page: Page) => {
  await expandSection(page, 'day1-endcard');
  await page.getByTestId('day1-endcard-banner').setInputFiles(BANNER);
  await page.getByTestId('day1-endcard-appIcon').setInputFiles(APP_ICON);
  await expect(page.getByTestId('day1-banner-missing')).toHaveCount(0);
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

test.describe('Day1 trim strip', () => {
  // E1 — the point of the whole cycle: the source is visible and the interval is
  // chosen by dragging rather than by typing a number and rendering to find out.
  test('shows the source as a strip and picks the interval by dragging', async ({
    page,
  }) => {
    await openDay1(page);

    const strip = page.getByTestId('day1-a-trim-strip');

    await expect(strip).toBeVisible();

    // Thumbnails decode one at a time (FR-T03), so wait for the track to fill.
    await expect
      .poll(async () => strip.locator('.trim__cell img').count(), {
        timeout: 30_000,
      })
      .toBeGreaterThan(4);

    await expect(page.getByTestId('day1-a-trim-window')).toBeVisible();
    expect(await trimInSeconds(page)).toBe(0);

    await dragWindowTo(page, 0.6);

    expect(await trimInSeconds(page)).toBeGreaterThan(0);
  });

  // FR-T02 / FR-S05 — the window keeps the section's width and only slides, and
  // it can never leave the source.
  test('keeps the window a fixed width and inside the source', async ({page}) => {
    await openDay1(page);

    const window = page.getByTestId('day1-a-trim-window');
    const before = await window.boundingBox();

    // The far edge of the track. The window is grabbed by its centre, so this
    // asks for a Trim In past the legal maximum and must come back clamped.
    await dragWindowTo(page, 1);

    const after = await window.boundingBox();

    expect(before).not.toBeNull();
    expect(after).not.toBeNull();

    // Same width, moved right, still clamped to the last legal Trim In.
    expect((after as NonNullable<typeof after>).width).toBeCloseTo(
      (before as NonNullable<typeof before>).width,
      0,
    );
    await expectTrimInSeconds(page, MAX_TRIM_IN_MS / 1000);
  });

  // E3 — the enlarged frame is what makes "is this six seconds any good?"
  // answerable in the app (FR-T05).
  test('updates the enlarged frame when the window moves', async ({page}) => {
    await openDay1(page);

    const preview = page.getByTestId('day1-a-trim-preview');

    await expect(preview).toBeVisible({timeout: 30_000});

    const before = await preview.getAttribute('src');

    await dragWindowTo(page, 0.7);

    await expect
      .poll(async () => preview.getAttribute('src'), {timeout: 30_000})
      .not.toBe(before);
  });

  // E6 — sampling must not take the inspector hostage (FR-T10).
  test('keeps the number field usable while thumbnails are still decoding', async ({
    page,
  }) => {
    await page.goto('/');
    await selectDay1(page);
    await page.getByTestId('day1-panel-a-input').setInputFiles(PANEL_A_SOURCE);

    // Deliberately no wait for the strip to finish filling.
    await page.getByTestId('day1-a-trim-in').fill('3');
    await page.getByTestId('day1-a-trim-in').blur();

    expect(await trimInSeconds(page)).toBe(3);
  });

  // E7 — the window is reachable without a pointer (FR-T08).
  test('moves the window with the keyboard', async ({page}) => {
    await openDay1(page);

    const window = page.getByTestId('day1-a-trim-window');

    await window.focus();
    await expect(window).toHaveAttribute('aria-valuenow', '0');

    await window.press('ArrowRight');
    await expect(window).toHaveAttribute('aria-valuenow', '100');

    await window.press('Shift+ArrowRight');
    await expect(window).toHaveAttribute('aria-valuenow', '1100');

    await expectTrimInSeconds(page, 1.1);

    await window.press('ArrowLeft');
    await expect(window).toHaveAttribute('aria-valuenow', '1000');
  });

  // FR-T07 — the out point is derived, so it is shown rather than entered.
  test('shows Trim Out as a derived readout that follows Trim In', async ({
    page,
  }) => {
    await openDay1(page);

    const out = page.getByTestId('day1-a-trim-out');

    // It is no longer an input: reading it means reading text. Out = In + the
    // window, and the window is the section length, so it starts at the section.
    await expect(out).toHaveText((SECTION_MS / 1000).toFixed(2));

    await page.getByTestId('day1-a-trim-in').fill('2');
    await page.getByTestId('day1-a-trim-in').blur();

    await expect(out).toHaveText(((2000 + SECTION_MS) / 1000).toFixed(2));
  });

  // E2 / Plan SC2 — the point the strip commits is the point the MP4 starts at.
  // The colour-per-second fixture makes that measurable on the output rather
  // than inferred: the colour on screen names the source second.
  test('renders the source from the point chosen on the strip', async ({
    page,
  }) => {
    test.setTimeout(RENDER_TIMEOUT);

    await openDay1(page);
    await uploadEndCard(page);

    await page.getByTestId('ratio-9:16').click();
    await expect(page.getByTestId('output-size')).toHaveText('1080×1920');

    // Set 3.000s through the strip widget itself, not the number field, so the
    // assertion covers strip -> store -> render. Left first to clamp at zero
    // from wherever the default sits, then three 1s steps.
    const window = page.getByTestId('day1-a-trim-window');

    await window.focus();

    for (let index = 0; index < 8; index += 1) {
      await window.press('Shift+ArrowLeft');
    }

    await expect(window).toHaveAttribute('aria-valuenow', '0');

    for (let index = 0; index < 3; index += 1) {
      await window.press('Shift+ArrowRight');
    }

    await expect(window).toHaveAttribute('aria-valuenow', '3000');
    await expectTrimInSeconds(page, 3);

    const outputPath = await renderAndSave(page, 'trim-from-strip-9x16.mp4');

    const palette = JSON.parse(
      await readFile(fixture('gameplay-sample.colors.json'), 'utf8'),
    ) as string[];

    // Day1 Design §4.1 — in 9:16 panel A occupies y 0..947.
    const aRegion = {x: 340, y: 400, width: 400, height: 200};
    const sampled = meanRgb(await sampleRegion(outputPath, 3, aRegion));

    // Output second 3 with Trim In 3s must be source second 6, not second 3.
    expect(nearestPaletteIndex(sampled, palette)).toBe(6);
  });

  // E4 / Plan SC4 — the failure this cycle set out to make visible. A 12s source
  // under the 30s preset gets a 13.5s section, so it runs out and the panel
  // renders black for the rest with nothing said about it.
  test('warns and blocks the render when a source cannot fill its section', async ({
    page,
  }) => {
    await openDay1(page);

    // Both panels fit at 15s (6s sections) — nothing to warn about yet.
    await expect(page.getByTestId('day1-a-trim-short')).toHaveCount(0);
    await expect(page.getByTestId('day1-short-blocker')).toHaveCount(0);

    await page.getByRole('button', {name: '30초', exact: true}).click();

    // Day1 §4.2 — 30s preset is [13.5s, 13.5s, 3s], and both sources are 12s.
    await expect(page.getByTestId('day1-a-trim-short')).toContainText(
      '검은 화면으로 출력됩니다',
    );
    await expect(page.getByTestId('day1-b-trim-short')).toBeVisible();

    // FR-S05 — with nothing left to choose, the window stops being draggable.
    await expect(page.getByTestId('day1-a-trim-window')).toBeDisabled();

    // FR-S03 — the single render path.
    await expect(page.getByTestId('day1-short-blocker')).toContainText('2개');
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeDisabled();

    // FR-S03 — and the Batch path, which has its own preflight list.
    await page.getByTestId('open-batch').click();
    await page.getByTestId('batch-start').click();
    await expect(page.getByTestId('batch-preflight')).toContainText(
      '원본이 구간보다 짧아 검은 화면이 출력됩니다. 구간 길이를 줄이거나 더 긴 영상을 사용하세요. 해당 패널: A · B',
    );
    await page.getByTestId('batch-close').click();
  });

  // E5 / Plan SC5 — the block has to be escapable, or it is a dead end. The
  // warning names two ways out; this is the one that does not need new footage.
  test('clears the warning and the block once the section is shortened', async ({
    page,
  }) => {
    await openDay1(page);
    await page.getByRole('button', {name: '30초', exact: true}).click();

    await expect(page.getByTestId('day1-short-blocker')).toBeVisible();
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeDisabled();

    // Back to 6s sections, which the 12s sources fill with room to spare.
    await page.getByRole('button', {name: '15초', exact: true}).click();

    await expect(page.getByTestId('day1-a-trim-short')).toHaveCount(0);
    await expect(page.getByTestId('day1-b-trim-short')).toHaveCount(0);
    await expect(page.getByTestId('day1-short-blocker')).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeEnabled();
    await expect(page.getByTestId('day1-a-trim-window')).toBeEnabled();
  });

  // FR-T04 — collapsing a panel must not pay for the thumbnails twice.
  test('keeps thumbnails after the panel is collapsed and reopened', async ({
    page,
  }) => {
    await openDay1(page);

    const strip = page.getByTestId('day1-a-trim-strip');

    // The cache is written when a run completes, so let it complete. Collapsing
    // mid-run aborts it and the next open samples again — see Design §5.2.
    await expect(strip.locator('.trim__cell img')).toHaveCount(STRIP_CELLS, {
      timeout: 30_000,
    });

    await page.getByTestId('section-day1-panel-a').click();
    await expect(strip).toBeHidden();
    await page.getByTestId('section-day1-panel-a').click();

    // Straight back from cache — no empty track while it re-decodes.
    await expect(strip.locator('.trim__cell img')).toHaveCount(STRIP_CELLS, {
      timeout: 2000,
    });
  });
});
