// Module 3 verification: autosave, reload recovery, assisted relink, and JSON
// portability in a real Chrome profile. Design Ref: §3.6, §5.5 Project dialogs,
// §8.3 scenarios 14-15, §8.4 scenario 8.
import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = resolve(projectRoot, 'tests/fixtures/gameplay-sample.mp4');

const uploadFixture = async (page: Page) => {
  await page.getByTestId('source-input').setInputFiles(fixturePath);
  await expect(page.getByTestId('source-metadata')).toContainText(
    'gameplay-sample.mp4',
  );
};

const expectSaved = async (page: Page) => {
  await expect(page.getByTestId('editor-save-state')).toHaveText('저장됨', {
    timeout: 10_000,
  });
};

test.describe('module-3 persistence and recovery', () => {
  test.setTimeout(3 * 60 * 1000);

  test('autosaves, restores after reload, and relinks the missing source', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByLabel('프로젝트 이름').fill('여름-이벤트');
    await uploadFixture(page);
    await page.getByRole('button', {name: '30초'}).click();
    await expectSaved(page);

    await page.reload();

    // The project comes back from IndexedDB.
    await expect(page.getByLabel('프로젝트 이름')).toHaveValue('여름-이벤트');
    await expect(page.getByTestId('timeline-duration-gameplay')).toHaveText(
      '24.0초',
    );

    // A file chosen through <input type="file"> leaves no reusable handle, so the
    // source must be relinked before the render button becomes available.
    await expect(page.getByTestId('source-repair')).toBeVisible();
    await expect(page.getByTestId('source-repair')).toContainText(
      'gameplay-sample.mp4',
    );
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeDisabled();

    await page.getByTestId('relink-input').setInputFiles(fixturePath);

    await expect(page.getByTestId('source-repair')).toBeHidden();
    await expect(page.getByTestId('source-metadata')).toContainText(
      '디코딩 확인됨',
    );
    // An exact fingerprint match is accepted without a warning.
    await expect(page.getByTestId('relink-verdict')).toBeHidden();
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeEnabled();

    // The relink must not reset the edit that was restored.
    await expect(page.getByTestId('timeline-duration-gameplay')).toHaveText(
      '24.0초',
    );
  });

  test('exports metadata-only JSON and imports it into a new project', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByLabel('프로젝트 이름').fill('내보내기-테스트');
    await uploadFixture(page);
    await expectSaved(page);

    await page.getByTestId('project-menu-toggle').click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', {name: 'JSON 내보내기'}).click(),
    ]);

    const exportPath = await download.path();
    const exported = await readFile(exportPath, 'utf8');

    expect(download.suggestedFilename()).toBe('내보내기-테스트.uavideo.json');
    expect(exported).toContain('"fingerprint": "sha256-');
    expect(exported).not.toContain('blob:');
    expect(exported).not.toContain('base64');
    expect(exported.length).toBeLessThan(1_000_000);

    // A new project clears the surface, then the export restores it.
    await page.getByRole('button', {name: '새 프로젝트'}).click();
    await expect(page.getByLabel('프로젝트 이름')).toHaveValue('ua-video');

    await page.getByTestId('project-menu-toggle').click();
    await page.getByTestId('project-import-input').setInputFiles(exportPath);

    await expect(page.getByLabel('프로젝트 이름')).toHaveValue(
      '내보내기-테스트',
    );
    // Imported media never resolves on its own; relink owns that.
    await expect(page.getByTestId('source-repair')).toBeVisible();
  });

  // Plan SC3 / Day1 Design Ref: §3.6 — a project exported before the v2 schema
  // split must still open, with every field intact, through the real import UI.
  test('imports a v1 project export and upgrades it to v2', async ({page}) => {
    await page.goto('/');
    await page.getByTestId('project-menu-toggle').click();
    await page
      .getByTestId('project-import-input')
      .setInputFiles(resolve(projectRoot, 'tests/fixtures/project-v1.json'));

    await expect(page.getByLabel('프로젝트 이름')).toHaveValue('v1-regression');

    // Section durations survived the move off the individual scenes.
    await expect(page.getByTestId('timeline-duration-hook')).toHaveText('2.5초');
    await expect(page.getByTestId('timeline-duration-gameplay')).toHaveText(
      '9.5초',
    );
    await expect(page.getByTestId('timeline-duration-cta')).toHaveText('3.0초');

    // Per-scene settings came across under templateSettings.
    await expect(page.getByTestId('trim-in')).toHaveValue('1.00');
    await expect(page.getByTestId('subtitle-position')).toHaveValue('top');

    // The source is metadata only after an import, so relink still owns it.
    await expect(page.getByTestId('source-repair')).toBeVisible();

    // Four-locale copy is untouched by the split.
    await page.getByTestId('tab-copy').click();
    await expect(page.getByTestId('copy-hook')).toHaveValue('3일 만에 최강자');
    await expect(page.getByTestId('copy-subtitle-gameplay')).toHaveValue(
      '이렇게 성장했습니다',
    );
    await page.getByTestId('locale-en').click();
    await expect(page.getByTestId('copy-hook')).toHaveValue(
      'Strongest in 3 days',
    );
  });

  test('rejects a JSON file that is not a project export', async ({page}) => {
    await page.goto('/');
    await page.getByTestId('project-menu-toggle').click();
    await page.getByTestId('project-import-input').setInputFiles({
      name: 'not-a-project.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"kind":"something-else"}'),
    });

    await expect(page.getByTestId('project-menu-error')).toContainText(
      'UA Video Designer 프로젝트 파일이 아닙니다',
    );
  });
});
