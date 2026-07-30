# Day1 Template — Module 5 Evidence: Template Selector · Day1 Panel · Inspector · Eyedropper

> **Feature**: day1-template
> **Module**: 5 — 템플릿 선택기, Day1 좌측 패널, Day1 인스펙터, 스포이트
> **Date**: 2026-07-28
> **Design**: [day1-template.design.md](day1-template.design.md) §6.1~§6.4
> **선행**: [module-1](day1-template.module-1-schema.md) ✅ · [module-2](day1-template.module-2-domain.md) ✅ · [module-3](day1-template.module-3-composition.md) ✅ · [module-4](day1-template.module-4-endcard.md) ✅

---

## 1. What Shipped

| 파일 | 상태 | 내용 |
|------|:----:|------|
| [TemplateSelector.tsx](../../../../src/features/editor/TemplateSelector.tsx) | 신규 | 헤더 세그먼트 + 파괴적 전환 확인 다이얼로그 |
| [Day1AssetPanel.tsx](../../../../src/features/editor/Day1AssetPanel.tsx) | 신규 | 패널 A·B Dropzone·메타데이터·차단 사유·relink |
| [Day1Inspector.tsx](../../../../src/features/editor/Day1Inspector.tsx) | 신규 | 패널 2 + 분할선 + 라벨 + 엔드카드, 5섹션 |
| [ColorField.tsx](../../../../src/features/editor/ColorField.tsx) | 신규 | 컬러 피커 + EyeDropper, 미지원 시 버튼 제거 |
| [useDay1Assets.ts](../../../../src/features/editor/useDay1Assets.ts) | 신규 | 패널·엔드카드 업로드, relink, 복원 시 missing 표시 |
| [inspectorFields.tsx](../../../../src/features/editor/inspectorFields.tsx) | 신규 | `SecondsField`·`RangeField`·`Percent/PlainField`·`AssetField` 공용화 |
| [day1Commands.test.ts](../../../../src/domain/editor/day1Commands.test.ts) | 신규 | Day1 도메인 명령 유닛 26개 |
| [project.ts](../../../../src/domain/editor/project.ts) | 수정 | `switchTemplate` + Day1 명령 13종, `writeTransform` 공용화 |
| [projectStore.ts](../../../../src/features/editor/projectStore.ts) | 수정 | Day1 명령 13종 노출 |
| [EditorWorkspace.tsx](../../../../src/features/editor/EditorWorkspace.tsx) | 수정 | 템플릿 분기 — 선택기·좌측 패널·인스펙터·Player·렌더 게이트·`retain` |
| [SceneInspector.tsx](../../../../src/features/editor/SceneInspector.tsx) | 수정 | 필드 프리미티브를 공용 모듈에서 임포트 (동작 무변경) |
| [SourceRepair.tsx](../../../../src/features/editor/SourceRepair.tsx) | 수정 | `testId`·`inputTestId` 선택 prop (기본값은 기존 3장면 id) |
| [fixtures/project.ts](../../../../src/test/fixtures/project.ts) | 수정 | `day1ProjectFixture`가 실제 `switchTemplate` 위에서 만들어짐 |
| [editor.css](../../../../src/features/editor/editor.css) | 수정 | 스포이트 행·라벨 2열·패널 소제목·좁은 다이얼로그 |

유닛 236 → **262** (+26).

---

## 2. 착수 시 받은 사용자 결정 4건

| 질문 | 결정 | 반영 |
|------|------|------|
| 엔드카드 배너 미업로드 시 렌더 차단? | **경고만, 차단 안 함** | `day1-banner-missing` 안내. FR-D03 차단은 패널 2개에만 |
| Day1의 Hook·나레이션 탭 | **Hook 숨김, 오디오는 BGM·원본볼륨만** | `DAY1_LEFT_TABS` |
| 전환 확인 방식 | **인앱 다이얼로그** | `template-switch-dialog` (E2E 가능) |
| 착수 범위 | **전체 승인** | 아래 전량 구현 |

---

## 3. Design 대비 결정과 편차

### 3.1 Day1의 좌측 레일은 소재·오디오 2탭이다 — Design 미기재

Hook 숨김은 사용자 결정이지만 **카피 탭도 함께 숨겼다.** 카피 패널의 필드는
헤드라인·CTA 문구·장면별 자막으로 전부 3장면 개념이고, Day1의 문구는 패널 라벨
2개뿐이다. 그 라벨은 Design §6.3이 인스펙터에 두라고 지정했으므로, 카피 탭을
남기면 Day1에서 아무 효과 없는 입력칸만 4개 남는다. 판단 근거를 코드 주석에
남겼다([EditorWorkspace.tsx](../../../../src/features/editor/EditorWorkspace.tsx) `DAY1_LEFT_TABS`).

