// The default template is Day1, so specs that only need "a project that can
// render" fill its two panels. One place knows the fixture paths and the panel
// inputs, the way `helpers/template.ts` owns the template selector.
import {expect, type Page} from '@playwright/test';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export const PANEL_A_SOURCE = resolve(
  projectRoot,
  'tests/fixtures/gameplay-sample.mp4',
);
export const PANEL_B_SOURCE = resolve(
  projectRoot,
  'tests/fixtures/day1-panel-b.mp4',
);

/**
 * Fills both Day1 panels and waits until the render gate clears. FR-D03 — a
 * panelled render needs every panel present, so the blocker disappearing is the
 * signal that the project is renderable.
 */
export const uploadDay1Panels = async (page: Page) => {
  await page.getByTestId('day1-panel-a-input').setInputFiles(PANEL_A_SOURCE);
  await page.getByTestId('day1-panel-b-input').setInputFiles(PANEL_B_SOURCE);

  await expect(page.getByTestId('day1-panels-blocker')).toHaveCount(0);
};
