import {expect, test} from '@playwright/test';

test('runs a real one-second browser render after capability probing', async ({page}) => {
  await page.goto('/#render-poc');

  await expect(page.getByRole('heading', {name: 'Browser Render PoC'})).toBeVisible();
  await page.getByRole('button', {name: '환경 다시 검사'}).click();
  await expect(page.getByTestId('capability-status')).toContainText('렌더 가능');

  await page.getByLabel('길이').selectOption('1');
  await page.getByLabel('FPS').selectOption('30');
  await page.getByLabel('해상도').selectOption('360x640');
  await page.getByLabel('출력 방식').selectOption('arraybuffer');
  await page.getByRole('button', {name: '렌더 시작'}).click();

  await expect(page.getByTestId('render-status')).toContainText('완료', {
    timeout: 120_000,
  });
  await expect(page.getByTestId('latest-metrics')).toContainText('"outputBytes"');
  await expect(page.getByRole('button', {name: 'MP4 다운로드'})).toBeEnabled();
});
