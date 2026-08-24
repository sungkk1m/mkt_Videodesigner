// kv-motion-effects Design Ref: §8.3 E-1 to E-3 — the parts of the motion work
// that can be judged without an encoder. The three that need one (a real render
// measured frame by frame, the drawn region matching the last frame, and the
// no-regression render of a stored project) are listed in the design as open
// until a machine with H.264 runs them.
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

/** The transform the composition actually applied to the on-screen key visual. */
const sceneTransform = (page: Page) =>
  page
    .getByTestId('kv-scene-image')
    .first()
    .evaluate((node) => (node as HTMLElement).style.transform);

test.describe('looping motion — controls', () => {
  test.use({actionTimeout: 20_000});

  test('sets the loop default and lets one key visual opt out (E-1)', async ({
    page,
  }) => {
    await openLoopWithThreeKeyVisuals(page);

    // Every slot starts on the loop default, so raising the count does not ask
    // for the same choice again (D-04).
    await expect(page.getByTestId('kv-slot-motion')).toHaveValue('inherit');
    await expect(page.getByTestId('kv-default-motion')).toHaveValue('zoomIn');

    await page.getByTestId('kv-default-motion').selectOption('panLeftToRight');
    await expect(page.getByTestId('kv-slot-motion')).toHaveValue('inherit');

    // KV 2 opts out. The others must not move with it.
    await page.getByTestId('kv-slot-1-select').click();
    await page.getByTestId('kv-slot-motion').selectOption('still');
    await expect(page.getByTestId('kv-slot-motion')).toHaveValue('still');

    await page.getByTestId('kv-slot-0-select').click();
    await expect(page.getByTestId('kv-slot-motion')).toHaveValue('inherit');

    await expect(page.getByTestId('editor-save-state')).toContainText('저장됨');
    await page.reload();
    await expect(page.getByTestId('inspector-template')).toContainText('반복 2회');

    await expect(page.getByTestId('kv-default-motion')).toHaveValue(
      'panLeftToRight',
    );
    await page.getByTestId('kv-slot-1-select').click();
    await expect(page.getByTestId('kv-slot-motion')).toHaveValue('still');
  });

  test('says a pan at zero strength is a still (E-3)', async ({page}) => {
    await openLoopWithThreeKeyVisuals(page);

    await expect(page.getByTestId('kv-motion-zero-hint')).toHaveCount(0);

    await page.getByTestId('kv-default-motion').selectOption('panTopToBottom');
    await page.getByTestId('kv-ken-burns-intensity').fill('0');
    await page.getByTestId('kv-ken-burns-intensity').blur();

    // Silently rendering a still is the failure this replaces: at zero there is
    // no room to travel, and the panel says so rather than looking broken.
    await expect(page.getByTestId('kv-motion-zero-hint')).toBeVisible();

    await page.getByTestId('kv-default-motion').selectOption('zoomIn');
    await expect(page.getByTestId('kv-motion-zero-hint')).toHaveCount(0);
  });

  test('draws the camera on the preview and follows the drag (E-2)', async ({
    page,
  }) => {
    await openLoopWithThreeKeyVisuals(page);

    // A preset has no rectangles to show.
    await expect(page.getByTestId('kv-motion-overlay')).toHaveCount(0);

    await page.getByTestId('kv-slot-motion').selectOption('custom');
    await expect(page.getByTestId('kv-motion-overlay')).toBeVisible();
    await expect(page.getByTestId('kv-motion-from')).toBeVisible();
    await expect(page.getByTestId('kv-motion-to')).toBeVisible();

    // A drawn pair sets its own travel, so the strength slider steps aside.
    await expect(page.getByTestId('kv-ken-burns-intensity')).toBeDisabled();
    await expect(page.getByTestId('kv-motion-strength-note')).toBeVisible();

    // The *start* rectangle is the one frame 0 shows, so shrinking it is what
    // proves the composition reads the drawing rather than a preset. Dragging
    // the end rectangle would correctly leave frame 0 alone.
    const handle = page.getByTestId('kv-motion-from-handle');
    const before = await handle.boundingBox();

    if (!before) {
      throw new Error('the start rectangle has no handle to drag');
    }

    // Seeded from the preset it replaced, so the camera opens on the full frame.
    expect(await sceneTransform(page)).toBe('translate(0%, 0%) scale(1)');

    await page.mouse.move(
      before.x + before.width / 2,
      before.y + before.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(before.x - 80, before.y - 80, {steps: 8});
    await page.mouse.up();

    const after = await handle.boundingBox();

    expect(after?.x).toBeLessThan(before.x);
    // A tighter opening region means frame 0 is zoomed in — the transform the
    // renderer will use, read straight off the element.
    const transform = await sceneTransform(page);

    expect(transform).not.toBe('translate(0%, 0%) scale(1)');
    expect(transform).toMatch(/scale\(1\.\d+\)/);

    // And the pair survives a reload, like any other project state.
    await expect(page.getByTestId('editor-save-state')).toContainText('저장됨');
    await page.reload();
    await expect(page.getByTestId('inspector-template')).toContainText('반복 2회');
    await expect(page.getByTestId('kv-slot-motion')).toHaveValue('custom');
    await expect(page.getByTestId('kv-motion-overlay')).toBeVisible();
  });
});
