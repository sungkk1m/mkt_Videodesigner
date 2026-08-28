// steam-review Design Ref: §12.2 — the store page template end to end.
//
// L1 is DOM-only and cheap: the switch dialog's 20s coercion note, the single
// 20s preset, the pinned Korean fourth tag (D-6), the §3.6 required-material
// blockers, and the one-section timeline. L2 renders real MP4s — ko across all
// three ratios — and verifies the reference's output contract off the files:
// 20.0s, the ratio's resolution, H.264 + AAC (Plan §1.1).
import {mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';

import {probeVideo} from './helpers/videoSampling';
import {chooseTemplate} from './helpers/template';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);
const outputDirectory = resolve(projectRoot, 'artifacts/steam-review');

const GAMEPLAY = fixture('steam-gameplay-22s.mp4');
const KEY_ART = fixture('steam-keyart.png');
const THUMBNAILS = [1, 2, 3, 4].map((index) => fixture(`kv-${index}.png`));

const RENDER_TIMEOUT = 10 * 60 * 1000;

const RATIOS = [
  {label: '9:16', width: 1080, height: 1920},
  {label: '1:1', width: 1080, height: 1080},
  {label: '16:9', width: 1920, height: 1080},
] as const;

const selectSteamReview = async (page: Page) => {
  // Plan Q2 — the dialog says the preset is being forced to 20s before it
  // happens, the same contract day1-quad's 60s coercion has.
  await chooseTemplate(page, 'steam-review');
  await expect(
    page.getByTestId('template-switch-duration-note'),
  ).toContainText('20초');
  await page.getByTestId('template-switch-confirm').click();
  await expect(page.getByTestId('inspector-template')).toContainText(
    '스팀리뷰',
  );
};

const uploadRequiredAssets = async (page: Page) => {
  await page.getByTestId('steam-source-input').setInputFiles(GAMEPLAY);
  await expect(page.getByTestId('steam-source-blocker')).toHaveCount(0);

  await page.getByTestId('steam-keyart-input').setInputFiles(KEY_ART);

  for (const [index, file] of THUMBNAILS.entries()) {
    await page.getByTestId(`steam-thumb-${index}-input`).setInputFiles(file);
  }
};

test('switch, guards, and copy lock work without a render', async ({page}) => {
  await page.goto('/');
  await selectSteamReview(page);

  // Q2 — the preset row offers 20s and nothing else.
  await expect(
    page.getByRole('group', {name: '전체 길이'}).getByRole('button'),
  ).toHaveText(['20초']);

  // §5 — one section means no draggable boundary on the timeline.
  await expect(page.getByRole('slider', {name: /경계/})).toHaveCount(0);

  // D-6 — the Korean fourth tag arrives pinned and uneditable.
  await page.getByRole('button', {name: '카피'}).click();
  await expect(page.getByTestId('copy-steam-tag-3')).toBeDisabled();
  await expect(page.getByTestId('copy-steam-tag-3')).toHaveValue(
    '확률형 아이템 포함',
  );
  await page.getByTestId('locale-en').click();
  await expect(page.getByTestId('copy-steam-tag-3')).toBeEnabled();
  await page.getByTestId('locale-ko').click();

  // §3.6 — with no material, Batch preflight names the gameplay gap, the key
  // art, and the thumbnails for the selected 9:16 target.
  await page.getByTestId('open-batch').click();
  await page.getByTestId('batch-start').click();
  const preflight = page.getByTestId('batch-preflight');
  await expect(preflight).toContainText('게임플레이 영상이 없는 언어');
  await expect(preflight).toContainText('키아트');
  await expect(preflight).toContainText('썸네일');
  await page.getByTestId('batch-close').click();

  // Filling the material clears every §3.6 blocker.
  await page.getByRole('button', {name: '소재'}).click();
  await uploadRequiredAssets(page);
  await expect(page.getByTestId('steam-unresolved-blocker')).toHaveCount(0);
});

test('renders ko across all three ratios at the reference contract', async ({
  page,
}) => {
  test.setTimeout(RATIOS.length * RENDER_TIMEOUT);

  await page.goto('/');
  await selectSteamReview(page);
  await uploadRequiredAssets(page);
  await mkdir(outputDirectory, {recursive: true});

  for (const ratio of RATIOS) {
    await page.getByRole('button', {name: ratio.label, exact: true}).click();

    const downloadPromise = page.waitForEvent('download', {
      timeout: RENDER_TIMEOUT,
    });

    await page.getByRole('button', {name: 'MP4 렌더'}).click();
    await expect(page.getByTestId('open-batch')).toBeDisabled();
    await expect(page.getByTestId('open-batch')).toBeEnabled({
      timeout: RENDER_TIMEOUT,
    });
    await expect(page.getByTestId('editor-render-status')).toContainText(
      '완료',
    );

    await page.getByRole('button', {name: '다운로드'}).click();

    const download = await downloadPromise;
    const fileName = download.suggestedFilename();

    // Plan Q12 — `{project}_steamreview_{locale}_{ratio}_20s_{fps}fps.mp4`.
    expect(fileName).toContain('steamreview');
    expect(fileName).toContain('20s');

    const outputPath = resolve(outputDirectory, fileName);

    await download.saveAs(outputPath);

    const probe = await probeVideo(outputPath);
    const video = probe.streams.find(
      (stream) => stream.codec_type === 'video',
    );
    const audio = probe.streams.find(
      (stream) => stream.codec_type === 'audio',
    );

    // Plan §1.1 — the reference contract: 20.0s, H.264 + AAC, the ratio's
    // full resolution.
    expect(Number(probe.format.duration)).toBeGreaterThan(19.9);
    expect(Number(probe.format.duration)).toBeLessThan(20.5);
    expect(video?.codec_name).toBe('h264');
    expect(video?.width).toBe(ratio.width);
    expect(video?.height).toBe(ratio.height);
    expect(audio?.codec_name).toBe('aac');
  }
});
