// Module 3 verification: autosave, reload recovery, assisted relink, and JSON
// portability in a real Chrome profile. Design Ref: §3.6, §5.5 Project dialogs,
// §8.3 scenarios 14-15, §8.4 scenario 8.
import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test, type Page} from '@playwright/test';

import {PANEL_A_SOURCE, uploadDay1Panels} from './helpers/day1Source';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

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
    await uploadDay1Panels(page);
    await page.getByRole('button', {name: '30초'}).click();
    await expectSaved(page);

    await page.reload();

    // The project comes back from IndexedDB.
    await expect(page.getByLabel('프로젝트 이름')).toHaveValue('여름-이벤트');
    await expect(page.getByTestId('timeline-duration-panel-a')).toHaveText(
      '13.5초',
    );

    // A file chosen through <input type="file"> leaves no reusable handle, so the
    // source must be relinked before the render button becomes available.
    await expect(page.getByTestId('day1-panel-a-repair')).toBeVisible();
    await expect(page.getByTestId('day1-panel-a-repair')).toContainText(
      'gameplay-sample.mp4',
    );
    await expect(page.getByRole('button', {name: 'MP4 렌더'})).toBeDisabled();

    await page
      .getByTestId('day1-panel-a-relink')
      .setInputFiles(PANEL_A_SOURCE);

    await expect(page.getByTestId('day1-panel-a-repair')).toBeHidden();
    await expect(page.getByTestId('day1-panel-a-metadata')).toContainText(
      '디코딩 확인됨',
    );
    // An exact fingerprint match is accepted without a warning.
    await expect(page.getByTestId('relink-verdict')).toBeHidden();

    // The relink must not reset the edit that was restored.
    await expect(page.getByTestId('timeline-duration-panel-a')).toHaveText(
      '13.5초',
    );
  });

  test('exports metadata-only JSON and imports it into a new project', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByLabel('프로젝트 이름').fill('내보내기-테스트');
    await uploadDay1Panels(page);
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
    await expect(page.getByTestId('day1-panel-a-repair')).toBeVisible();
  });

  // The three-scene template was removed, so the documents that carried one no
  // longer open. The import has to say that rather than reporting a schema
  // dump, and it must leave the current project alone.
  test('rejects a three-scene project export with a message that says why', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByLabel('프로젝트 이름').fill('그대로-유지');
    await page.getByTestId('project-menu-toggle').click();
    await page
      .getByTestId('project-import-input')
      .setInputFiles(resolve(projectRoot, 'tests/fixtures/project-v1.json'));

    await expect(page.getByTestId('project-menu-error')).toContainText(
      '3장면 템플릿은 더 이상 지원하지 않습니다',
    );
    await expect(page.getByLabel('프로젝트 이름')).toHaveValue('그대로-유지');
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
