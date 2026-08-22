// key-visual-looping Design Ref: §8.2 — the looping template end to end.
//
// L1 is DOM-only and cheap: the template switch, the ratio lock, the count and
// repeat guards, the non-portrait warning, the inheritance badge, and the
// disclaimer hint. L2 renders one real MP4 and reads SC1-SC5 off it, because a
// project with no title and no disclaimer is exactly what SC5 asks for — so the
// same render that proves the loop also proves the overlays are optional.
//
// SC6 (an untranslated locale renders from the English set) needs a second
// render, so it sits behind KV_LOOP_LOCALE=1 the way the other long specs gate
// their extra passes.
import {mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';

import {
  meanRgb,
  nearestPaletteIndex,
  probeVideo,
  sampleRegion,
} from './helpers/videoSampling';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);
const outputDirectory = resolve(projectRoot, 'artifacts/kv-loop');

/** One flat colour per key visual — see `scripts/generate-editor-fixture.mjs`. */
const KV_PALETTE = ['#e6194b', '#3cb44b', '#4363d8', '#ffe119'] as const;
const KV_FILES = KV_PALETTE.map((_, index) => fixture(`kv-${index + 1}.png`));
const KV_LANDSCAPE = fixture('kv-landscape.png');

const RENDER_TIMEOUT = 10 * 60 * 1000;

/** Default 15s project: four key visuals, two repeats, 1.875s each. */
const HOLD_MS = 1875;
const CYCLE_MS = HOLD_MS * 4;

const selectKvLoop = async (page: Page) => {
  await page.getByTestId('template-kv-loop').click();
  await expect(page.getByTestId('template-switch-ratio-note')).toBeVisible();
  await page.getByTestId('template-switch-confirm').click();
  await expect(page.getByTestId('inspector-template')).toContainText('반복 2회');
};

const uploadKeyVisuals = async (page: Page, files = KV_FILES) => {
  for (const [index, file] of files.entries()) {
    await page.getByTestId(`kv-slot-${index}-input`).setInputFiles(file);
  }

  await expect(page.getByTestId('kv-images-blocker')).toHaveCount(0);
};

const renderAndSave = async (page: Page, fileName: string) => {
  const downloadPromise = page.waitForEvent('download', {
    timeout: RENDER_TIMEOUT,
  });

  await page.getByRole('button', {name: 'MP4 렌더'}).click();
  await expect(page.getByTestId('open-batch')).toBeDisabled();
  await expect(page.getByTestId('open-batch')).toBeEnabled({
    timeout: RENDER_TIMEOUT,
  });
  await expect(page.getByTestId('editor-render-status')).toContainText('완료');

  await page.getByRole('button', {name: '다운로드'}).click();

  const download = await downloadPromise;

  await mkdir(outputDirectory, {recursive: true});

  const outputPath = resolve(outputDirectory, fileName);

  await download.saveAs(outputPath);

  return outputPath;
};

/** Which key visual is on screen at `seconds`, by the centre of the frame. */
const keyVisualAt = async (filePath: string, seconds: number) => {
  const pixels = await sampleRegion(filePath, seconds, {
    x: 440,
    y: 860,
    width: 200,
    height: 200,
  });

  return nearestPaletteIndex(meanRgb(pixels), KV_PALETTE);
};

const centreRgbAt = async (filePath: string, seconds: number) => {
  const pixels = await sampleRegion(filePath, seconds, {
    x: 440,
    y: 860,
    width: 200,
    height: 200,
  });

  return meanRgb(pixels);
};

