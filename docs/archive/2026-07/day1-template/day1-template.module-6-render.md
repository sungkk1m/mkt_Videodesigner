# Day1 Template — Module 6 Evidence: Render · Batch · E2E

> **Feature**: day1-template
> **Module**: 6 — 렌더·Batch 통합, E2E 6종, 문서 갱신 (**마지막 모듈**)
> **Date**: 2026-07-30
> **Design**: [day1-template.design.md](day1-template.design.md) §2.1 · §8.2 · §11.3
> **선행**: [module-1](day1-template.module-1-schema.md) ✅ · [module-2](day1-template.module-2-domain.md) ✅ · [module-3](day1-template.module-3-composition.md) ✅ · [module-4](day1-template.module-4-endcard.md) ✅ · [module-5](day1-template.module-5-ui.md) ✅

---

## 1. What Shipped

| 파일 | 상태 | 내용 |
|------|:----:|------|
| [day1-template.spec.ts](../../../../tests/e2e/day1-template.spec.ts) | 신규 | E2E 6종. 렌더 결과물 MP4 픽셀 기준 SC1·SC2·SC4·SC5 |
| [useRenderQueue.test.ts](../../../../src/features/editor/useRenderQueue.test.ts) | 신규 | `preflightIssues` 템플릿 분기 유닛 8개 |
| [renderEditor.ts](../../../../src/infrastructure/render/renderEditor.ts) | 수정 | 템플릿 → 컴포지션 분기, `EditorRenderRequest` 유니온 |
| [ports/index.ts](../../../../src/domain/ports/index.ts) | 수정 | `RenderRequest.snapshot`이 `EditorSnapshot` |
| [types.ts](../../../../src/domain/editor/types.ts) | 수정 | `EditorSnapshot` 태그 유니온 |
| [project.ts](../../../../src/domain/editor/project.ts) | 수정 | `buildEditorSnapshot()` — 템플릿 분기의 단일 지점 |
| [useRenderQueue.ts](../../../../src/features/editor/useRenderQueue.ts) | 수정 | preflight Day1 분기, 잡별 스냅샷을 `buildEditorSnapshot`으로 |
| [EditorWorkspace.tsx](../../../../src/features/editor/EditorWorkspace.tsx) | 수정 | Day1 렌더·Batch 차단 해제, `day1-render-pending` 제거 |
| [renderEditor.test.ts](../../../../src/infrastructure/render/renderEditor.test.ts) | 수정 | Day1 요청 라우팅·규격별 레이아웃 유닛 +5 |
| [generate-editor-fixture.mjs](../../../../scripts/generate-editor-fixture.mjs) | 수정 | 두 번째 소스 + 엔드카드 스틸 픽스처 생성 |
| README.md · conventions.md | 수정 | 템플릿 2종, §3.1 템플릿 규약, 픽스처 생성 커맨드 |

유닛 262 → **274** (+12). E2E 18 → **24** (+6).

---

## 2. Design 대비 결정과 편차

### 2.1 스냅샷에 템플릿 태그를 붙였다 — Design 미기재

Design §2.1은 "`renderEditor.ts`가 `template`으로 컴포지션 분기"라고만 썼다. 문제는
`RenderRequest.snapshot`이 `ThreeSceneProps` 한 종류였다는 점이다.

선택지는 두 개였다. 구조 추론(`'layout' in snapshot`)이냐, 명시적 태그냐.
**태그를 골랐다** — `templateSettings`가 이미 판별 유니온이고, 구조 추론은 세 번째
템플릿이 우연히 같은 필드를 가지면 조용히 깨진다.

```ts
export type EditorSnapshot =
  | {template: 'three-scene'; props: ThreeSceneProps}
  | {template: 'day1'; props: Day1Props};
```

### 2.2 `buildEditorSnapshot()`을 도메인에 뒀다 — 분기가 갈라지지 않게

렌더 진입점은 두 곳이다(헤더의 단일 렌더, Batch 큐). 각자 분기하면 언젠가 어긋난다.
도메인에 함수 하나를 두고 둘 다 부른다. 이 함수는 **null을 반환하지 않는다**:

```ts
const day1Props = buildDay1Props(project, resolveUrl);   // 템플릿이 맞을 때만 non-null
return day1Props
  ? {template: 'day1', props: day1Props}
  : {template: 'three-scene', props: buildCompositionProps(project, resolveUrl)};
```

`buildCompositionProps`가 이미 낯선 템플릿을 빈 스냅샷으로 축퇴시키므로 캐스팅도,
도달 불가능한 에러 분기도 필요 없다. module-3이 `buildDay1Props`를 nullable로 둔
결정([module-3 §2.1](day1-template.module-3-composition.md))이 여기서 값을 했다.

### 2.3 preflight가 템플릿별로 갈라진다 — Design §7 확장

