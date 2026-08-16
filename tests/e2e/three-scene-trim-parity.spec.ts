// Three-Scene Trim Parity Design Ref: §7.2 — T1~T7. Closes the asymmetry the
// previous cycle left behind: the strip and the short-source block were Day1
// only, and the three-scene path kept the number fields and a warning that
// nothing acted on.
//
// The strip needs a real <video>, a canvas, and layout, so none of it can be
// unit tested; the arithmetic lives in `trimWindow.test.ts` and the short-source
// judgement in `project.test.ts`. This file covers what only a browser answers.
import {mkdir, readFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';

import {
  meanRgb,
  nearestPaletteIndex,
  sampleRegion,
} from './helpers/videoSampling';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);
const outputDirectory = resolve(projectRoot, 'artifacts/three-scene-trim-parity');

const SOURCE = fixture('gameplay-sample.mp4');
const PALETTE_PATH = fixture('gameplay-sample.colors.json');

const RENDER_TIMEOUT = 8 * 60 * 1000;

// The 15s preset is [2s hook, 10s gameplay, 3s CTA] and the fixture is 12s, so
// the hook window has 10s of travel and the gameplay window has 2s.
const SOURCE_MS = 12_000;
const HOOK_SECTION_MS = 2000;
const GAMEPLAY_SECTION_MS = 10_000;

/** Mirrors `STRIP_CELL_COUNT` in `useTrimThumbnails`. */
const STRIP_CELLS = 16;

/** Mirrors `KEY_STEP_LARGE_MS` in `TrimStrip`. */
const KEY_STEP_LARGE_MS = 1000;

const openEditor = async (page: Page) => {
  await page.goto('/');
  await page.getByTestId('source-input').setInputFiles(SOURCE);
  await expect(page.getByTestId('source-metadata')).toContainText('12.00초');
};

const selectScene = async (page: Page, kind: 'hook' | 'gameplay' | 'cta') => {
  await page.getByTestId(`timeline-clip-${kind}`).click();
};

const waitForStripReady = async (page: Page) => {
  const strip = page.getByTestId('scene-trim-strip');

  await expect(strip.locator('.trim__cell img')).toHaveCount(STRIP_CELLS, {
    timeout: 30_000,
  });
  await expect(page.getByTestId('scene-trim-preview')).toBeVisible({
    timeout: 30_000,
  });
};

/** Drags the window so its centre lands at `ratio` across the track. */
const dragWindowTo = async (page: Page, ratio: number) => {
  await waitForStripReady(page);

  const track = page.getByTestId('scene-trim-strip').locator('.trim__track');
  const box = await track.boundingBox();

  expect(box).not.toBeNull();

  const {x, y, width, height} = box as NonNullable<typeof box>;
  const windowBox = await page.getByTestId('scene-trim-window').boundingBox();

  expect(windowBox).not.toBeNull();

  const start = windowBox as NonNullable<typeof windowBox>;

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(x + width * ratio, y + height / 2, {steps: 8});
  await page.mouse.up();
};

/**
 * `SecondsField` mirrors its prop into local draft state, so the number catches
 * up one render after the window's `aria-valuenow` does.
 */
const expectTrimInSeconds = async (page: Page, seconds: number) => {
  await expect
    .poll(async () => Number(await page.getByTestId('trim-in').inputValue()))
    .toBeCloseTo(seconds, 2);
};

/** Moves the window to an exact millisecond position through the keyboard. */
const setWindowToMs = async (page: Page, ms: number) => {
  const window = page.getByTestId('scene-trim-window');

  await window.focus();

  // Clamp to zero first so the starting position does not matter.
  for (let index = 0; index < SOURCE_MS / KEY_STEP_LARGE_MS; index += 1) {
    await window.press('Shift+ArrowLeft');
  }

  await expect(window).toHaveAttribute('aria-valuenow', '0');

  for (let index = 0; index < ms / KEY_STEP_LARGE_MS; index += 1) {
    await window.press('Shift+ArrowRight');
  }

  await expect(window).toHaveAttribute('aria-valuenow', String(ms));
};

