// kv-loop-reference-motion Design §7.2 — the parts judgeable without an
// encoder: the new controls, their defaults, and the blur bookend's DOM. The
// temporal claims (round-trip symmetry, cut boundaries, ramp shape) are proven
// on rendered frames by the M0 spike (artifacts/kv-m0) and finally by the
// real-device pass (SC1-SC7).
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';
import {switchTemplate} from './helpers/template';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);

const openLoopWithTwoKeyVisuals = async (page: Page) => {
  await page.goto('/');
  await switchTemplate(page, 'kv-loop');
  await expect(page.getByTestId('inspector-template')).toContainText('반복 2회');

  for (const index of [0, 1]) {
    await page
      .getByTestId(`kv-slot-${index}-input`)
      .setInputFiles(fixture(`kv-${index + 1}.png`));
  }

  await expect(page.getByTestId('kv-scene-image').first()).toBeVisible();
};

test.describe('reference motion — controls and defaults', () => {
  test.use({actionTimeout: 20_000});

  test('opens a new loop on the reference grammar (FR-R07)', async ({page}) => {
    await openLoopWithTwoKeyVisuals(page);

    await expect(page.getByTestId('kv-round-trip')).toBeChecked();
    await expect(page.getByTestId('kv-round-trip-hint')).toBeVisible();
    await expect(page.getByTestId('kv-transition-number')).toHaveValue('0');
    await expect(page.getByTestId('kv-cut-hint')).toBeVisible();
    await expect(page.getByTestId('kv-fade-out-number')).toHaveValue('0');
    await expect(page.getByTestId('kv-blur-duration-number')).toHaveValue('333');
    await expect(page.getByTestId('kv-blur-amount-number')).toHaveValue('30');
    // 30fps preview: 333ms is the reference's own ten frames.
    await expect(page.getByTestId('kv-blur-hint')).toContainText('10프레임');
  });

  test('paints the bookend at frame 0 and turns off with either zero (FR-R08/R11)', async ({
    page,
  }) => {
    await openLoopWithTwoKeyVisuals(page);

    // The player idles on frame 0 — the deep end of the opening ramp.
    const bookend = page.getByTestId('kv-blur-bookend');
    await expect(bookend).toHaveCSS('filter', /blur\(30px\)/);
    // FR-R10 — the overscan rides the blur.
    await expect(bookend).toHaveCSS('transform', /matrix/);

    await page.getByTestId('kv-blur-amount-number').fill('0');
    await expect(bookend).toHaveCSS('filter', 'none');

    await page.getByTestId('kv-blur-amount-number').fill('30');
    await expect(bookend).toHaveCSS('filter', /blur\(30px\)/);
    await page.getByTestId('kv-blur-duration-number').fill('0');
    await expect(bookend).toHaveCSS('filter', 'none');
  });

  test('keeps the crossfade available above zero (R-3 keeps the option)', async ({
    page,
  }) => {
    await openLoopWithTwoKeyVisuals(page);

    await page.getByTestId('kv-transition-number').fill('400');
    await expect(page.getByTestId('kv-cut-hint')).toHaveCount(0);

    await page.getByTestId('kv-transition-number').fill('0');
    await expect(page.getByTestId('kv-cut-hint')).toBeVisible();
  });

  test('the round trip folds into the slot the inspector edits (FR-R04)', async ({
    page,
  }) => {
    await openLoopWithTwoKeyVisuals(page);

    // Off returns the loop to the stored-project behaviour; the checkbox is
    // loop-wide (D-02), so no per-slot state is involved.
    await page.getByTestId('kv-round-trip').uncheck();
    await expect(page.getByTestId('kv-round-trip-hint')).toHaveCount(0);
    await page.getByTestId('kv-round-trip').check();
    await expect(page.getByTestId('kv-round-trip-hint')).toBeVisible();
  });
});