`preflightIssues`는 `threeSceneOf(project)?.source`를 하드코딩하고 있었다. Day1에서는
항상 "영상 소재가 없습니다"가 떴다는 뜻이다(module-5는 Batch 버튼을 막아뒀으므로
표면화되지 않았다). FR-D03에 맞춰 **남은 패널 이름까지** 알려준다.

| 상태 | 메시지 |
|------|--------|
| 패널 0개 | 영상 2개를 모두 올려야 렌더할 수 있습니다. 남은 패널: A · B |
| 패널 1개 | …남은 패널: B |
| 2개지만 미연결 | 패널 영상이 연결되지 않았습니다. 파일을 다시 연결하세요. |

나레이션 블로커 루프는 템플릿 무관하게 뒀다. Plan §2.2가 Day1의 나레이션을 범위 밖으로
뒀고 `narrationBlockers`가 Day1에서 빈 배열을 돌려주므로 분기가 불필요하다.

### 2.4 Batch preflight에 `renderableSource`를 넘긴다

`sourceResolved: source.sourceUrl !== null`은 3장면 소스 훅을 읽는다. Day1에서는 항상
false다. 이미 템플릿별로 계산되던 `renderableSource`를 넘기도록 바꿨다 — 3장면에서는
같은 값이라 회귀가 없다.

### 2.5 두 번째 E2E 소스를 새로 만들었다 — 실제 영상은 픽셀 검증에 못 쓴다

module-3이 준 `gameplay-sample-b.mp4`(번개 이펙트 실촬 영상)는 SC2 측정에
부적합했다. 실측 채도가 **약 23**이다. "흑백 = 채도 0"과 구분이 되지 않는다.

그래서 `day1-panel-b.mp4`를 생성 픽스처로 추가했다 — 1080×1920 세로, 12초,
**패널 A와 겹치지 않는 팔레트**로 초당 한 색. 이러면 샘플 픽셀 하나가 두 가지를 동시에
말해준다: *어느 소스의 몇 초인지*, 그리고 *흑백 처리됐는지*.

`gameplay-sample-b.mp4`는 **건드리지 않았다.** module-3·5의 육안 검증 근거이고
gitignored라 복구가 안 된다. 성능 재측정에 실촬 영상이 필요하면 그 파일을 쓰면 된다
(§4.4의 한계 참고).

엔드카드용 스틸 2개도 생성 픽스처로 넣었다. 단색인 것은 의도다 — SC5는 오버레이의
**바운딩 박스**를 재므로 아이콘 색이 프레임 안에서 유일해야 한다.

### 2.6 E2E에 `actionTimeout`을 걸었다

실렌더 때문에 테스트 타임아웃이 20분이다. Playwright의 기본 action timeout은 0(무제한)
이라, 오타 난 셀렉터 하나가 **20분을 그냥 앉아서 기다린다**. 실제로 이 세션에서
`day1-panel-panelA-input`(실제는 `day1-panel-a-input`)로 두 번 겪었다.
`test.use({actionTimeout: 20_000})`으로 잘못된 셀렉터는 20초에 실패하고 실렌더는
그대로 20분을 쓴다.

---

## 3. 측정 방법에서 배운 것 — 두 가지 함정

Design §8.2는 "프레임을 PNG로 뽑아 `max(R,G,B) − min(R,G,B)`의 평균"을 지정했다.
구현하면서 두 번 틀렸고, 둘 다 **측정 도구의 문제**였지 코드의 문제가 아니었다.

### 3.1 `scale`로 다운샘플하면 크롭 밖을 섞는다

분할선(24px 띠)의 평균색을 `crop=400:12:340:954,scale=1:1`로 뽑으니
`#64afcd`가 나왔다. 지정색은 `#38bdf8`이다. 행 단위로 다시 재보니
y 948~971이 전부 `#38bef8`로 **정확했다**.

원인은 swscale의 bilinear 다운스케일이다. 400배 축소에서 탭이 크롭 경계 밖(패널
픽셀)까지 뻗는다. `scale`을 없애고 **크롭 원본을 JS에서 평균**내니 (56, 189, 247)
— 지정색 (56, 189, 248)과 1 차이다.

> 교훈: ffmpeg의 `scale`은 면적 평균이 아니다. 영역 평균이 필요하면 직접 평균낸다.

### 3.2 Chrome의 `grayscale(1)`은 영상에서 BT.601을 따른다

비활성 패널의 회색을 CSS 필터 스펙의 BT.709 계수
(`0.2126R + 0.7152G + 0.0722B`)로 예측했다. `#e6194b` → 72.2를 기대했는데
렌더 결과는 **90**이었다.

ffmpeg의 `format=gray`(= 영상의 Y 평면, BT.601)로 같은 프레임을 뽑으니 **92**다.
즉 `<Video>` 위의 `grayscale(1)`은 BT.709 RGB 행렬이 아니라 영상의 루마를 따라간다.

