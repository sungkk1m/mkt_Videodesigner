// key-visual-looping module-1 회귀망 — the shared section axis, in a browser.
//
// SC8 asks that every existing template still opens and renders after the axis
// widened from a three-tuple to an array. The render half of that needs system
// Chrome for H.264, but everything up to the render is DOM only: clip counts,
// the approved lengths, the boundary handles, the keyboard step, the presets,
// and the Day1 split. Those are what this covers, and it needs no media fixture
// at all — so it runs anywhere the app runs.
import {expect, test} from '@playwright/test';
import {switchTemplate} from './helpers/template';

test.describe('shared time axis — existing templates', () => {
  test('Day1 opens with its three clips and the halfway split', async ({page}) => {
    await page.goto('/');

    await expect(page.getByTestId('template-unsupported')).toHaveCount(0);
    await expect(page.getByTestId('inspector-template')).toHaveText('Day1 비교');
    await expect(page.getByTestId('timeline-duration-panel-a')).toHaveText('6.0초');
    await expect(page.getByTestId('timeline-duration-panel-b')).toHaveText('6.0초');
    await expect(page.getByTestId('timeline-duration-endcard')).toHaveText('3.0초');

    // Three sections give exactly two handles — no third appeared.
    await expect(page.getByTestId('timeline-boundary-0')).toBeVisible();
    await expect(page.getByTestId('timeline-boundary-1')).toBeVisible();
    await expect(page.getByTestId('timeline-boundary-2')).toHaveCount(0);
    await expect(page.getByTestId('day1-panels-blocker')).toBeVisible();

    // The clip markup carries no new attribute from the looping work.
    expect(
      await page.getByTestId('timeline-clip-panel-a').getAttribute('aria-hidden'),
    ).toBeNull();
    expect(
      await page.getByTestId('timeline-clip-panel-a').getAttribute('disabled'),
    ).toBeNull();
  });

  test('boundary keyboard nudge still moves 100ms and keeps the total', async ({page}) => {
    await page.goto('/');

    for (let press = 0; press < 5; press += 1) {
      await page.getByTestId('timeline-boundary-0').press('ArrowRight');
    }

    await expect(page.getByTestId('timeline-duration-panel-a')).toHaveText('6.5초');
    await expect(page.getByTestId('timeline-duration-panel-b')).toHaveText('5.5초');
    await expect(page.getByTestId('timeline-duration-endcard')).toHaveText('3.0초');

    await page.getByTestId('timeline-boundary-1').press('ArrowLeft');
    await expect(page.getByTestId('timeline-duration-panel-b')).toHaveText('5.4초');
    await expect(page.getByTestId('timeline-duration-endcard')).toHaveText('3.1초');
  });

  test('duration presets still reload the approved lengths', async ({page}) => {
    await page.goto('/');
    await page.getByRole('button', {name: '30초'}).click();

    await expect(page.getByTestId('timeline-duration-panel-a')).toHaveText('13.5초');
    await expect(page.getByTestId('timeline-duration-endcard')).toHaveText('3.0초');

    await page.getByRole('button', {name: '60초'}).click();
    await expect(page.getByTestId('timeline-duration-panel-a')).toHaveText('28.5초');
  });

  test('switching three ways leaves each template with its own axis', async ({page}) => {
    await page.goto('/');

    await switchTemplate(page, 'kv-loop');
    await expect(page.getByTestId('timeline-duration-kv-0')).toHaveText('1.9초');

    await switchTemplate(page, 'day1-quad');
    await expect(page.getByTestId('timeline-duration-panel-d')).toBeVisible();

    await switchTemplate(page, 'day1');
    await expect(page.getByTestId('timeline-duration-panel-a')).toHaveText('6.0초');
    await expect(page.getByTestId('ratio-16:9')).toBeEnabled();
  });
});
