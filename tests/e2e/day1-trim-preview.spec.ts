// day1-trim-preview Plan SC4/SC6(L2) — the visible range window, the one-shot
// segment playback with its click toggle, and the adjustable looping end-card
// window. Render-path correctness stays covered by day1-endcard-video.spec.ts;
// this file only asserts what the inspector itself answers.
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';
import {ensureTemplate} from './helpers/template';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);

const PANEL_A_SOURCE = fixture('gameplay-sample.mp4');
/** 12s source — long enough that the 3s end-card window actually trims. */
const ENDCARD_LONG = fixture('day1-panel-b.mp4');

const selectDay1 = async (page: Page) => {
  await ensureTemplate(page, 'day1');
  await expect(page.getByTestId('inspector-template')).toHaveText('Day1 비교');
};

const isPaused = (page: Page, testId: string) =>
  page
    .getByTestId(testId)
    .evaluate((element) => (element as HTMLVideoElement).paused);

test.describe('day1-trim-preview — panel playback', () => {
  test.use({actionTimeout: 20_000});

  test('window reads as a range and a drag commit plays the interval once (FR-01/02/03)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectDay1(page);
    await page.getByTestId('day1-panel-a-input').setInputFiles(PANEL_A_SOURCE);

    const strip = page.getByTestId('day1-a-trim-strip');

    await expect(strip.locator('.trim__cell img')).toHaveCount(16, {
      timeout: 30_000,
    });

    // FR-01 — the range styling is present: both grips and the length label.
    const window = page.getByTestId('day1-a-trim-window');

    await expect(window.locator('.trim__grip')).toHaveCount(2);
    await expect(window.locator('.trim__len')).toHaveText('6.0s');

    // Before any commit the resting frame is the sampled <img> (FR-04).
    const video = page.getByTestId('day1-a-trim-video');

    await expect(video).toBeHidden();

    // FR-02 — releasing a drag starts the one-shot playback.
    const track = strip.locator('.trim__track');
    const box = await track.boundingBox();
    const windowBox = await window.boundingBox();

    expect(box).not.toBeNull();
    expect(windowBox).not.toBeNull();

    const start = windowBox as NonNullable<typeof windowBox>;
    const {x, y, width, height} = box as NonNullable<typeof box>;

    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(x + width * 0.4, y + height / 2, {steps: 6});
    await page.mouse.up();

    await expect(video).toBeVisible();
    expect(await isPaused(page, 'day1-a-trim-video')).toBe(false);

    // FR-03 — clicking the stage pauses, clicking again resumes.
    await page.getByTestId('day1-a-trim-playtoggle').click();
    expect(await isPaused(page, 'day1-a-trim-video')).toBe(true);

    await page.getByTestId('day1-a-trim-playtoggle').click();
    expect(await isPaused(page, 'day1-a-trim-video')).toBe(false);
  });
});

test.describe('day1-trim-preview — end-card window length', () => {
  test.use({actionTimeout: 20_000});

  test('shortens the window with the out-handle and reports the loop (FR-05/06)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectDay1(page);
    await page.getByTestId('section-day1-endcard').click();
    await page.getByTestId('day1-endcard-mode-video').click();
    await page.getByTestId('day1-endcard-video').setInputFiles(ENDCARD_LONG);

    // A 12s source opens on the full 3s window: range shown, no loop yet.
    await expect(page.getByTestId('day1-endcard-trim-range')).toContainText(
      '구간 3.00s',
    );
    await expect(page.getByTestId('day1-endcard-loop-note')).toHaveCount(0);

    // FR-05 — the out-handle is a slider; one large step shortens 3.0s to 2.0s.
    const handle = page.getByTestId('day1-endcard-trim-length');

    await expect(handle).toHaveAttribute('aria-valuenow', '3000');
    await handle.focus();
    await handle.press('Shift+ArrowLeft');
    await expect(handle).toHaveAttribute('aria-valuenow', '2000');

    // The readouts follow: range, loop note, and the slot-fill bar.
    await expect(page.getByTestId('day1-endcard-trim-range')).toContainText(
      '구간 2.00s',
    );
    await expect(page.getByTestId('day1-endcard-loop-note')).toContainText(
      '반복 재생',
    );
    await expect(page.getByTestId('day1-endcard-loop-fill')).toBeVisible();

    // Clamped at the 0.5s floor no matter how far it is pushed (FR-05).
    for (let index = 0; index < 4; index += 1) {
      await handle.press('Shift+ArrowLeft');
    }

    await expect(handle).toHaveAttribute('aria-valuenow', '500');

    // And back up, capped at the 3s card.
    for (let index = 0; index < 6; index += 1) {
      await handle.press('Shift+ArrowRight');
    }

    await expect(handle).toHaveAttribute('aria-valuenow', '3000');
    await expect(page.getByTestId('day1-endcard-loop-note')).toHaveCount(0);
  });

  test('keeps the chosen length when the window moves (FR-05)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectDay1(page);
    await page.getByTestId('section-day1-endcard').click();
    await page.getByTestId('day1-endcard-mode-video').click();
    await page.getByTestId('day1-endcard-video').setInputFiles(ENDCARD_LONG);

    const handle = page.getByTestId('day1-endcard-trim-length');

    await handle.focus();
    await handle.press('Shift+ArrowLeft');
    await expect(handle).toHaveAttribute('aria-valuenow', '2000');

    const window = page.getByTestId('day1-endcard-trim-window');

    await window.focus();
    await window.press('Shift+ArrowRight');
    await window.press('Shift+ArrowRight');

    await expect(window).toHaveAttribute('aria-valuenow', '2000');
    await expect(page.getByTestId('day1-endcard-trim-range')).toContainText(
      '소스 구간 2.00s – 4.00s',
    );
    await expect(page.getByTestId('day1-endcard-trim-range')).toContainText(
      '구간 2.00s',
    );
  });
});