const renderAndSave = async (page: Page, fileName: string) => {
  const downloadPromise = page.waitForEvent('download', {
    timeout: RENDER_TIMEOUT,
  });

  await page.getByRole('button', {name: 'MP4 렌더'}).click();
  await expect(page.getByTestId('editor-render-status')).toContainText('완료', {
    timeout: RENDER_TIMEOUT,
  });
  await page.getByRole('button', {name: '다운로드'}).click();

  await mkdir(outputDirectory, {recursive: true});

  const outputPath = resolve(outputDirectory, fileName);

  await (await downloadPromise).saveAs(outputPath);

  return outputPath;
};

/**
 * The fixture is one saturated colour per second, so a sampled frame names the
 * source second it came from. Same region as `editor-vertical-slice`, which is
 * clear of the hook headline in a 1080×1920 output.
 */
const CENTER_REGION = {x: 440, y: 860, width: 200, height: 200};

const sourceSecondOf = async (filePath: string, seconds: number) => {
  const palette = JSON.parse(await readFile(PALETTE_PATH, 'utf8')) as string[];
  const sampled = meanRgb(
    await sampleRegion(filePath, seconds, CENTER_REGION),
  );

  return nearestPaletteIndex(sampled, palette);
};

test.describe('three-scene trim strip', () => {
  // T1 / SC1 — the source is visible in the three-scene inspector and the
  // interval is chosen by dragging, exactly as in Day1.
  test('shows the source as a strip and picks the interval by dragging', async ({
    page,
  }) => {
    await openEditor(page);
    await selectScene(page, 'gameplay');

    const strip = page.getByTestId('scene-trim-strip');

    await expect(strip).toBeVisible();
    await expect(strip.locator('.trim__cell img')).toHaveCount(STRIP_CELLS, {
      timeout: 30_000,
    });

    // Gameplay has a 10s section on a 12s source, so 2s of travel.
    await dragWindowTo(page, 1);
    await expectTrimInSeconds(page, (SOURCE_MS - GAMEPLAY_SECTION_MS) / 1000);

    await dragWindowTo(page, 0);
    await expectTrimInSeconds(page, 0);
  });

  // T3 / SC3 — the three scenes share one source, so the window resizes per
  // section while the thumbnails are paid for once.
  test('resizes the window per scene and reuses the thumbnails', async ({
    page,
  }) => {
    await openEditor(page);
    await selectScene(page, 'hook');
    await waitForStripReady(page);

    const trackWidth = async () => {
      const box = await page
        .getByTestId('scene-trim-strip')
        .locator('.trim__track')
        .boundingBox();

      return (box as NonNullable<typeof box>).width;
    };

    const windowWidth = async () => {
      const box = await page.getByTestId('scene-trim-window').boundingBox();

      return (box as NonNullable<typeof box>).width;
    };

    const hookRatio = (await windowWidth()) / (await trackWidth());

    expect(hookRatio).toBeCloseTo(HOOK_SECTION_MS / SOURCE_MS, 1);

    await selectScene(page, 'gameplay');

    // Cached by source id, so the track is full again well inside the time a
    // fresh sampling pass would take (FR-P08).
    await expect(
      page.getByTestId('scene-trim-strip').locator('.trim__cell img'),
    ).toHaveCount(STRIP_CELLS, {timeout: 3000});

    const gameplayRatio = (await windowWidth()) / (await trackWidth());

    expect(gameplayRatio).toBeCloseTo(GAMEPLAY_SECTION_MS / SOURCE_MS, 1);
    expect(gameplayRatio).toBeGreaterThan(hookRatio);
  });

  // T6 / SC8 — the out point is derived, so it is shown rather than entered.
  test('shows Trim Out as a derived readout that follows Trim In', async ({
    page,
  }) => {
    await openEditor(page);
    await selectScene(page, 'gameplay');

    const out = page.getByTestId('trim-out');

    // Reading it means reading text, not an input value.
    await expect(out).toHaveText((GAMEPLAY_SECTION_MS / 1000).toFixed(2));

    await page.getByTestId('trim-in').fill('1.5');
    await page.getByTestId('trim-in').blur();

    await expect(out).toHaveText(
      ((1500 + GAMEPLAY_SECTION_MS) / 1000).toFixed(2),
    );
    await expect(page.getByTestId('trim-range')).toContainText(
      '1.50s – 11.50s',
    );
  });

  // T7 / FR-P07 — the window is reachable without a pointer.
  test('moves the window with the keyboard', async ({page}) => {
    await openEditor(page);
    await selectScene(page, 'hook');
    await waitForStripReady(page);

    const window = page.getByTestId('scene-trim-window');

    await window.focus();
    await window.press('Shift+ArrowRight');
    await expect(window).toHaveAttribute('aria-valuenow', '1000');

    await window.press('ArrowRight');
    await expect(window).toHaveAttribute('aria-valuenow', '1100');
    await expectTrimInSeconds(page, 1.1);

    await window.press('ArrowLeft');
    await expect(window).toHaveAttribute('aria-valuenow', '1000');
  });

  // T2 / SC2 — the point the strip commits is the point the MP4 starts at.
  // The colour-per-second fixture makes that measurable rather than inferred.
  test('renders the source from the point chosen on the strip', async ({
    page,
  }) => {
    test.setTimeout(RENDER_TIMEOUT);

    await openEditor(page);
    await selectScene(page, 'hook');
    await waitForStripReady(page);

    // Set 6.000s through the strip widget itself, not the number field, so the
    // assertion covers strip -> store -> render.
    await setWindowToMs(page, 6000);
    await expectTrimInSeconds(page, 6);

    const outputPath = await renderAndSave(page, 'trim-from-strip.mp4');

    // Output 0.5s falls inside the 2s hook scene, so it must be source 6.5s.
    expect(await sourceSecondOf(outputPath, 0.5)).toBe(6);
    expect(await sourceSecondOf(outputPath, 1.5)).toBe(7);
  });
});