test.describe('looping editor — controls', () => {
  test.use({actionTimeout: 20_000});

  test('locks the output to 9:16 and blocks a render under two key visuals', async ({
    page,
  }) => {
    await page.goto('/');
    await selectKvLoop(page);

    // FR-L14 — vertical only, and the other two ratios say so by being unusable.
    await expect(page.getByTestId('ratio-9:16')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByTestId('ratio-1:1')).toBeDisabled();
    await expect(page.getByTestId('ratio-16:9')).toBeDisabled();
    await expect(page.getByTestId('kv-ratio-locked')).toBeVisible();

    // FR-L13 — two is the floor, and the count is stated rather than implied.
    await expect(page.getByTestId('kv-images-blocker')).toContainText('2장');
    await expect(page.getByTestId('kv-render-blocker')).toBeVisible();

    await page.getByTestId('kv-slot-0-input').setInputFiles(KV_FILES[0] as string);
    await expect(page.getByTestId('kv-images-blocker')).toContainText('1장');

    await page.getByTestId('kv-slot-1-input').setInputFiles(KV_FILES[1] as string);
    await expect(page.getByTestId('kv-images-blocker')).toHaveCount(0);
    await expect(page.getByTestId('kv-render-blocker')).toHaveCount(0);
  });

  test('shows one editable cycle and the repeats as ghosts (FR-L06/§6.4)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectKvLoop(page);
    await uploadKeyVisuals(page);

    for (let index = 0; index < 4; index += 1) {
      await expect(page.getByTestId(`timeline-clip-kv-${index}`)).toBeVisible();
      // Cycle two is drawn but not touchable — editing happens in one place.
      await expect(
        page.getByTestId(`timeline-clip-kv-${index}-repeat-1`),
      ).toBeDisabled();
    }

    await expect(page.getByTestId('timeline-duration-kv-0')).toHaveText('1.88');

    // Only the three inner boundaries of the cycle get handles.
    await expect(page.getByTestId('timeline-boundary-0')).toBeVisible();
    await expect(page.getByTestId('timeline-boundary-2')).toBeVisible();
    await expect(page.getByTestId('timeline-boundary-3')).toHaveCount(0);
  });

  test('refuses a count and repeat that cannot hold a second each (FR-L07)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectKvLoop(page);

    // 15s over eight key visuals twice is 0.94s each.
    await expect(
      page.getByTestId('kv-count').locator('option[value="8"]'),
    ).toBeDisabled();
    await expect(
      page.getByTestId('kv-loop-count').locator('option[value="4"]'),
    ).toBeDisabled();

    await page.getByTestId('kv-count').selectOption('6');
    await expect(page.getByTestId('timeline-clip-kv-5')).toBeVisible();
    await expect(page.getByTestId('timeline-duration-kv-0')).toHaveText('1.25');

    // 30s reopens the combinations 15s could not hold.
    await page.getByRole('button', {name: '30초'}).click();
    await expect(
      page.getByTestId('kv-count').locator('option[value="8"]'),
    ).toBeEnabled();
  });

  test('warns about a landscape key visual and offers to keep it whole (FR-L19)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectKvLoop(page);
    await page.getByTestId('kv-slot-0-input').setInputFiles(KV_LANDSCAPE);

    await expect(page.getByTestId('kv-slot-0-orientation')).toBeVisible();

    const contain = page.getByTestId('kv-slot-0-contain');

    await expect(contain).not.toBeChecked();
    await contain.check();
    await expect(contain).toBeChecked();

    // A portrait key visual earns no warning at all.
    await page.getByTestId('kv-slot-1-input').setInputFiles(KV_FILES[1] as string);
    await expect(page.getByTestId('kv-slot-1-orientation')).toHaveCount(0);
  });

  test('says which locale set is in play, and keeps the copy tab to one field', async ({
    page,
  }) => {
    await page.goto('/');
    await selectKvLoop(page);

    // FR-L04 — English is the inherited set (Plan L4), so fill it and look from
    // Japanese.
    await page.getByTestId('kv-locale-en').click();
    await uploadKeyVisuals(page);
    await expect(page.getByTestId('kv-inherited-badge')).toHaveCount(0);

    await page.getByTestId('kv-locale-ja').click();
    await expect(page.getByTestId('kv-inherited-badge')).toBeVisible();
    await expect(page.getByTestId('kv-images-blocker')).toHaveCount(0);

    // FR-L15 — the copy tab is the disclaimer and nothing else here.
    await page.getByTestId('tab-copy').click();
    await expect(page.getByTestId('copy-hook')).toHaveCount(0);
    await expect(page.getByTestId('copy-kv-disclaimer')).toBeVisible();

    await page.getByTestId('copy-kv-disclaimer').fill('확률형 아이템 포함');
    await expect(page.getByTestId('copy-kv-disclaimer-hint')).toHaveCount(0);

    await page
      .getByTestId('copy-kv-disclaimer')
      .fill('확률형 아이템 포함 · 아주 긴 고지문구가 한 줄에 들어가지 않는 경우');
    await expect(page.getByTestId('copy-kv-disclaimer-hint')).toBeVisible();
  });

  test('hides Hook analysis and narration for a still-image loop (Plan L9)', async ({
    page,
  }) => {
    await page.goto('/');
    await selectKvLoop(page);

    await expect(page.getByTestId('tab-hook')).toHaveCount(0);

    await page.getByTestId('tab-audio').click();
    await expect(page.getByTestId('audio-bgm-input')).toBeAttached();
    await expect(page.getByTestId('audio-ducking')).toHaveCount(0);
  });
});