그래서 기댓값을 **공식이 아니라 소스에서 측정**하도록 바꿨다. 이게 더 정직하다 —
검증하려던 것은 색공간 계수가 아니라 *어느 프레임이 정지했는지*다.

```ts
const sourceFirstFrameGray = async (path) => /* ffmpeg format=gray, JS 평균 */;
expect(Math.abs(회색 - grayOfB)).toBeLessThanOrEqual(10);
expect(Math.abs(grayOfA - grayOfB)).toBeGreaterThan(30);  // 두 소스가 구별된다
```

마지막 줄이 핵심이다. 패널 A의 회색(90)과 B의 회색(146)이 30 이상 벌어져 있으므로,
"각 패널이 **자기** 소스의 첫 프레임을 정지시킨다"(D11)가 증명된다.

### 3.3 채도 높은 색의 절대 채널값은 4:2:0을 못 견딘다

`#ff00a0`(G=0)이 렌더 후 G=32로 나왔다. H.264 4:2:0 2세대를 거친 결과다.
절대값 비교를 버리고 **최근접 팔레트 매칭**으로 바꿨다 — 기존
[editor-vertical-slice.spec.ts](../../../../tests/e2e/editor-vertical-slice.spec.ts)의
`sourceSecondOf` 패턴과 같다. 더 견고하고, 주장도 더 강하다:
"이 픽셀은 팔레트 3번" = "소스 3초 지점이 화면에 있다".

---

## 4. 검증

### 4.1 SC1 — 3규격 실제 MP4

| 규격 | 해상도 | 코덱 | 길이 | 파일명 |
|------|--------|------|------|--------|
| 1:1 | 1080×1080 | h264 + aac | 15.0초 | `ua-video_ko_1x1_15s_60fps.mp4` |
| 9:16 | 1080×1920 | h264 + aac | 15.0초 | `ua-video_ko_9x16_15s_60fps.mp4` |
| 16:9 | 1920×1080 | h264 + aac | 15.0초 | `ua-video_ko_16x9_15s_60fps.mp4` |

전부 `ffprobe`로 확인. **✅ 충족**

### 4.2 SC2 — 흑백 전환 (렌더 결과물 픽셀)

9:16 출력, 분할선 24px 기준 패널 A는 y 0~947, 선은 948~971, 패널 B는 972~1919.

| 시점 | 구간 | 패널 A | 패널 B |
|------|------|--------|--------|
| t=3s | A 활성 | 팔레트 A[3] (`#4363d8`), 채도 > 60 | **채도 0.0**, 회색 146 ≈ B 첫 프레임 루마 151 |
| t=9s | B 활성 | **채도 0.0**, 회색 90 ≈ A 첫 프레임 루마 92 | 팔레트 B[3] (`#ff00a0`), 채도 > 60 |

두 정지 회색(90 / 146)이 뚜렷이 다르다 → 각 패널이 자기 소스를 정지시킨다(D11).
패널 B의 활성 색이 팔레트 B[3]이다 → 타임라인 9초는 패널 B 자신의 3초다(FR-D06).
**✅ 충족 — module-5의 프리뷰 캔버스 측정에서 MP4 픽셀로 승격**

### 4.3 SC4 — 분할선 색

피커에 `#38bdf8` → 렌더 프레임 분할선 평균 **(56, 189, 247)**. 지정값
(56, 189, 248)과 1 차이. **✅ 충족**

### 4.4 SC5 — 엔드카드 아이콘 정합

9:16 엔드카드 프레임에서 오버레이 색(`#ff00ff`) 픽셀의 바운딩 박스:

| | 측정 | 기대 (`APP_ICON_RECT['9:16']`) | 오차 |
|---|------|------|:----:|
| x | 200 → 879 | 200, 폭 680 | **0px** |
| y | 820 → 1499 | 820, 높이 680 | **0px** |
| 매칭 픽셀 | 449,348 | — | |

허용치 2px 대비 **오차 0px**. bannerdesigner CSS 상수가 렌더 결과물에서 정확히
재현된다. **✅ 충족**

> 검증 프리셋은 `glow`다. Design §5.3에서 유일하게 변형이 없는 프리셋이라 측정된
> 박스가 곧 배치다. `pop`·`pulse`는 시간에 따라 scale이 변하므로 정합 측정에 쓸 수
> 없다(둘 다 scale ≥ 1이라 잔상은 나지 않는다 — module-4에서 검증됨).

### 4.5 SC3 — 회귀

```
npx tsc -b            passed
npm test              28 files / 274 tests   passed
npm run build         tsc -b + vite build    passed
npx playwright test   24 tests               passed   (기존 18 + 신규 6)
```

