# day1-label-effects Plan (+경량 설계)

> PDCA cycle: Day1 · Day1(4 video) 패널 라벨에 **텍스트 박스(배경 판) on/off** 와 **글로우 on/off** 를 추가한다.
> 작성일: 2026-08-26 · 브랜치: `claude/label-textbox-effect-toggle-5kayu6` (요청에 따라 main 병합 없음)
> 상태: **Q1–Q4 확정(2026-08-26, 사용자 회신)** · Q5는 내부 코드 정리 항목으로 확인 중 — 확정 후 Do 진입

## Executive Summary

| 관점 | 내용 |
|---|---|
| Problem | 패널 라벨(`Day1`/`Day7` 등)은 흰 글자 + 검은 외곽선 한 가지 스타일뿐이다. 밝거나 복잡한 게임플레이 화면 위에서는 외곽선만으로 가독성이 부족하고, 소재별 톤에 맞춘 라벨 강조 수단이 없다. |
| Solution | 공유 `labelStyle`에 배경 박스 3필드(`showBackground`/`backgroundColor`/`backgroundOpacity`)와 글로우 3필드(`glowEnabled`/`glowColor`/`glowStrengthPx`)를 추가한다. 렌더는 `Panel.tsx`의 라벨 `<span>` 한 곳, UI는 인스펙터 "라벨" 섹션 한 곳. |
| Function UX Effect | 라벨 뒤에 반투명 판을 깔거나 글자에 발광 테두리를 켜서, 배경이 밝은 소재에서도 라벨이 읽힌다. 두 효과는 서로 독립이고 기본은 둘 다 꺼짐 — 기존 프로젝트의 산출물은 픽셀 단위로 동일하다. |
| Core Value | 라벨 가독성을 소재별로 맞출 수 있어, 라벨을 지우고 소재를 다시 만드는 우회가 사라진다. |

## 0. 실현 가능성 결론 (요청 사항에 대한 답)

**둘 다 가능하다. 난이도는 낮고, 두 템플릿이 하나의 코드 경로를 공유하므로 한 번의 변경으로 Day1과 Day1(4 video)에 동시에 적용된다.**

근거 — 이미 존재하는 것들:

| 확인 항목 | 근거 | 의미 |
|---|---|---|
| 두 템플릿이 라벨 렌더를 공유 | `src/compositions/day1/SplitFrame.tsx:55,62` · `src/compositions/day1/QuadFrame.tsx:60` → 둘 다 `Panel`에 같은 `labelStyle` 전달, 라벨 마크업은 `src/compositions/day1/Panel.tsx:33` `PanelLabel` 하나 | 컴포지션 수정은 파일 1곳 |
| 라벨 스타일이 템플릿 공용 1세트 | `day1-quad` Plan Q5 — 네 패널이 하나의 `labelStyle`을 공유 | 필드 추가가 곧 두 템플릿 적용 |
| 커맨드가 이미 두 템플릿 겸용 | `src/domain/editor/project.ts:1303` `updateDay1LabelStyle`는 `day1PanelsOf()`로 day1·day1-quad 모두 처리 (`day1Commands.test.ts:396`(day1), `:877`(quad)) | 신규 커맨드 0건 |
| UI 배선이 이미 `Partial<labelStyle>` | `Day1Inspector.tsx:165` → `EditorWorkspace.tsx:1453` → `projectStore.ts:376` | 스토어·워크스페이스 **수정 불필요** |
| 렌더 props가 스프레드 통과 | `project.ts:2159`(day1), `:2241`(quad) `Object.freeze({...settings.labelStyle})` | 프롭 배선 추가 없음 |
| **배경 박스**가 이미 렌더 산출물에서 동작 | `src/compositions/shared/SubtitleOverlay.tsx:62-64` — 자막의 `showBackground`/`backgroundColor`/`backgroundOpacity`가 같은 렌더러로 MP4에 구워진다 | 신기술 아님, 검증된 CSS |
| **글로우**(text-shadow)가 이미 렌더 산출물에서 동작 | `src/compositions/scenes/HookScene.tsx:93,106` · `src/compositions/kvloop/DisclaimerBar.tsx:35` — 동일 web-renderer 경로 | 신기술 아님, 검증된 CSS |
| 마이그레이션 불필요 전례 | `schema.ts:296` `mode: z.enum(...).default('banner')`, `videoAudioEnabled/Volume`(endcard-audio FR-05) | zod `.default()`만으로 기존 v2 문서가 열림, `PROJECT_SCHEMA_VERSION`은 2 유지 |

