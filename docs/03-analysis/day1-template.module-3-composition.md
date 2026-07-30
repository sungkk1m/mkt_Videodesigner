# Day1 Template — Module 3 Evidence: Split Composition

> **Feature**: day1-template
> **Module**: 3 — `Day1Composition` + `SplitFrame` (흑백·분할선·라벨) + 2소스 렌더 재측정
> **Date**: 2026-07-28
> **Design**: [day1-template.design.md](../02-design/features/day1-template.design.md) §2.2, §5.1, §5.2
> **선행**: [module-1](day1-template.module-1-schema.md) ✅ · [module-2](day1-template.module-2-domain.md) ✅

---

## 1. What Shipped

| 파일 | 상태 | 내용 |
|------|:----:|------|
| [Day1Composition.tsx](../../src/compositions/Day1Composition.tsx) | 신규 | 구간 3개 Sequence + AudioLayer |
| [day1/SplitFrame.tsx](../../src/compositions/day1/SplitFrame.tsx) | 신규 | 패널 2개, 분할선, 라벨 오버레이 |
| [shared/AudioLayer.tsx](../../src/compositions/shared/AudioLayer.tsx) | 신규 | ThreeSceneComposition 내부 정의를 추출 |
| [types.ts](../../src/domain/editor/types.ts) | 수정 | `Day1Props` 렌더 계약 |
| [project.ts](../../src/domain/editor/project.ts) | 수정 | `day1Of`, `DEFAULT_DAY1_SETTINGS`, `buildDay1Props` |
| [ThreeSceneComposition.tsx](../../src/compositions/ThreeSceneComposition.tsx) | 수정 | AudioLayer import로 교체 (−38줄) |
| [test/fixtures/project.ts](../../src/test/fixtures/project.ts) | 수정 | `day1ProjectFixture` |
| [day1Props.test.ts](../../src/domain/editor/day1Props.test.ts) | 신규 | 유닛 13개 |
| `tests/fixtures/gameplay-sample-b.mp4` | 신규 | 두 번째 소스 (gitignored) |

### 1.1 두 번째 소스 픽스처 — module-2 블로커 해제

module-2가 Google Drive 클라우드 전용 파일이라 못 읽었던 항목이다. 이번 세션에
`영상 3_번개_초안.mp4`를 로컬로 전달받아 해결했다.

| | 첫 번째 (`gameplay-sample.mp4`) | 두 번째 (`gameplay-sample-b.mp4`) |
|---|---|---|
| 해상도 | 1920×1080 (가로) | 1080×1920 (세로) |
| 길이 | 12초 | 12초 (원본 22.1초에서 앞 12초) |
| fps | 30 | 30 |
| 크기 | 234KB | 3.6MB |
| 내용 | 어두운 게임플레이 | 번개 이펙트 (고동세) |

원본은 2160×3840 / 22.1초 / 14.9MB였다. 1080×1920으로 축소하고 12초로 잘랐다.
가로·세로가 서로 반대이고 내용도 완전히 달라서 "눈에 띄게 다른 영상" 조건을
만족한다. 3.6MB는 첫 픽스처보다 크지만 번개 영상의 동세가 높아 이 이하로는
품질이 무너진다. 디코더 인스턴스 2개의 메모리 실측이 목적이라 출력 규격과 같은
1080×1920을 유지했다.

---

## 2. Design 대비 결정과 편차

### 2.1 `buildDay1Props`는 `Day1Props | null`을 반환한다

`buildCompositionProps`는 템플릿이 안 맞으면 빈 스냅샷을 돌려준다. Day1은 그
방식을 따르지 않고 `null`을 반환한다.

근거: 3장면은 `src === null`일 때 "영상을 업로드하세요"를 띄우는 의미 있는
프레임이 있지만, Day1은 페이로드 없이 그릴 화면 자체가 없다. `null`이면 호출자의
템플릿 분기 누락이 **컴파일 에러**가 된다. module-6 렌더 통합에서 이 계약이
그대로 게이트로 쓰인다.