### 3.2 라벨 4언어를 인스펙터에서 한 화면에 편집한다

Design §6.3의 "4언어 문구 A·B"를 로케일 전환기 없이 **4행 × 2열 입력**으로 폈다.
헤더의 로케일 선택을 따라가는 방식(카피 패널 패턴)이면 Day1에서는 4번 전환해야
4언어를 채운다. 그래서 store 명령을 `setDay1LabelAt(locale, panel, value)`로
로케일 명시형으로 두었다. 렌더에 들어가는 것은 선택된 로케일뿐이라는 안내를 붙였다.

### 3.3 필드 프리미티브를 공용 모듈로 뺐다

`SecondsField`·`RangeField`·`PercentField`·`PlainField`·`AssetField`가
`SceneInspector` 내부 지역 컴포넌트였다. Day1 인스펙터가 같은 컨트롤을 쓰므로
복제하면 150줄이 두 벌이 되고 슬라이더 거동이 갈라진다. `inspectorFields.tsx`로
옮기고 두 인스펙터가 임포트한다. `AssetField`만 `slot` 전용 prop을
`kind`·`inputTestId`로 일반화했고 **CTA의 기존 `data-testid`는 그대로다.**

같은 이유로 `writeTransform`·`writeRatioOverride`를 `{transforms}`를 가진 무엇에나
동작하는 헬퍼로 뽑아 장면과 패널이 공유한다. Design §6.3이 예고한
`hasRatioOverride` 확장이 이것이다.

### 3.4 Day1 렌더 버튼은 이번 모듈에서 **막아 둔다**

`renderEditor.ts` 템플릿 분기는 module-6이다. 버튼을 살려두면 3장면 스냅샷으로
잘못된 잡이 돌기 때문에, Day1에서는 MP4 렌더와 Batch를 비활성화하고
`day1-render-pending` 칩으로 사유를 표시한다. 프리뷰는 정상 동작한다.

### 3.5 패널 복원은 relink 프롬프트로 축퇴한다

3장면 소스는 File System Access 핸들을 저장해 새로고침 후 자동 복구된다. 패널에는
그 핸들이 없다(업로드 경로가 Dropzone뿐). 그래서 저장된 프로젝트를 열면
`useDay1Assets`가 해당 패널을 `missing`으로 표시하고 `SourceRepair`를 띄운다.
**relink는 미디어 id를 유지하므로 Trim·프레이밍이 살아남는다** — 재업로드(Dropzone)는
Trim을 0으로 되돌린다. 두 경로를 모두 남긴 이유다.

### 3.6 타임라인 선택 상태를 템플릿별로 분리했다

기존 `selectedKind: SceneKind`에 `'panel-a'`를 담을 수 없다. Day1은 인스펙터가 두
패널을 동시에 보여주므로 선택은 하이라이트만 한다 — 별도 `selectedDay1Section`
문자열 상태를 두고 3장면 경로는 손대지 않았다.

---

## 4. 검증

### 4.1 프리뷰 실측 (dev 서버, Chrome)

`data-testid` 경유로 UI를 조작하고 결과를 DOM·computed style·캔버스 픽셀에서 읽었다.
**코드는 검증용으로 고치지 않았다.**

| 확인 | 실측 | |
|------|------|:--:|
| 템플릿 선택기 → 확인 다이얼로그 | "Day1 비교 템플릿으로 바꿀까요?" 표시, 취소 시 Day1 유지, 확인 시 전환 | ✅ |
| 3장면 ↔ Day1 왕복 | 인스펙터 제목 `Day1 속성` ↔ `장면 속성`, 섹션 5개 생성·소멸 | ✅ |
| Day1 레일 | `🎬소재 · 🔊오디오` 2탭 (3장면은 4탭 유지) | ✅ |
| FR-D03 차단 | 업로드 전 `영상 2개를 모두 올려야 렌더할 수 있습니다. 남은 패널: A · B`, 2개 채우면 사라짐 | ✅ |
| 패널 메타데이터 | A `1920×1080 / 12.00초`, B `1080×1920 / 12.00초` — 서로 다른 소스 2개 | ✅ |
| Trim 클램프 | `소스 구간 0.00s – 6.00s · 구간 6.00s · 원본 12.00s` | ✅ |
| **SC2 흑백 (프리뷰)** | 활성 캔버스 평균 채도 **111**, 비활성 캔버스 `grayscale(1)` 적용 후 **0.00** | ✅ |
| **SC4 분할선 색** | 피커에 `#38bdf8` → 분할선 computed `rgb(56, 189, 248)` | ✅ |
| 분할선 두께 | 18 → `height: 18px`, 섹션 배지 `18px` | ✅ |
| 스포이트 | `day1-split-color-eyedropper` 버튼 존재, 미지원 안내 부재 (Chrome) | ✅ |
| 라벨 4언어 | ko A·B 입력 → 프리뷰 span `["DAY 1", "DAY 30"]` | ✅ |
| 규격별 분할 방향 | 9:16 선 `1080×18 @ y=951` · 16:9 `18×1080 @ x=951` · 1:1 `1080×18 @ y=531` | ✅ |
| 규격별 프레이밍 override | 1:1에서 켜면 배지 `1:1 전용`, 9:16으로 옮기면 `6.00s`로 복귀 | ✅ |
| 배너 미업로드 경고 | 업로드 전 표시, 업로드 후 사라짐, **렌더 차단 없음** | ✅ |
| **SC5 아이콘 정합 (프리뷰)** | 9:16 아이콘 레이어 `left 200 / top 820 / 680×680 / radius 120px` — bannerdesigner CSS 상수와 완전 일치 | ✅ |
| 아이콘 미세조정 | dx 0.1 → left 200→**308** (0.1×1080) · scale 1.2 → 816px 재중심 (240/752) | ✅ |
| 16:9 축퇴 | 안내 `16:9는 자동 배치 좌표가 없습니다` + 아이콘 518.4px 프레임 중앙 | ✅ |
| 패널 relink | 새로고침 후 `연결 필요` → relink로 복구, **Trim 유지** | ✅ |