주의할 상호작용 하나(설계로 해결, §5.4): 라벨은 `WebkitTextStroke` + `paintOrder: 'stroke'`로 그려진다(`Panel.tsx:55,57`). `text-shadow`는 글리프+외곽선 **뒤**에 깔리므로 글로우는 검은 외곽선 바깥으로 번져 나온다 — 의도한 모습이다. 반면 박스를 켜면 글로우가 **판 안쪽**에서만 보인다(같은 요소의 배경 위에 그림자가 얹히는 CSS 순서). 두 효과 동시 사용은 "약한 조합"이지 버그가 아니며, §7 Q4에서 확정한다.

작업량 추정: 프로덕션 코드 6파일 · 약 90줄, 테스트 4파일 · 약 70줄. 단일 모듈(M1) 한 사이클.

## Context Anchor

| 항목 | 내용 |
|---|---|
| WHY | 밝은 게임플레이 위 라벨 가독성 부족 — 외곽선 두께만으로는 한계 |
| WHO | UA 매니저(에디터 사용자) |
| RISK | 기존 프로젝트 산출물 변화(→ 기본 꺼짐으로 차단), 박스+글로우 동시 사용 시 기대와 다른 모습, `hexToRgba` 중복 |
| SUCCESS | SC1–SC6 충족. 특히 실제 MP4에서 박스 채움색과 글로우 번짐을 픽셀로 증명 |
| SCOPE | `labelStyle` 스키마·기본값·클램프, `Panel.tsx` 라벨 1곳, 인스펙터 "라벨" 섹션 1곳, 관련 unit/e2e. **main 병합 없음** — 다른 기능 진행 중이므로 브랜치에 남긴다 |

## 1. Requirements

- **FR-01 텍스트 박스 on/off**: 라벨 섹션에 "배경 박스" 토글. 켜면 라벨 텍스트 뒤에 반투명 판이 깔린다. 기본 **꺼짐**.
- **FR-02 박스 색·불투명도**: 토글이 켜진 동안에만 "박스 색"(color picker)과 "박스 불투명도"(0–100%) 노출. 기본 `#000000` / 60%. 자막(`SubtitleStyle`)과 동일한 필드 구성·동일한 여백(`0.3em 0.6em`)·모서리(8px)를 쓴다 — 새 상수 없음.
- **FR-03 글로우 on/off**: 라벨 섹션에 "글로우" 토글. 켜면 글자(외곽선 포함) 둘레에 발광이 번진다. 기본 **꺼짐**.
- **FR-04 글로우 색·세기**: 토글이 켜진 동안에만 "글로우 색"과 "글로우 세기"(0–`MAX_LABEL_GLOW_PX`=32px) 노출. 기본 `#ffffff` / 16px. 세기는 blur 반경이며 0이면 효과 없음.
- **FR-05 두 템플릿 동시 적용**: Day1과 Day1(4 video) 모두에 적용된다. 네 패널은 공유 스타일 1세트(day1-quad Q5)를 그대로 따르며 패널별 개별 설정은 만들지 않는다.
- **FR-06 하위 호환**: zod `.default()`만으로 기존 v2 문서가 열린다(마이그레이션 0줄, `PROJECT_SCHEMA_VERSION` 2 유지). 두 효과 모두 기본 꺼짐이므로 **기존 프로젝트의 렌더 결과는 변하지 않는다**.
- **FR-07 미리보기 동등**: 중앙 Player와 최종 렌더는 동일 컴포지션이므로 자동으로 일치한다. 별도 미리보기 코드 없음.

## 2. Success Criteria