### 2.2 비활성 패널 volume에 `duckedVolumeAt`을 쓰지 않았다 — Design §5.2 편차

Design §5.2는 활성 패널 volume을 "기존 `duckedVolumeAt`으로 계산"이라고 썼다.
구현은 `volume={originalVolume}` 상수로 넣었다.

근거: Plan §2.2가 **Day1의 나레이션·TTS를 범위 밖**으로 뒀다. 나레이션이 없으면
더킹 윈도우가 빈 배열이고, `duckedVolumeAt(frame, v, [], envelope)`는 항상 `v`를
돌려준다. 즉 함수 호출이 순수한 우회다. 나레이션이 Day1에 들어오는 후속
사이클에서 이 한 줄을 `duckedVolumeAt`으로 바꾸면 된다. `buildDay1Props`가
`audio.ducking`을 스냅샷에 그대로 담고 있으므로 준비는 되어 있다.

BGM은 영향이 없다 — `AudioLayer`가 기존 코드 그대로 처리한다.

### 2.3 엔드카드 구간은 빈 캔버스

Design §11.3이 `EndCardScene`을 module-4로 분리했다. 세 번째 Sequence는 자리만
잡고 `CANVAS_COLOR` 채움이다. module-4는 이 한 줄을 교체하면 된다.

### 2.4 `activeTransform` 파라미터 타입을 넓혔다

```diff
-export const activeTransform = (scene: EditorScene, ratio: AspectRatio)
+export const activeTransform = (target: {transforms: RatioTransforms}, ratio: AspectRatio)
```

Day1 패널과 3장면 씬이 똑같이 `RatioTransforms`를 들고 있어서, 2줄짜리 중복
헬퍼를 만드는 대신 읽기 함수 하나를 공유했다. 기존 호출부 9곳은 그대로 통과한다.
`hasRatioOverride`는 module-5(Day1 인스펙터)가 필요해질 때까지 손대지 않았다.

### 2.5 `DEFAULT_DAY1_SETTINGS`를 domain에 뒀다

Design §3.2의 기본값(`#9ca3af`, 6px, 외곽선 8px 등)을 테스트 픽스처에만 두면
module-5의 템플릿 전환 명령이 같은 숫자를 다시 쓰게 된다. 기존
`DEFAULT_HOOK`/`DEFAULT_CTA` 패턴에 맞춰 `project.ts`에 상수로 올렸다.
라벨 기본 크기만 Design에 수치가 없어 72px로 정했다 (1080폭 기준 GIF 레퍼런스 대비).

---

## 3. 검증

### 3.1 렌더 성능 재측정 — Design §2.3 "남은 확인" 종료

스파이크는 **같은 파일을 두 번 참조**했으므로 디코더 인스턴스가 1개였다. 이번엔
서로 다른 소스 2개로, 그리고 하드코딩한 근사치가 아니라 **실제 출시 컴포지션**으로
측정했다.

조건: 1080×1920 · 60fps · 15초 (900프레임) · h264/aac · `prefer-hardware` · 2회 반복

| 실행 | baseline (ThreeScene) | day1 (2 sources) |
|------|----------------------:|-----------------:|
| 1회차 | 7.89s | 6.93s |
| 2회차 | 7.77s | 6.90s |
| **평균** | **7.83s** | **6.92s** |
| **비율** | | **0.88×** |

**게이트 1.50× 대비 통과.** 스파이크의 0.99×보다 오히려 더 낮다.

| | baseline | day1 |
|---|---:|---:|
| JS heap | 78–83MB | 107–109MB |
| 출력 크기 | 0.36MB | 11.53MB |

**메모리는 실제로 늘었다** — 디코더 인스턴스 2개로 약 +25MB. 스파이크가 확인
못 했던 부분이고, 절대량이 작아 설계 변경 사유는 아니다.

