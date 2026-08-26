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
import {chooseTemplate} from './helpers/template';

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
/** The default crossfade, which every boundary sample has to reason about. */
const TRANSITION_MS = 400;

const selectKvLoop = async (page: Page) => {
  // FR-L14 — the dialog must say the ratio is being forced before it happens, so
  // this one goes through `chooseTemplate` and confirms by hand.
  await chooseTemplate(page, 'kv-loop');
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

  // Regression — uploaded key visuals used to vanish from the preview the moment
  // they were adopted. `referencedIds` in EditorWorkspace never listed the
  // kv-loop image ids, and `session.retain` releases every blob URL whose id is
  // absent from the list it is handed, so buildKvLoopProps resolved each slot to
  // null: the composition drew its under-two placeholder and the MP4 렌더 button
  // stayed disabled on `unresolvedKvImages`.
  //
  // The `kv-images-blocker` assertions above could not catch that. That counter
  // reads the project's *references*, which were always correct — only the
  // resolved session URLs were gone. So this test asserts on what the Player
  // actually mounted, which is the same signal the render button gates on.
  test('previews the key visuals it was given, not the placeholder', async ({
    page,
  }) => {
    await page.goto('/');
    await selectKvLoop(page);

    const placeholder = page.getByText('키비주얼 이미지를 2장 이상 올려주세요');

    await expect(placeholder).toBeVisible();

    await page.getByTestId('kv-slot-0-input').setInputFiles(KV_FILES[0] as string);
    await page.getByTestId('kv-slot-1-input').setInputFiles(KV_FILES[1] as string);

    // A segment only mounts while the playhead is inside it, so the opening key
    // visual is the whole preview at frame 0.
    await expect(page.getByTestId('kv-scene-image').first()).toBeVisible();
    await expect(placeholder).toHaveCount(0);
  });

  // A reload keeps the project and loses the pixels: references come back from
  // IndexedDB, session object URLs do not, and an image slot stores no file
  // handle to recover from. `kv-images-blocker` counts references, so it stays
  // silent through all of that — which is how a restored project came to look
  // ready, show its file names, and refuse to render without saying why.
  test('names the key visuals it needs back after a reload', async ({page}) => {
    await page.goto('/');
    await selectKvLoop(page);

    await page.getByTestId('kv-slot-0-input').setInputFiles(KV_FILES[0] as string);
    await page.getByTestId('kv-slot-1-input').setInputFiles(KV_FILES[1] as string);
    await expect(page.getByTestId('kv-scene-image').first()).toBeVisible();

    // Autosave is debounced, so the reload has to wait for it to land.
    await expect(page.getByTestId('editor-save-state')).toContainText('저장됨');

    await page.reload();
    await expect(page.getByTestId('inspector-template')).toContainText('반복 2회');

    // The project survived — and every slot says which file it is missing.
    await expect(page.getByTestId('kv-slot-0-reupload')).toContainText('kv-1.png');
    await expect(page.getByTestId('kv-slot-1-reupload')).toContainText('kv-2.png');
    await expect(page.getByTestId('kv-unresolved-blocker')).toContainText('2장');

    // A dropzone upload leaves no file handle, so the silent restore lands on
    // `missing` rather than on a permission grant.
    await expect(page.getByTestId('kv-slot-0-reupload')).toContainText(
      '이미지를 다시 올려주세요',
    );
    await expect(page.getByTestId('kv-slot-0-grant')).toHaveCount(0);

    // The way out of that for next time is on screen for every slot and for the
    // title. Driving it is not: a stored handle needs the OS file picker, which
    // Playwright cannot open — the same gap `day1-template.spec.ts` records for
    // the identical Day1 panel path.
    await expect(page.getByTestId('kv-slot-0-picker')).toBeVisible();
    await expect(page.getByTestId('kv-slot-1-picker')).toBeVisible();
    await expect(page.getByTestId('kv-title-picker')).toBeVisible();

    // Putting one back clears its own notice and leaves the other standing.
    await page.getByTestId('kv-slot-0-input').setInputFiles(KV_FILES[0] as string);
    await expect(page.getByTestId('kv-slot-0-reupload')).toHaveCount(0);
    await expect(page.getByTestId('kv-slot-1-reupload')).toBeVisible();
    await expect(page.getByTestId('kv-unresolved-blocker')).toContainText('1장');
  });

  // The inspector edits one key visual, the selected one (§6.3), and the
  // selection is React state holding a section id. Two ways it used to end up
  // pointing at a section that does not exist — a reload, which restores the
  // project but leaves the state on its initial `panel-a`, and lowering the
  // count out from under the selected key visual — and both fell through
  // `Math.max(0, -1)`: the inspector read "KV 1" while the timeline leaked the
  // raw id, and every framing or Ken Burns edit went to slot 0 whichever key
  // visual the operator meant.
  test('keeps the inspector on a key visual that exists', async ({page}) => {
    await page.goto('/');
    await selectKvLoop(page);
    await page.getByTestId('kv-count').selectOption('3');

    for (const index of [0, 1, 2]) {
      await page
        .getByTestId(`kv-slot-${index}-input`)
        .setInputFiles(KV_FILES[index] as string);
    }

    // Selecting from the asset panel, next to the images, rather than only by
    // finding the timeline clip.
    await expect(page.getByTestId('kv-slot-0-select')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByTestId('kv-slot-2-select').click();
    await expect(page.getByRole('heading', {level: 2, name: 'KV 3'})).toBeVisible();
    await expect(page.getByText('KV 3 선택됨')).toBeVisible();
    await expect(page.getByTestId('kv-slot-0-select')).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // Dropping to two key visuals removes the one that was selected.
    await page.getByTestId('kv-count').selectOption('2');
    await expect(page.getByRole('heading', {level: 2, name: 'KV 1'})).toBeVisible();
    await expect(page.getByText('KV 1 선택됨')).toBeVisible();

    await page.getByTestId('kv-count').selectOption('3');
    await page.getByTestId('kv-slot-2-select').click();
    await expect(page.getByText('KV 3 선택됨')).toBeVisible();

    await expect(page.getByTestId('editor-save-state')).toContainText('저장됨');
    await page.reload();
    await expect(page.getByTestId('inspector-template')).toContainText('반복 2회');

    // A restored project lands on its own axis, never on Day1's.
    await expect(page.getByText('panel-a 선택됨')).toHaveCount(0);
    await expect(page.getByText('KV 1 선택됨')).toBeVisible();
    await expect(page.getByTestId('kv-slot-0-select')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
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

    await expect(page.getByTestId('timeline-duration-kv-0')).toHaveText('1.9초');

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
    ).toHaveJSProperty('disabled', true);
    await expect(
      page.getByTestId('kv-loop-count').locator('option[value="4"]'),
    ).toHaveJSProperty('disabled', true);

    await page.getByTestId('kv-count').selectOption('6');
    await expect(page.getByTestId('timeline-clip-kv-5')).toBeVisible();
    await expect(page.getByTestId('timeline-duration-kv-0')).toHaveText('1.3초');

    // 30s reopens the combinations 15s could not hold.
    await page.getByRole('button', {name: '30초'}).click();
    await expect(
      page.getByTestId('kv-count').locator('option[value="8"]'),
    ).toHaveJSProperty('disabled', false);
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

    // SC4 — the crossfade is a real blend: a frame inside it matches neither of
    // the two key visuals it sits between.
    //
    // Sampled halfway through the fade, not on the boundary. A crossfade lives
    // inside the *incoming* segment, so it starts at the boundary and ends
    // `transitionMs` later — measured frame by frame on a real 60fps render,
    // the incoming key visual is at 4% opacity on the boundary frame itself and
    // only reaches an even blend at +200ms. Sampling the boundary would compare
    // the outgoing image against itself and fail on a correct render.
    const blended = await centreRgbAt(
      output,
      (HOLD_MS + TRANSITION_MS / 2) / 1000,
    );
    const before = await centreRgbAt(output, (HOLD_MS - TRANSITION_MS) / 1000);
    const after = await centreRgbAt(
      output,
      (HOLD_MS + TRANSITION_MS * 1.5) / 1000,
    );
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