test.describe('three-scene short source', () => {
  // T4 / SC4 — the failure this cycle set out to close. Until now the
  // three-scene path warned and rendered black anyway; only Day1 was blocked.
  test('warns and blocks both render paths when a source cannot fill a section', async ({
    page,
  }) => {
    await openEditor(page);
    await selectScene(page, 'gameplay');

    // Everything fits at 15s — nothing to warn about yet.
    await expect(page.getByTestId('scene-trim-short')).toHaveCount(0);
    await expect(page.getByTestId('scene-short-blocker')).toHaveCount(0);

    await page.getByRole('button', {name: '30초', exact: true}).click();

    // The 30s preset is [3s, 24s, 3s] and the source is 12s, so gameplay is the
    // only scene that runs out. Hook and CTA still fit their 3s sections.
    await expect(page.getByTestId('scene-trim-short')).toContainText(
      '검은 화면으로 출력됩니다',
    );

    // FR-S08 — with nothing left to choose, the window stops being draggable.
    await expect(page.getByTestId('scene-trim-window')).toBeDisabled();

    // FR-S03 — the single render path.
    await expect(page.getByTestId('scene-short-blocker')).toContainText('1개');
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeDisabled();

    // FR-S04 — and the Batch path, which keeps its own preflight list. Blocking
    // one and not the other is what the previous cycle caught late (D-D11).
    await page.getByTestId('open-batch').click();
    await page.getByTestId('batch-start').click();
    await expect(page.getByTestId('batch-preflight')).toContainText(
      '원본이 장면보다 짧아 검은 화면이 출력됩니다. 장면 길이를 줄이거나 더 긴 영상을 사용하세요. 해당 장면: Gameplay',
    );
    await page.getByTestId('batch-close').click();

    // The scenes that do fit say nothing, so the warning points somewhere.
    await selectScene(page, 'hook');
    await expect(page.getByTestId('scene-trim-short')).toHaveCount(0);
  });

  // T5 / SC5 — the block has to be escapable or it is a dead end. The warning
  // names two ways out; this is the one that needs no new footage.
  test('clears the warning and the block once the section is shortened', async ({
    page,
  }) => {
    await openEditor(page);
    await selectScene(page, 'gameplay');
    await page.getByRole('button', {name: '30초', exact: true}).click();

    await expect(page.getByTestId('scene-short-blocker')).toBeVisible();
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeDisabled();

    await page.getByRole('button', {name: '15초', exact: true}).click();

    await expect(page.getByTestId('scene-trim-short')).toHaveCount(0);
    await expect(page.getByTestId('scene-short-blocker')).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeEnabled();
    await expect(page.getByTestId('scene-trim-window')).toBeEnabled();
  });
});
