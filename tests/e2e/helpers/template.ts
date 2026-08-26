// day1-quad Design §4.3 — one place that knows how the template selector is
// operated. It used to be a button per template, it is a dropdown now, and
// twelve call sites across ten specs had to change for that. They go through
// here instead so the next change touches one file.
import {expect, type Page} from '@playwright/test';

import type {TemplateKind} from '../../../src/domain/editor/types';

/**
 * Picks a template and leaves the destructive-switch dialog open. Use this when
 * the spec asserts something about the dialog before confirming.
 */
export const chooseTemplate = async (page: Page, kind: TemplateKind) => {
  await page.getByTestId('template-selector').selectOption(kind);
  await expect(page.getByTestId('template-switch-dialog')).toBeVisible();
};

/** Picks a template and confirms the switch. */
export const switchTemplate = async (page: Page, kind: TemplateKind) => {
  await chooseTemplate(page, kind);
  await page.getByTestId('template-switch-confirm').click();
};