- **SC1** 스키마 unit: 새 6필드가 없는 기존 v2 JSON이 파싱되어 `showBackground:false`, `backgroundColor:'#000000'`, `backgroundOpacity:0.6`, `glowEnabled:false`, `glowColor:'#ffffff'`, `glowStrengthPx:16`로 채워진다. 범위 위반(`backgroundOpacity:1.5`, `glowStrengthPx:99`)은 파싱 실패.
- **SC2** 커맨드 unit: `updateDay1LabelStyle` patch로 6필드가 갱신되고, `backgroundOpacity`는 [0,1], `glowStrengthPx`는 [0,32]로 클램프된다. **day1과 day1-quad 두 픽스처 모두**에서 통과(기존 `day1Commands.test.ts` 두 테스트와 같은 짝).
- **SC3** 프롭 unit: `buildDay1Props`/`buildDay1QuadProps`가 6필드를 `labelStyle`로 그대로 통과시킨다.
- **SC4** e2e(L2, DOM): 두 토글이 꺼짐이면 색·수치 필드가 노출되지 않고, 켜면 노출된다. 켠 뒤 미리보기 라벨 요소의 계산 스타일에 `background-color`(지정 rgba)와 `text-shadow`(지정 색·반경)가 존재한다.
- **SC5** e2e(L3, 실렌더 MP4): 박스를 켜고 불투명도 100%·특정 색으로 렌더한 MP4에서, 라벨 판 중심 픽셀이 지정 색과 `CHANNEL_TOLERANCE` 이내로 일치한다(`tests/e2e/helpers/videoSampling.ts` 재사용). 두 효과가 모두 꺼진 렌더는 이전과 동일한 라벨 픽셀을 유지한다(무회귀).
- **SC6** `npm test` + `npm run build`(`tsc -b`) + Day1·Day1(4 video) 기존 e2e 그린.

## 3. Scope

**변경 파일**

| 파일 | 변경 |
|---|---|
| `src/domain/editor/schema.ts:281` | `day1LabelStyleSchema`에 6필드 `.default()` |
| `src/domain/editor/constants.ts` | `MAX_LABEL_GLOW_PX = 32` 1건 (`MAX_LABEL_OUTLINE_WIDTH_PX:182` 옆) |
| `src/domain/editor/types.ts:266` | 렌더 프롭 인터페이스 `Day1LabelStyle`에 같은 6필드 (프롭 빌더 반환 타입이 명시형이라 필수) |
| `src/domain/editor/project.ts:176`, `:1303` | 기본값 6필드 + `updateDay1LabelStyle` 클램프 2건 |
| `src/compositions/day1/Panel.tsx:33` | `PanelLabel`에 배경/여백/모서리 분기와 `textShadow` 분기 |
| `src/features/editor/Day1Inspector.tsx:477` | "라벨" 섹션에 토글 2 + 조건부 필드 4 |

**변경 없음**: `projectStore.ts`, `EditorWorkspace.tsx`(이미 `Partial<labelStyle>` 통과), `SplitFrame.tsx`/`QuadFrame.tsx`, 엔드카드, 자막, 분할선, 3장면·KV 루핑 템플릿.

**Non-goals**: 패널별 개별 라벨 스타일, 라벨 폰트 교체, 애니메이션(맥동하는 글로우), 박스 여백·모서리 반경 노출, 자막(`SubtitleStyle`)에 글로우 추가, main 병합.

## 4. Risks

| 리스크 | 대응 |
|---|---|
| 기존 프로젝트 산출물이 바뀜 | 두 효과 모두 기본 꺼짐(FR-06). SC5 후반부가 무회귀를 픽셀로 고정 |
| 박스+글로우 동시 사용 시 글로우가 판 안쪽에만 보임 | CSS 순서상 정상 동작. §7 Q4로 확정하고 Report에 Decision으로 기록 |
| `hexToRgba` 중복 (`SubtitleOverlay.tsx:19`에 이미 있음) | §7 Q5 — `src/compositions/shared/color.ts`로 순수 이동 권장(레이어 규칙 위반 없음, 아키텍처 테스트 통과) |
| 필드 6개는 "on/off만" 요청보다 넓음 | 색·수치가 없으면 흰 글자에 흰 글로우처럼 무의미한 조합이 생긴다. 자막이 이미 배경 3필드 구성을 쓰므로 일관. 축소안은 §7 Q2·Q3 |
| 4분할에서 글로우가 셀 경계를 넘음 | 패널이 `overflow:hidden`(`Panel.tsx:99` 블록)이라 이웃 셀로 새지 않는다 — e2e 확인 항목에 포함 |
| 렌더 성능 | 정지 텍스트의 `text-shadow`/배경은 프레임당 비용이 무시 가능. `filter: drop-shadow`를 쓰지 않는 이유이기도 하다(§5.4) |

