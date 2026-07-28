import {execFile} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

import {chromium} from '@playwright/test';

const execFileAsync = promisify(execFile);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(projectRoot, 'artifacts/render-poc');
const baseUrl = process.env.POC_BASE_URL ?? 'http://127.0.0.1:4173';
const mode = process.env.POC_MATRIX ?? 'required';

const requiredMatrix = [
  {
    id: '15s-30fps-arraybuffer',
    duration: '15',
    fps: '30',
    outputTarget: 'arraybuffer',
  },
  {
    id: '15s-60fps-arraybuffer',
    duration: '15',
    fps: '60',
    outputTarget: 'arraybuffer',
  },
  {
    id: '15s-60fps-web-fs',
    duration: '15',
    fps: '60',
    outputTarget: 'web-fs',
  },
  {
    id: '60s-60fps-web-fs',
    duration: '60',
    fps: '60',
    outputTarget: 'web-fs',
  },
];

const smokeMatrix = [
  {
    id: '1s-30fps-arraybuffer',
    duration: '1',
    fps: '30',
    outputTarget: 'arraybuffer',
    resolution: '360x640',
  },
];

const matrix = mode === 'smoke' ? smokeMatrix : requiredMatrix;

const inspectOutput = async (filePath) => {
  const {stdout} = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate,avg_frame_rate,nb_frames,duration',
    '-of',
    'json',
    filePath,
  ]);

  return JSON.parse(stdout);
};

await mkdir(outputDirectory, {recursive: true});

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-precise-memory-info'],
});
const page = await browser.newPage({acceptDownloads: true});
const results = [];

try {
  // The editor owns `/`; the module-2 PoC surface lives behind this hash.
  await page.goto(`${baseUrl}#render-poc`);
  await page.getByRole('button', {name: '환경 다시 검사'}).click();
  await page.waitForFunction(
    () => {
      const value = document.querySelector(
        '[data-testid="capability-status"]',
      )?.textContent;
      return value?.includes('렌더 가능') || value?.includes('렌더 불가');
    },
    undefined,
    {timeout: 30_000},
  );

  const capabilityStatus = await page.getByTestId('capability-status').innerText();
  if (!capabilityStatus.includes('렌더 가능')) {
    throw new Error(`Render capability gate failed: ${capabilityStatus}`);
  }

  for (const benchmark of matrix) {
    await page.getByLabel('길이').selectOption(benchmark.duration);
    await page.getByLabel('FPS').selectOption(benchmark.fps);
    await page
      .getByLabel('해상도')
      .selectOption(benchmark.resolution ?? '1080x1920');
    await page.getByLabel('출력 방식').selectOption(benchmark.outputTarget);
    await page.getByRole('button', {name: '렌더 시작'}).click();

    await page.getByTestId('render-status').waitFor({
      state: 'visible',
      timeout: 20 * 60 * 1000,
    });
    await page.waitForFunction(
      () => {
        const value = document.querySelector(
          '[data-testid="render-status"]',
        )?.textContent;
        return value?.includes('완료') || value?.includes('실패');
      },
      undefined,
      {timeout: 20 * 60 * 1000},
    );

    const status = await page.getByTestId('render-status').innerText();
    if (!status.includes('완료')) {
      throw new Error(`${benchmark.id} failed: ${status}`);
    }

    const metrics = JSON.parse(
      await page.getByTestId('latest-metrics').innerText(),
    );
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', {name: 'MP4 다운로드'}).click();
    const download = await downloadPromise;
    const outputPath = resolve(outputDirectory, `${benchmark.id}.mp4`);
    await download.saveAs(outputPath);
    const ffprobe = await inspectOutput(outputPath);

    results.push({
      id: benchmark.id,
      metrics,
      ffprobe,
      outputPath,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    browserVersion: await browser.version(),
    mode,
    baseUrl,
    results,
  };
  const reportPath = resolve(outputDirectory, `benchmark-${mode}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await browser.close();
}
