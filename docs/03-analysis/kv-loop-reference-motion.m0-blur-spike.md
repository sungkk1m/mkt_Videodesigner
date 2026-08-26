# kv-loop-reference-motion — M0 컨테이너 블러 스파이크

> **Feature**: kv-loop-reference-motion
> **Date**: 2026-08-26
> **Question**: 컨테이너 `filter: blur()`가 `@remotion/web-renderer`의 래스터화 경로에서 인코딩된 프레임까지 도달하는가 (Design §4.3)
> **Verdict**: **PASS — 컨테이너 블러 채택. 잎 노드 선회 불필요.**

---

## 1. 무엇을 돌렸나

실제 `KvLoopComposition`을 — 대역이 아니라 — `renderMediaOnWeb`으로 90프레임
렌더했다. 3장 × 1회, 홀드 30프레임(1초), 컷 전환, 왕복 켬(강도 1 → 정점 1.2),
블러 10프레임 · 30px, 고지문구 텍스트 포함(D-05의 오버레이 블러 확인용).

| 항목 | 값 |
|---|---|
| 출력 | 1080×1920 · 30fps · 90프레임 · vp9/webm (이 컨테이너에 H.264 없음) |
| 래스터화 경로 | **자체 래스터라이저** — `drawElementImage` 부재 (`nativeHtmlInCanvas: false`) |
| 렌더 시간 | ~30초 |
| 픽스처 | testsrc2 계열 텍스처 3장. 편집기 픽스처(단색)는 중심 줌·블러량이 원리적으로 측정 불가라 별도 생성 |

경로가 중요하다: Plan §1.4가 리스크로 지목한 쪽이 바로 이 **자체 래스터라이저**
(요소별 블러)였고, 이 컨테이너의 Chromium이 정확히 그 경로를 탄다. 네이티브
`html-in-canvas` 경로는 CSS 의미론 그대로라 Player 미리보기와 같은 그림이며,
그 확인은 실기기 게이트(M4)에 남는다.

## 2. 판정 — `node artifacts/kv-m0/verify.mjs`

| 검사 | 결과 | 수치 |
|---|---|---|
| 컷 — 경계에만 스파이크, 크로스페이드 없음 | PASS | 경계 diff 115.1 / 93.7, 홀드 내부 최대 4.6 |
| 왕복 — 정점이 홀드 중앙, 끝은 복귀 | PASS | f31→f44 배율 **1.200** (강도 1의 이론값), f31→f59 **1.000** (rms 0.4) |
| 왕복 대칭 | PASS | 1/4 지점 1.080 = 3/4 지점 1.080 |
| 블러 북엔드 — 양끝만, 본편 선명 | PASS | 램프가 f11에서 끝나고 f79에서 시작 — 요청한 10프레임 그대로 |
| FR-R10 — 가장자리 캔버스색 누출 없음 | PASS | f0 테두리 평균 126 vs 캔버스 ≈13 |

블러 세기: f0의 에지 에너지를 알려진 sigma 매핑과 대조하면 1080 기준
≈20~25px로 읽힌다(요청 30px). 다운스케일 측정·VP9 양자화·오버스캔 확대가 전부
세기를 깎는 방향이라 하한 추정이며, 값 자체가 조절 가능하고 D-10 검수에서
디자이너가 맞추는 항목이다.

육안: f0·f89는 전면 블러(고지문구도 함께 흐려짐 — D-05), f15와 f59는 동일
프레이밍(복귀), f44는 확대 정점.

## 3. 함의

- Design §4.2의 블러 레이어 배치(컨테이너 한 장 + 3σ 오버스캔)를 그대로 간다.
- 요소별 블러의 이론적 차이(겹치는 요소의 가장자리)는 이 컴포지션에서 식별되지
  않았다 — 장면이 불투명 풀프레임이라 겹침 자체가 없다.
- 남은 검증은 M4 하나다: 실기기 Chrome(네이티브 경로 + H.264)에서 같은 판정.

## 4. 재현

```bash
npm run dev -- --host 127.0.0.1 --port 4173   # 별도 셸
node artifacts/kv-m0/run.mjs                   # → artifacts/kv-m0/out/kv-m0-blur.webm
node artifacts/kv-m0/verify.mjs                # 판정 5줄
```

텍스처 픽스처가 없으면 먼저 생성한다 (ffmpeg는 `node_modules/ffmpeg-static`):

```bash
ffmpeg -f lavfi -i "testsrc2=size=1440x1800:rate=1:duration=1" -frames:v 1 artifacts/kv-m0/out/tex-1.png
ffmpeg -f lavfi -i "testsrc2=size=1440x1800:rate=1:duration=1" -vf negate -frames:v 1 artifacts/kv-m0/out/tex-2.png
ffmpeg -f lavfi -i "testsrc2=size=1440x1800:rate=1:duration=1" -vf hue=h=120 -frames:v 1 artifacts/kv-m0/out/tex-3.png
```

실기기에서는 `run.mjs`의 `KV_M0_CHROME`으로 로컬 Chrome을 지정한다.

## Version History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 0.1.0 | 2026-08-26 | 김성권 / Claude | 최초 작성 — 자체 래스터라이저 경로 5/5 PASS |