> 렌더 결과물 MP4 픽셀 기준의 SC2·SC4·SC5 측정은 module-6 E2E 담당이다. 여기서
> 확인한 것은 Player DOM·캔버스 레벨까지다.

### 4.2 회귀 (SC3)

```
npx tsc -b            passed
npm test              27 files / 262 tests   passed
npm run build         tsc -b + vite build    passed
npm run test:e2e      18 tests               passed
```

기존 `data-testid`는 하나도 바뀌지 않았다. `SourceRepair`의 id는 기본값이 기존
`source-repair` / `relink-input`이고 Day1만 override한다.

아키텍처 경계 유지: Day1 명령은 전부 `domain/editor/project.ts`의 순수 함수이고,
`features/`는 store를 통해서만 부른다. `ColorField`가 유일하게 브라우저 API
(EyeDropper)를 만지며 feature detection 안에 갇혀 있다.

### 4.3 유닛 26개

| 검증 | |
|------|:--:|
| `switchTemplate`이 payload·섹션 축을 교체 (양방향) | ✅ |
| 전환 후 v2 스키마 통과 (양방향) | ✅ |
| 공통 필드(이름·copy·audio·render·선택 규격/언어) 보존 | ✅ |
| 30초 프리셋 → `[13500, 13500, 3000]` 합 30_000 | ✅ |
| 같은 템플릿으로 전환은 no-op (동일 참조) | ✅ |
| 패널 소스 설정이 다른 패널을 건드리지 않음 | ✅ |
| 새 소스는 Trim 리셋, relink는 Trim 유지 | ✅ |
| 패널별 status 갱신 | ✅ |
| `day1MissingPanels` 0·1·2개 및 3장면에서 빈 배열 | ✅ |
| Trim in 클램프, Trim out이 창 길이만큼 in을 이동 | ✅ |
| 경계 드래그·프리셋 변경 후 패널 Trim 재클램프 | ✅ |
| override 없으면 base에, 있으면 override에 기록 | ✅ |
| override 켜면 화면 값에서 시작, 끄면 base 무변경 | ✅ |
| 프레이밍 클램프(scale 3 / x ±50)와 초기화 | ✅ |
| 분할선 두께 클램프 24, 색 반영 | ✅ |
| 라벨 fontSize 120 / outline 16 클램프 | ✅ |
| 엔드카드 레이어·프리셋 패치 | ✅ |
| `iconAdjust` 부분 패치 + 클램프 (±0.5 / 0.5~2) | ✅ |
| 로케일별 라벨 기록, 다른 로케일 무영향 | ✅ |
| Day1 명령 8종이 3장면 프로젝트를 건드리지 않음 | ✅ |

---

## 5. Next — module-6

module-5에서 열어둔 것:

- **`renderEditor.ts` 템플릿 분기 없음** → Day1 MP4 렌더·Batch·파일명. 지금은 버튼이
  막혀 있고 `day1-render-pending`으로 사유를 표시한다
- **렌더 결과물 픽셀 기준 SC2·SC4·SC5 측정** → E2E 6종 (Design §8.2)
- **서로 다른 소스 2개로 렌더 시간 재측정** → Design §2.3의 남은 확인. 픽스처
  `tests/fixtures/gameplay-sample-b.mp4` 준비됨
- **v1 → Day1 문서 가져오기 E2E** → SC3 보강
- **문서 갱신** (README·conventions의 템플릿 항목)

```bash
/pdca do day1-template --scope module-6
```
