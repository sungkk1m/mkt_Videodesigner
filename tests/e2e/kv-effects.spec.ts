// kv-object-animation Design Ref: §7.2 — the effect work that can be judged
// without an encoder: the canvas layer's existence and shared transform, and
// the overlay's drag editing. Pixel content is the M0 harness and the
// real-device gate's territory (M5) — a canvas cannot be read as DOM strings.
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';
import {switchTemplate} from './helpers/template';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);

const openLoopWithThreeKeyVisuals = async (page: Page) => {
  await page.goto('/');
  await switchTemplate(page, 'kv-loop');
  await expect(page.getByTestId('inspector-template')).toContainText('반복 2회');
  await page.getByTestId('kv-count').selectOption('3');

  for (const index of [0, 1, 2]) {
    await page
      .getByTestId(`kv-slot-${index}-input`)
      .setInputFiles(fixture(`kv-${index + 1}.png`));
  }

  await expect(page.getByTestId('kv-scene-image').first()).toBeVisible();
};

const styleTransform = (page: Page, testId: string) =>
  page
    .getByTestId(testId)
    .first()
    .evaluate((node) => (node as HTMLElement).style.transform);

test.describe('looping effects — controls', () => {
  test.use({actionTimeout: 20_000});

  test('adding an effect mounts the canvas on the image transform, removing unmounts it (NFR-O01, FR-O05)', async ({
    page,
  }) => {
    await openLoopWithThreeKeyVisuals(page);

    // No designations, no canvas element — the render tree a stored project
    // had before this cycle (FR-O08).
    await expect(page.getByTestId('kv-effects-canvas')).toHaveCount(0);

    await page.getByTestId('kv-effect-add-particles').click();
    await expect(page.getByTestId('kv-effects-canvas').first()).toBeVisible();

    // The same transform string, read off both elements — the coordinate-space
    // sharing that makes the effects follow the camera (D-04).
    expect(await styleTransform(page, 'kv-effects-canvas')).toBe(
      await styleTransform(page, 'kv-scene-image'),
    );

    await page.getByTestId('kv-effect-0-remove').click();
    await expect(page.getByTestId('kv-effects-canvas')).toHaveCount(0);
  });

  test('drags the particle region and keeps it across a reload (FR-O06)', async ({
    page,
  }) => {
    await openLoopWithThreeKeyVisuals(page);

    await page.getByTestId('kv-effect-add-particles').click();

    // Adding selects, so the overlay is already on screen for the drag.
    await expect(page.getByTestId('kv-effect-overlay')).toBeVisible();
    const region = page.getByTestId('kv-effect-region');
    const before = await region.boundingBox();

    if (!before) {
      throw new Error('the particle region has nothing to drag');
    }

    await page.mouse.move(
      before.x + before.width / 2,
      before.y + before.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(before.x + before.width / 2 - 60, before.y - 40, {
      steps: 8,
    });
    await page.mouse.up();

    const after = await region.boundingBox();

    expect(after?.x).toBeLessThan(before.x);
    expect(after?.y).toBeLessThan(before.y);

    // The drag committed to the project, like any other edit. (The canvas
    // itself is not checked after the reload: a restored project's images wait
    // for a re-upload in this environment, and effects ride the artwork.)
    await expect(page.getByTestId('editor-save-state')).toContainText('저장됨');
    await page.reload();
    await expect(page.getByTestId('inspector-template')).toContainText('반복 2회');
    await expect(page.getByTestId('kv-effect-0')).toBeVisible();

    // Selection is an editing posture, not project state — it resets on
    // reload, and reselecting brings the overlay back on the moved region.
    await expect(page.getByTestId('kv-effect-overlay')).toHaveCount(0);
    await page.getByTestId('kv-effect-0-select').click();
    const restored = await page.getByTestId('kv-effect-region').boundingBox();

    expect(restored?.x).toBeLessThan(before.x);
  });

  test('drags the glow radius and the inspector value follows (FR-O06/FR-O07)', async ({
    page,
  }) => {
    await openLoopWithThreeKeyVisuals(page);

    await page.getByTestId('kv-effect-add-glow').click();
    await expect(page.getByTestId('kv-effect-center')).toBeVisible();

    // The stored default, before any drag (18% of frame width).
    await expect(page.getByTestId('kv-effect-radius-number')).toHaveValue('18');

    const handle = page.getByTestId('kv-effect-radius-handle');
    const grip = await handle.boundingBox();
    const disc = await page.getByTestId('kv-effect-center').boundingBox();

    if (!grip || !disc) {
      throw new Error('the glow overlay has nothing to drag');
    }

    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 + 40, grip.y + grip.height / 2, {
      steps: 8,
    });
    await page.mouse.up();

    const grown = await page.getByTestId('kv-effect-center').boundingBox();

    expect(grown?.width).toBeGreaterThan(disc.width);

    // The overlay's drag lands in the inspector's number — one value, two
    // editors (§5.1/§5.2).
    const radius = Number(
      await page.getByTestId('kv-effect-radius-number').inputValue(),
    );

    expect(radius).toBeGreaterThan(18);
  });
});