기존 `data-testid`는 하나도 바뀌지 않았다. 제거한 것은 module-5가 임시로 넣은
`day1-render-pending` 하나뿐이고, 그것을 참조하는 테스트는 없었다.

v1 문서 회귀는 두 겹이다 — 기존 필드 단위 테스트
([persistence-recovery.spec.ts](../../../../tests/e2e/persistence-recovery.spec.ts))에
더해, 이번에 **v1 가져오기 → relink → 실제 MP4 렌더**를 붙였다. 파일명
`v1-regression_ko_9x16_15s_60fps.mp4`, 1080×1920 h264. **✅ 충족**

### 4.6 FR-D14 — Batch

Day1에서 언어 2 × 규격 2 = 4잡을 순차 렌더하고 4개 파일명을 모두 확인했다.

```
ua-video_en_1x1_15s_30fps.mp4    ua-video_en_9x16_15s_30fps.mp4
ua-video_ko_1x1_15s_30fps.mp4    ua-video_ko_9x16_15s_30fps.mp4
```

큐·파일명·프로필·fps 제약은 **무수정 재사용**이다. Option C(D9)의 예측이 맞았다.

### 4.7 Design §2.3 남은 확인 — 서로 다른 소스 2개 렌더 시간

같은 하네스·같은 출력 설정(15초 · 60fps · web-fs)으로 측정했다.

| 구성 | 단독 실행 | 전체 스위트 (5 worker) |
|------|-----:|-----:|
| 3장면 (영상 1개), 9:16 | 7.34s | 7.40s |
| **Day1 (서로 다른 영상 2개), 9:16** | **7.37s** | **7.70s** |
| **비율** | **1.00×** | **1.04×** |

규격별 Day1(단독): 1:1 6.85s · 9:16 7.37s · 16:9 7.38s.
전체 스위트: 1:1 9.86s · 9:16 7.70s · 16:9 7.39s — 1:1이 튄 것은 5개 worker가 CPU를
경합한 결과다. 단독 실행 수치를 기준으로 본다.

**디코더 인스턴스가 2개여도 비용이 늘지 않는다.** 스파이크가 같은 파일을 두 번
참조해 남겨둔 의문([render-spike](day1-template.render-spike.md) §한계)이 해소됐다.
Plan NFR 게이트 1.5× 대비 큰 여유. **✅ 충족**

한계:
- 측정치는 **테스트 하네스의 벽시계**다(UI 왕복 포함). 스파이크의 10.92s와 직접
  비교하면 안 된다 — 스파이크는 `renderMediaOnWeb`을 직접 호출했다. 위 표는
  같은 조건의 3장면 기준선과 나란히 재서 비율만 취했다.
- 소스가 단색 생성 영상이다. 실촬 영상은 디코딩이 더 비싸다. 다만 **두 구성이 같은
  소스 종류를 쓰므로 비율은 유효하다**. 절대 시간이 필요하면
  `gameplay-sample-b.mp4`(실촬)로 다시 재면 된다.
- 60초 프리셋과 메모리 사용량은 미측정이다.

### 4.8 SC6 — 전체 게이트

§4.5의 4개 커맨드 전부 통과. **✅ 충족**

---

## 5. Success Criteria 최종

| # | 기준 | 상태 | 근거 |
|---|------|:----:|------|
| SC1 | 3규격 실제 MP4 | ✅ | §4.1 |
| SC2 | 흑백이 렌더 결과물에 반영 | ✅ | §4.2 — 채도 0.0, 각 패널의 자기 첫 프레임 |
| SC3 | 3장면 무회귀 | ✅ | §4.5 — E2E 24, 유닛 274, v1 렌더까지 |
| SC4 | 분할선 색 | ✅ | §4.3 — 1채널 오차 |
| SC5 | 아이콘 정합 ≤ 2px | ✅ | §4.4 — **0px** |
| SC6 | 유닛·E2E·빌드 통과 | ✅ | §4.5 |

Plan FR-D01 ~ FR-D15 전부 구현·검증 완료.

---

## 6. 남은 것 (별도 사이클)

Design §10이 분리한 항목은 그대로다.

| 항목 | 상태 |
|------|------|
| bannerdesigner app-badge 16:9 레이아웃 | 미착수. 상수가 생기면 `APP_ICON_RECT`에 한 줄. 지금은 D12대로 수동 배치 + 안내 |
| MPEG-4 / HEVC 업로드 호환 확대 | 별도 Plan 존재 (`media-codec-compat.plan.md`) |
| 영상 3개 이상, 가변 분할, 클립 드래그 | Plan §2.2 |
| Day1 나레이션·TTS | Plan §2.2. `buildDay1Props`가 `audio.ducking`을 이미 스냅샷에 담아 준비돼 있다 |
| 60초 프리셋 렌더 시간·메모리 실측 | §4.7 한계 |

```bash
/pdca analyze day1-template
```