test.describe('looping render', () => {
  test('renders the loop with no overlays at all (SC1-SC5)', async ({page}) => {
    test.setTimeout(RENDER_TIMEOUT + 120_000);

    await page.goto('/');
    await selectKvLoop(page);
    await uploadKeyVisuals(page);

    // Nothing else is touched: no title, no disclaimer. That is SC5, and it is
    // also the state SC1-SC4 are measured in.
    const output = await renderAndSave(page, 'kv-loop-15s.mp4');

    // SC1 — the file itself.
    const probe = await probeVideo(output);
    const video = probe.streams.find(
      (stream) => stream.codec_type === 'video',
    );
    const audio = probe.streams.find(
      (stream) => stream.codec_type === 'audio',
    );
    const duration = Number(probe.format.duration);

    expect(video?.width).toBe(1080);
    expect(video?.height).toBe(1920);
    expect(video?.codec_name).toBe('h264');
    expect(audio?.codec_name).toBe('aac');
    expect(duration).toBeGreaterThan(14.8);
    expect(duration).toBeLessThan(15.2);

    // SC2 — each key visual is on screen for the hold the timeline promised.
    // Sampled at the middle of each hold, clear of the crossfades either side.
    for (let index = 0; index < 4; index += 1) {
      const seconds = (index * HOLD_MS + HOLD_MS / 2) / 1000;

      expect({index, shown: await keyVisualAt(output, seconds)}).toEqual({
        index,
        shown: index,
      });
    }

    // SC3 — the second cycle is the first one again.
    for (let index = 0; index < 4; index += 1) {
      const offsetMs = index * HOLD_MS + HOLD_MS / 2;
      const first = await centreRgbAt(output, offsetMs / 1000);
      const second = await centreRgbAt(output, (offsetMs + CYCLE_MS) / 1000);

      for (const channel of [0, 1, 2]) {
        expect(
          Math.abs((first[channel] as number) - (second[channel] as number)),
        ).toBeLessThan(12);
      }
    }

    // SC4 — the crossfade is a real blend: the frame on the boundary matches
    // neither of the two key visuals it sits between.
    const boundarySeconds = HOLD_MS / 1000;
    const blended = await centreRgbAt(output, boundarySeconds);
    const before = await centreRgbAt(output, (HOLD_MS - 400) / 1000);
    const after = await centreRgbAt(output, (HOLD_MS + 400) / 1000);
    const distance = (a: readonly number[], b: readonly number[]) =>
      Math.sqrt(
        [0, 1, 2].reduce(
          (sum, channel) =>
            sum + ((a[channel] as number) - (b[channel] as number)) ** 2,
          0,
        ),
      );

    expect(distance(blended, before)).toBeGreaterThan(20);
    expect(distance(blended, after)).toBeGreaterThan(20);
  });

});

// SC6 — a locale nobody produced art for ships the English cut. A second render,
// so it is opt-in like the other long passes in this suite.
test.describe('looping render — inherited locale', () => {
  test.skip(
    process.env.KV_LOOP_LOCALE !== '1',
    'set KV_LOOP_LOCALE=1 to render the inherited-locale pass',
  );

  test('renders an untranslated locale from the English set (SC6)', async ({
    page,
  }) => {
    test.setTimeout(RENDER_TIMEOUT + 120_000);

    await page.goto('/');
    await selectKvLoop(page);
    await page.getByTestId('kv-locale-en').click();
    await uploadKeyVisuals(page);

    const english = await renderAndSave(page, 'kv-loop-en.mp4');

    await page.getByTestId('kv-locale-ja').click();
    await expect(page.getByTestId('kv-inherited-badge')).toBeVisible();

    const japanese = await renderAndSave(page, 'kv-loop-ja.mp4');

    for (let index = 0; index < 4; index += 1) {
      const seconds = (index * HOLD_MS + HOLD_MS / 2) / 1000;

      expect({
        index,
        english: await keyVisualAt(english, seconds),
        japanese: await keyVisualAt(japanese, seconds),
      }).toEqual({index, english: index, japanese: index});
    }
  });
});
