// The `?debug` report's header, which is what a stalled or surprising render is
// diagnosed from. It gets its own spec because the header is the one artefact a
// user hands over by hand: if it names the wrong template or leaves out the fact
// that decides how a timing reads, the next diagnosis starts in the wrong place.
//
// No codec needed — the header is filled from the project, not from a render.
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = (name: string) => resolve(projectRoot, 'tests/fixtures', name);

const copiedReport = async (page: Page) => {
  await page.getByTestId('copy-debug-log').click();
  await expect(page.getByTestId('copy-debug-log')).toHaveText('복사됨');

  return page.evaluate(() => navigator.clipboard.readText());
};

test.describe('?debug report header', () => {
  test.use({permissions: ['clipboard-read', 'clipboard-write']});

  test('is absent until debug mode is on', async ({page}) => {
    await page.goto('/');
    await expect(page.getByTestId('copy-debug-log')).toHaveCount(0);

    await page.goto('/?debug');
    await expect(page.getByTestId('copy-debug-log')).toBeVisible();
  });

  test('names the looping template, its cycle, and how many key visuals move', async ({
    page,
  }) => {
    await page.goto('/?debug');

    // A three-scene project is the baseline: the looping line has nothing to say
    // and the template is read off the discriminant.
    const threeScene = await copiedReport(page);

    expect(threeScene).toContain('# template: three-scene');
    expect(threeScene).toContain('# kvLoop: n/a');

    await page.getByTestId('template-kv-loop').click();
    await page.getByTestId('template-switch-confirm').click();
    await expect(page.getByTestId('inspector-template')).toContainText('반복 2회');
    await page.getByTestId('kv-count').selectOption('3');

    for (const index of [0, 1, 2]) {
      await page
        .getByTestId(`kv-slot-${index}-input`)
        .setInputFiles(fixture(`kv-${index + 1}.png`));
    }

    // Every key visual moves by default.
    const allMoving = await copiedReport(page);

    // Reading this as `three-scene` is exactly what shipped, and it is why a
    // looping render's header pointed at the wrong composition.
    expect(allMoving).toContain('# template: kv-loop');
    expect(allMoving).toContain('# kvLoop: 3장 · 2회 · 모션 3/3');

    // Holding one still is invisible in the output until the frames are
    // compared, which is the whole reason the count is in the header.
    await page.getByTestId('kv-slot-1-select').click();
    await page.getByTestId('kv-slot-motion').selectOption('still');

    expect(await copiedReport(page)).toContain('# kvLoop: 3장 · 2회 · 모션 2/3');
  });

  test('says whether there was any audio to mix', async ({page}) => {
    await page.goto('/?debug');

    // `audioMixing` costs over a second even with nothing to mix, so a report
    // that omits this cannot tell the cost of the tracks from the cost of
    // silence. A project with audio is not covered here: the narration fixtures
    // are generated, not committed.
    expect(await copiedReport(page)).toContain('# audio: none');
  });
});