## 5. Design Notes (경량 설계 — endcard-audio 사이클과 동일 방식)

### 5.1 스키마 (`schema.ts`)

```ts
export const day1LabelStyleSchema = z.object({
  fontSize: …, textColor: …, outlineColor: …, outlineWidthPx: …, position: …,
  // day1-label-effects FR-01·FR-02 — 자막과 같은 3필드 구성
  showBackground: z.boolean().default(false),
  backgroundColor: hexColorSchema.default('#000000'),
  backgroundOpacity: z.number().min(0).max(1).default(0.6),
  // FR-03·FR-04
  glowEnabled: z.boolean().default(false),
  glowColor: hexColorSchema.default('#ffffff'),
  glowStrengthPx: z.number().min(0).max(MAX_LABEL_GLOW_PX).default(16),
});
```

`.default()`가 마이그레이션 전부다(endcard-video D-03 / endcard-audio FR-05와 동일).

### 5.2 기본값·커맨드 (`project.ts`)

`DEFAULT_DAY1_SETTINGS.labelStyle`에 같은 6값을 명시(추론 타입이 필수 필드로 요구). `DEFAULT_DAY1_QUAD_SETTINGS`는 기존대로 스프레드 상속이라 자동. `updateDay1LabelStyle`은 기존 `fontSize`/`outlineWidthPx` 클램프 옆에 `backgroundOpacity`(0–1), `glowStrengthPx`(0–`MAX_LABEL_GLOW_PX`) 두 줄 추가.

### 5.3 렌더 프롭

추가 배선 없음 — `Object.freeze({...settings.labelStyle})`가 두 빌더에서 이미 전부를 통과시킨다. `types.ts`의 `Day1LabelStyle`만 같은 모양으로 넓힌다.

### 5.4 컴포지션 (`Panel.tsx` `PanelLabel`)

```ts
backgroundColor: style.showBackground
  ? hexToRgba(style.backgroundColor, style.backgroundOpacity) : 'transparent',
padding: style.showBackground ? '0.3em 0.6em' : 0,
borderRadius: 8,
textShadow: style.glowEnabled
  ? `0 0 ${style.glowStrengthPx}px ${style.glowColor}, 0 0 ${style.glowStrengthPx * 2}px ${style.glowColor}`
  : undefined,
```

- 여백·모서리 값은 `SubtitleOverlay.tsx:62`의 것을 그대로 — 두 오버레이가 같은 규격으로 보이게 하고 새 상수를 만들지 않는다.
- 글로우는 `text-shadow` 2겹(안쪽 선명 + 바깥 확산). **`filter: drop-shadow`를 쓰지 않는다**: drop-shadow는 배경 박스의 사각 외곽까지 발광시켜 "글자 글로우"라는 요청과 어긋나고, 요소 전체를 래스터화해 렌더 비용이 붙는다.
- `paintOrder:'stroke'` + `WebkitTextStroke`는 그대로. 그림자는 외곽선 뒤에 깔리므로 검은 테두리 밖으로 번진다.

### 5.5 인스펙터 (`Day1Inspector.tsx` 라벨 섹션, 외곽선 두께 필드 아래)

`SceneInspector.tsx:308-345`의 자막 배경 UI 패턴을 그대로 따른다 — `label.field.field--toggle` + 켜졌을 때만 하위 필드 노출.

| 컨트롤 | testId | 컴포넌트 |
|---|---|---|
| 배경 박스 토글 | `day1-label-background` | `input[type=checkbox]` |
| 박스 색 | `day1-label-background-color` | `ColorField` |
| 박스 불투명도 | `day1-label-background-opacity` | `PercentField` |
| 글로우 토글 | `day1-label-glow` | `input[type=checkbox]` |
| 글로우 색 | `day1-label-glow-color` | `ColorField` |
| 글로우 세기 | `day1-label-glow-strength` | `PlainField`(px) |

섹션 배지는 현행(`위치`) 유지 — 배지에 효과 상태까지 넣으면 좁은 폭에서 잘린다.

### 5.6 테스트 배치