출력 크기 차이(0.36 → 11.53MB)는 성능 문제가 아니라 콘텐츠 차이다. 번개 영상의
동세가 높아 같은 `videoBitrate: 'high'`에서 훨씬 많은 비트를 쓴다.

> 측정은 9:16 15초 한 조합이다. 1:1·16:9와 60초는 여전히 미측정 — module-6
> E2E에서 3규격을 다룰 때 확인 대상.

### 3.2 흑백·분할선·라벨 육안 확인 (Design D11)

Player에 실제 `Day1Composition`을 올려 두 구간을 대조했다.

| | frame 180 (구간 A) | frame 540 (구간 B) |
|---|---|---|
| 패널 A (위, `DAY 1`) | **컬러** 재생 | **흑백** 정지 |
| 패널 B (아래, `DAY 30`) | **흑백** 정지 | **컬러** 재생 |

전환이 구간 경계에서 정확히 뒤집힌다. 라벨은 흰 글씨 + 검은 외곽선으로 두 패널
모두 표시된다.

분할선은 DOM 계산값으로 확인했다: `rgb(56, 189, 248)` = 지정한 `#38bdf8`와 정확히
일치, 폭은 프레임 전체.

> 렌더 결과물 픽셀의 채도(SC2)·hex(SC4) 측정은 module-6 E2E 담당이다. 여기서는
> 프리뷰 레벨 확인까지다. 프리뷰와 렌더가 같은 컴포지션·같은 props를 쓰므로
> 동일하게 나올 것으로 보지만, **검증된 것은 아니다.**

### 3.3 회귀 (SC3)

```
npm test              26 files / 226 tests   passed
npm run build         tsc -b + vite build    passed
npm run test:e2e      18 tests               passed
```

E2E 18개 전량 통과 — `AudioLayer` 추출이 3장면 오디오 경로를 건드리지 않았음을
확인한다. 아키텍처 경계 테스트도 통과: `domain/day1`은 여전히 React·Remotion을
임포트하지 않고, `types.ts` → `domain/day1`는 `import type`이라 런타임 순환이
생기지 않는다.

### 3.4 유닛 13개

| 검증 | |
|------|:--:|
| 픽스처가 v2 스키마를 통과 | ✅ |
| 3장면 프로젝트에 `null` 반환 | ✅ |
| 구간 3개가 프리셋 전체를 빈틈없이 채움 (360/360/180 = 900) | ✅ |
| 활성 패널 매핑 `a`/`b`/`null` | ✅ |
| 패널별 URL·trim 독립 (A: 0→360, B: 60→420) | ✅ |
| 소스 없는 패널은 `url: null` | ✅ |
| 선택 규격의 분할 기하 (16:9 → `horizontal`) | ✅ |
| 규격별 프레이밍 override가 해당 패널에만 적용 | ✅ |
| 라벨이 선택 로케일에서, 없으면 빈 문자열 | ✅ |
| 나레이션 비어 있고 BGM 경로는 유지 | ✅ |
| 스냅샷 deep-freeze | ✅ |
| `buildCompositionProps`가 Day1에서 무해한 빈 스냅샷 | ✅ |

---

## 4. Next — module-4 / module-5

module-3에서 열어둔 것:

- **엔드카드 Sequence가 빈 캔버스** → module-4가 `EndCardScene`으로 교체
- **`renderEditor.ts` 템플릿 분기 없음** → module-6. 지금은 Day1을 렌더 큐에
  넣을 경로가 없다 (의도된 상태, Design §11.3)
- **`day1ProjectFixture`가 테스트 전용** → module-5의 템플릿 전환 명령이
  `DEFAULT_DAY1_SETTINGS`를 써서 domain 명령으로 승격
- **`hasRatioOverride`는 미확장** → module-5 인스펙터에서 패널용으로 넓힌다

Design §11.3 권장 분할대로 다음은 `4,5` 묶음이다.

```bash
/pdca do day1-template --scope module-4
```
