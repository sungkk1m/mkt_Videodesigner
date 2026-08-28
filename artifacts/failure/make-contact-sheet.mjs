// failure-video M4 gate (R-2) — one page of the beat, frame by frame, next to
// the numbers Plan §1.2/§1.3/§1.4 measured off the reference. This is the
// artefact the user reviews before M5 starts.
//
//   node artifacts/failure/run-gate.mjs           # writes frames/
//   node artifacts/failure/make-contact-sheet.mjs
import {readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {chromium} from '@playwright/test';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const frames = resolve(projectRoot, 'artifacts/failure/frames');

const SHOTS = [
  ['01-level1-rest', '0.0s · 레벨 1 평상', '캡션 바 10% · 원색'],
  ['02-lead-start', '3.9s · 펀치 줌 시작', 'scale 1→2.2 ease-out 시작'],
  ['03-lead-mid', '4.1s · 줌·탈색 진행', '탈색 램프 중간'],
  ['04-stamp-slam', '4.4s · 스탬프 진입', '≈4× · 불투명 0.6 · 모션블러'],
  ['05-stamp-mid', '4.5s · 스탬프 하강', '블러 감소'],
  ['06-stamp-settled', '4.7s · 안착 + 셰이크', '−8° · 프레임 전체 흔들림'],
  ['07-stamp-hold', '5.0s · 스탬프 유지', '탈색 최대 · 스탬프는 원색'],
  ['08-level1-last', '5.4s · 레벨 1 마지막', '컷 — 펀치가 스탬프를 늘리지 않는다'],
  ['09-level2-first', '5.4s · 레벨 20 첫 프레임', '컷 — 캡션 문구 교체됨'],
  ['10-punch-out', '8.1s · 아웃고잉 펀치', 'scale 2.0 + 블러 (캡션 포함)'],
  ['11-punch-in', '8.1s · 레벨 99 인커밍', '줌 상태에서 진입'],
  ['11b-level3-settled', '8.8s · 레벨 99 안착', '유일한 펀치 전환이 끝난 뒤'],
  ['12-level1-landscape', '가로 1.0s · 평상', '16:9 · 가로 소스 그룹'],
  ['13-stamp-landscape', '가로 5.0s · 스탬프', '바 108px · 같은 상수'],
];

const cards = await Promise.all(
  SHOTS.map(async ([name, title, note]) => {
    const png = await readFile(resolve(frames, `${name}.png`));

    return `<figure>
      <img src="data:image/png;base64,${png.toString('base64')}">
      <figcaption><b>${title}</b><span>${note}</span></figcaption>
    </figure>`;
  }),
);

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<style>
  body{margin:0;padding:32px;background:#0e1014;color:#e7eaf0;
       font-family:system-ui,-apple-system,'Noto Sans KR',sans-serif}
  h1{font-size:22px;margin:0 0 4px}
  p.lede{margin:0 0 24px;color:#98a2b3;font-size:13px;line-height:1.6}
  .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
  figure{margin:0;background:#181c23;border-radius:8px;overflow:hidden}
  img{display:block;width:100%;height:auto;background:#000}
  figcaption{padding:8px 10px;font-size:11px;line-height:1.5}
  figcaption b{display:block;color:#fff}
  figcaption span{color:#8b95a5}
  table{border-collapse:collapse;margin:28px 0 0;font-size:12px}
  th,td{border:1px solid #2a3038;padding:6px 12px;text-align:left}
  th{background:#181c23;color:#98a2b3;font-weight:600}
  td.ok{color:#5ed08a}
</style></head><body>
<h1>failure-video M4 게이트 — FailureComposition 실측</h1>
<p class="lede">
  레퍼런스 mp4는 이 세션에 없습니다(인수인계 §"지금 상태"). 대조 대상은 Plan §1.2·§1.3·§1.4가
  프레임 단위로 박제해 둔 <b>수치</b>이고, 아래 프레임은 목업이 아니라 실제
  <code>FailureComposition</code>을 Player에 마운트해 찍은 것입니다.
  소스는 컨테이너 Chromium이 디코딩할 수 있는 VP9 테스트 패턴입니다(H.264 디코더 부재).
  <br><b>2026-08-28 수정</b>: 사용자 결정에 따라 레벨 1 → 레벨 20 경계는 펀치 전환을 빼고
  컷으로 갑니다. FAIL 비트가 구간 끝에 못 박혀 있어 둘이 마지막 8프레임에서 겹쳤고,
  영상 줌이 순간 4.4배가 됐습니다. 이제 영상에 남는 펀치는 레벨 20 → 레벨 99 하나입니다.
</p>
<div class="grid">${cards.join('')}</div>
<table>
  <tr><th>Plan 실측</th><th>설계 상수</th><th>렌더 실측</th><th>판정</th></tr>
  <tr><td>캡션 바 = 프레임 높이 10%</td><td>FAILURE_CAPTION_RATIO 0.10</td><td>10.00%</td><td class="ok">일치</td></tr>
  <tr><td>캡션 캡 높이 ≈ 3.7%</td><td>fontSize 100 @1920h</td><td>≈3.75%</td><td class="ok">일치</td></tr>
  <tr><td>캡션 폭 ≈ 프레임 40%</td><td>—</td><td>43.9%</td><td class="ok">근사</td></tr>
  <tr><td>스탬프가 좌우로 삐져나감</td><td>WIDTH_RATIO 1.2</td><td>−13.1% ~ 113.1%</td><td class="ok">일치</td></tr>
  <tr><td>스탬프 = 높이 15~55% 구간</td><td>CENTRE_Y_RATIO 0.35</td><td>15.7% ~ 54.3%</td><td class="ok">일치</td></tr>
  <tr><td>안착 회전 −8°</td><td>FAIL_STAMP_ROTATE_DEG −8</td><td>−8.00°</td><td class="ok">일치</td></tr>
  <tr><td>줌 1 → ≈2.2, ease-out 0.6s</td><td>FAIL_ZOOM_SCALE 2.2 / LEAD 500ms</td><td>02~04 프레임</td><td class="ok">일치</td></tr>
  <tr><td>스탬프 진입 ≈4× → 1, 불투명 0.6 → 1</td><td>ENTER_SCALE 4 / ENTER_MS 250</td><td>04~06 프레임</td><td class="ok">일치</td></tr>
  <tr><td>전환 아웃 0.2s 줌인 + 블러</td><td>TRANSITION_OUT_MS 250</td><td>10 프레임</td><td class="ok">일치</td></tr>
  <tr><td>전환 인 0.3s 줌아웃 안착</td><td>TRANSITION_IN_MS 300</td><td>11~11b 프레임</td><td class="ok">일치</td></tr>
  <tr><td>(사용자 결정) 레벨 1은 컷</td><td>failureEdgesAt — out=false</td><td>08~09 프레임, 스탬프 폭 1.26</td><td class="ok">적용</td></tr>
</table>
</body></html>`;

const browser = await chromium.launch({
  headless: true,
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({viewport: {width: 1800, height: 1200}});

await page.setContent(html, {waitUntil: 'load'});
await writeFile(
  resolve(projectRoot, 'artifacts/failure/m4-review.png'),
  await page.screenshot({fullPage: true}),
);
await browser.close();

console.log('artifacts/failure/m4-review.png');
