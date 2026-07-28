// Module 6 verification: mix controls, ducking, uploaded narration, the
// NARRATION_TOO_LONG render blocker, and the zh-TW upload-required notice.
// Design Ref: §3.3, §3.5, §4.2, §5.5 Audio/TTS, §8.3 scenarios 8-10.
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = resolve(projectRoot, 'tests/fixtures/gameplay-sample.mp4');
const shortNarration = resolve(projectRoot, 'tests/fixtures/narration-short.wav');
const longNarration = resolve(projectRoot, 'tests/fixtures/narration-long.wav');

const uploadFixture = async (page: Page) => {
  await page.getByTestId('source-input').setInputFiles(fixturePath);
  await expect(page.getByTestId('source-metadata')).toContainText(
    'gameplay-sample.mp4',
  );
};

test.describe('module-6 audio and TTS', () => {
  test.setTimeout(5 * 60 * 1000);

  test('mixes original, BGM, ducking, and uploaded narration', async ({page}) => {
    await page.goto('/');
    await uploadFixture(page);
    await page.getByTestId('tab-audio').click();

    await page.getByTestId('audio-original-volume').fill('0.4');
    await expect(page.getByTestId('audio-original-volume')).toHaveValue('0.4');

    // BGM upload exposes its own volume and loop controls.
    await page.getByTestId('audio-bgm-input').setInputFiles(shortNarration);
    await expect(page.getByTestId('audio-bgm-volume')).toBeVisible();
    await expect(page.getByTestId('audio-bgm-loop')).toBeChecked();

    // Ducking is on by default with an adjustable amount.
    await expect(page.getByTestId('audio-ducking')).toBeChecked();
    await page.getByTestId('audio-ducking-gain').fill('0.1');
    await expect(page.getByTestId('audio-ducking-gain')).toHaveValue('0.1');
    await page.getByTestId('audio-ducking').uncheck();
    await expect(page.getByTestId('audio-ducking-gain')).toBeHidden();

    // A 1.5s narration fits the 2s Hook scene.
    await page
      .getByTestId('narration-upload-hook')
      .setInputFiles(shortNarration);
    await expect(page.getByTestId('narration-info-hook')).toContainText('업로드됨');
    await expect(page.getByTestId('narration-info-hook')).toContainText('1.50초');
    await expect(page.getByTestId('narration-too-long-hook')).toBeHidden();
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeEnabled();

    await expect(page.getByTestId('editor-save-state')).toHaveText('저장됨', {
      timeout: 10_000,
    });
  });

  test('blocks the render when narration is longer than its scene', async ({
    page,
  }) => {
    await page.goto('/');
    await uploadFixture(page);
    await page.getByTestId('tab-audio').click();

    // 4s narration in the 2s Hook scene.
    await page.getByTestId('narration-upload-hook').setInputFiles(longNarration);

    await expect(page.getByTestId('narration-too-long-hook')).toContainText(
      '나레이션이 장면보다 깁니다',
    );
    await expect(page.getByTestId('render-blocker')).toBeVisible();
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeDisabled();

    // Removing the track clears the blocker.
    await page
      .getByTestId('narration-info-hook')
      .getByRole('button', {name: '제거'})
      .click();
    await expect(page.getByTestId('render-blocker')).toBeHidden();
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeEnabled();
  });

  test('requires uploaded narration for zh-TW', async ({page}) => {
    await page.goto('/');
    await uploadFixture(page);
    await page.getByTestId('tab-copy').click();
    await page.getByTestId('locale-zh-TW').click();
    await page.getByTestId('tab-audio').click();

    await expect(page.getByTestId('tts-locale-notice')).toContainText(
      '음성 생성을 지원하지 않습니다',
    );
    await expect(page.getByTestId('narration-generate-hook')).toBeDisabled();
    await expect(page.getByTestId('narration-upload-hook')).toBeEnabled();

    // Uploading is the supported path for this locale.
    await page
      .getByTestId('narration-upload-hook')
      .setInputFiles(shortNarration);
    await expect(page.getByTestId('narration-info-hook')).toContainText('업로드됨');

    // Narration is per locale: ko must still be empty.
    await page.getByTestId('tab-copy').click();
    await page.getByTestId('locale-ko').click();
    await page.getByTestId('tab-audio').click();
    await expect(page.getByTestId('narration-info-hook')).toBeHidden();
  });
});