`schema.test.ts`(SC1) · `day1Commands.test.ts`(SC2) · `day1Props.test.ts`(SC3) · 신규 `tests/e2e/day1-label-effects.spec.ts`(SC4·SC5). 기존 스펙은 수정하지 않는다 — 기본 꺼짐이라 기존 단언이 그대로 성립한다.

## 6. Work Breakdown (Do 진입 시)

```
1. 스키마 + 상수 + 타입 6필드 → verify: SC1 unit 그린
2. 기본값 + 클램프                → verify: SC2 unit 그린 (day1 · quad 양쪽)
3. Panel.tsx 라벨 렌더            → verify: SC3 unit + npm run build
4. 인스펙터 토글·필드             → verify: SC4 e2e(DOM)
5. 실렌더 픽셀 검증               → verify: SC5 e2e(MP4), SC6 전체 스위트
```

## 7. Checkpoint — 5건 (2026-08-26 사용자 회신 반영)

| # | 질문 | 권장 | 확정 |
|---|---|---|---|
| Q1 | "텍스트 박스"는 (a) 글자 뒤 **반투명 채움 판**인가, (b) 글자를 두르는 **테두리 사각형**인가? | **(a)** — 자막 "배경 사용"과 같은 개념이고 가독성 목적에 직접 부합 | **(a) 채움 판** ✅ |
| Q2 | 박스는 on/off만 둘까, 색·불투명도까지 열까? | **색·불투명도까지** — 자막과 동일 구성(3필드). 다크 판 하나로 고정하면 밝은 톤 소재에서 못 쓴다 | **권장안 채택 — 색·불투명도 노출** ✅ |
| Q3 | 글로우는 on/off만 둘까, 색·세기까지 열까? | **색·세기까지** — 기본 흰 글자에 흰 글로우 고정이면 소재에 따라 안 보인다 | **권장안 채택 — 색·세기 노출** ✅ |
| Q4 | 박스와 글로우 **동시** 사용 시 글로우가 판 안쪽에만 보이는 동작을 허용할까, 아니면 배타(하나 켜면 하나 꺼짐)로 둘까? | **허용(독립 토글)** — 배타 처리는 사용자가 원한 조합을 막는다. 대신 Report에 동작을 명기 | **권장안 채택 — 독립 토글, 동시 사용 허용** ✅ |
| Q5 | `hexToRgba`를 `src/compositions/shared/color.ts`로 순수 이동하고 자막이 그것을 import하게 할까(1줄 변경), 복제할까? | **이동** — 복제 금지 원칙, 아키텍처 테스트 영향 없음 | 확인 중 (산출물에는 영향 없는 내부 정리 항목) |

기본값은 Q2·Q3의 권장안 채택에 포함된 것으로 보아 그대로 확정한다: 박스 `#000000` / 60%,
글로우 `#ffffff` / 16px, **둘 다 기본 꺼짐**. 다른 값을 원하면 Do 진입 전에 바꾼다.

### 7.1 Q5가 무엇인가 (내부 코드 정리 항목)

색은 `#000000` 형태로 저장되지만 반투명하게 칠하려면 `rgba(0, 0, 0, 0.6)` 형태가 필요하다.
그 변환을 하는 6줄짜리 함수 `hexToRgba`가 이미 자막 쪽(`SubtitleOverlay.tsx:19`)에 있고,
라벨 박스도 같은 변환이 필요해진다. 선택지는 둘뿐이며 **산출물(영상·UI)은 어느 쪽이든 동일**하다.

| 안 | 내용 | 대가 |
|---|---|---|
| A (권장) | 함수를 `src/compositions/shared/color.ts`로 옮기고 자막·라벨이 함께 쓴다 | 자막 파일에 import 1줄 변경이 생긴다(기존 자막 e2e가 회귀를 잡는다) |
| B | 같은 6줄을 라벨 파일에 복사한다 | 자막 파일을 건드리지 않지만 같은 코드가 두 벌이 된다 |

## 8. 병합 정책

이번 사이클은 요청대로 `main`에 병합하지 않는다. 문서와 (승인 후) 구현 모두 `claude/label-textbox-effect-toggle-5kayu6`에 남기고, 진행 중인 다른 기능이 정리된 뒤 별도로 병합 여부를 결정한다.
