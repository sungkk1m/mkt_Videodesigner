# Day1 Template — Gap Analysis (Check)

> **Feature**: day1-template
> **Date**: 2026-07-30
> **Plan**: [day1-template.plan.md](../01-plan/features/day1-template.plan.md)
> **Design**: [day1-template.design.md](../02-design/features/day1-template.design.md)
> **Do 증거**: [module-1](day1-template.module-1-schema.md) · [module-2](day1-template.module-2-domain.md) · [module-3](day1-template.module-3-composition.md) · [module-4](day1-template.module-4-endcard.md) · [module-5](day1-template.module-5-ui.md) · [module-6](day1-template.module-6-render.md)
> **Match Rate**: 98% → **100% (Gap 전부 수정 후 재검증, §8)**

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 성과가 검증된 Before/After 분할 비교 포맷을 브라우저 안에서 반복 생산하고, 앞으로 UA 포맷을 늘릴 템플릿 기반을 만든다. |
| **WHO** | 사내 UA Manager와 마케터. 기존 3장면 템플릿 사용자와 동일하며, 두 경로를 오간다. |
| **RISK** | 스키마 v1→v2 마이그레이션이 기존 저장 프로젝트를 깨뜨릴 위험, 정지 프레임 디코딩까지 포함한 2영상 렌더 비용, 16:9 엔드카드가 다른 저장소 작업에 막혀 있다는 점. |
| **SUCCESS** | Day1로 영상 2개를 편집해 3규격 각각 실제 MP4를 뽑고, 흑백 전환·분할선 색·엔드카드 애니메이션이 렌더 결과물에서 확인되며, 기존 3장면 프로젝트가 회귀 없이 열리고 렌더된다. |
| **SCOPE** | 16:9 엔드카드(bannerdesigner)와 MPEG-4 호환 확대는 Design 단계에서 별도 사이클로 분리됨. |

---

## 1. 검증 방법

이 분석은 module 증거 문서의 주장을 **재현**했다. Do 문서를 근거로 인용하지 않고,
아래를 이 세션에서 직접 실행·확인했다.

| 축 | 방법 |
|----|------|
| Structural | Design §11.1 파일 목록 대비 실제 트리 확인 |
| Functional | FR-D01~D15를 코드에서 추적, placeholder/미구현 스캔 |
| Contract | 렌더 분기·스냅샷 유니온·마이그레이션 적용 지점 2곳·불변식 코드 확인 |
| Runtime | `npm test` · `npm run build` · `npx playwright test` **전량 재실행** |
| 외부 상수 | `APP_ICON_RECT`를 bannerdesigner 원본 CSS와 직접 대조 |

### 1.1 런타임 재실행 결과 (이 세션)

```
npm test                28 files / 274 tests    passed
npm run build           tsc -b + vite build     passed
npx playwright test     24 tests                passed  (1.2m)
```

E2E 로그의 실측 렌더 시간: Day1 9:16 **7.62s** vs 3장면 9:16 **7.36s** = **1.04×**
(NFR 게이트 1.5×). Day1 1:1 9.57s · 16:9 7.41s.

### 1.2 외부 상수 대조 (독립 검증)

`mkt_bannerdesigner/repo/today-banner-designer.html`을 직접 읽어 대조했다.

| 규격 | 원본 CSS | `endCard.ts` 계산 | 일치 |
|------|----------|-------------------|:----:|
| 1:1 | `top 375 left 282 / 515×515 / radius 96` (1080×1080) | 0.34722 / 0.26111 / 0.47685 / 0.08889 | ✅ |
| 9:16 | `top 820 left 200 / 680×680 / radius 120` (1080×1920) | 0.42708 / 0.18519 / 0.62963·0.35417 / 0.11111 | ✅ |
| 16:9 | **존재하지 않음** (app-badge는 1x1 · 9x16 · 1200x628만) | 없음 → 수동 배치 축퇴 | ✅ D12 근거 확인 |

`.ab-icon` 기본 규칙(line 502)에 좌표를 흔드는 transform이 없다는 것도 확인했다.
D12의 "16:9 좌표가 없다"는 전제가 실제로 사실이다.

---

## 2. Strategic Alignment — 올바른 문제를 풀었나

PRD는 없다(`/pdca pm` 미실행). Plan Executive Summary와 Context Anchor를 기준으로 봤다.

| 질문 | 판정 | 근거 |
|------|:----:|------|
| WHY(외부 편집 도구 없이 비교 포맷 생산)를 달성했나 | ✅ | 업로드 → 편집 → 3규격 MP4가 E2E로 끝까지 돈다. 외부 도구 개입 지점이 없다 |
| "이후 UA 포맷을 스키마 재설계 없이 얹는다"는 기반이 생겼나 | ✅ | `templateSettings` 판별 유니온 + `sections` 공통 축. 3번째 템플릿은 스키마 1곳 + `buildEditorSnapshot` 1곳 |
| WHO(두 경로를 오가는 동일 사용자)를 지켰나 | ✅ | `switchTemplate` 왕복 + 공통 필드 보존이 유닛으로 잠겼고, 3장면 E2E 18개가 무회귀 |
| RISK 1(v1 마이그레이션)이 해소됐나 | ✅ | `migrateProject`가 읽기 전용이고 실패 시 원본을 보존. v1 가져오기 → 실제 MP4 렌더까지 E2E |
| RISK 2(2영상 렌더 비용)가 해소됐나 | ✅ | 서로 다른 소스 2개 실측 1.04× |
| RISK 3(16:9 엔드카드 차단)이 관리됐나 | ⚠️ | 사용자 결정으로 분리. 수동 배치로 축퇴하되 **자동 배치는 미완** (Gap-1) |

Design §1.1의 1순위 목표 "기존 3장면 경로를 한 줄도 바꾸지 않는다"는 문언 그대로는
지켜지지 않았다 — `source`·`scenes`가 `templateSettings` 아래로 내려가면서 기존 소비자가
전부 경유 함수를 타게 됐다. 다만 이것은 Design §3.4가 "유일한 구조 변경"으로 **예고한**
변경이고, 회귀 방어선(기존 E2E·`data-testid`·동작)은 실제로 유지됐다. 편차가 아니라
설계된 비용으로 판정한다.

---

## 3. Success Criteria 평가

| # | 기준 | 상태 | 근거 (재현 확인) |
|---|------|:----:|------|
| SC1 | Day1으로 3규격 각각 실제 MP4 | ✅ Met | `day1-template.spec.ts:339` — 1080×1080·1080×1920·1920×1080, h264+aac, 15.0초, `ffprobe` |
| SC2 | 흑백 전환이 렌더 결과물에 반영 | ✅ Met | `:390` — 비활성 패널 평균 채도 < 8, 정지 회색이 **자기 소스** 첫 프레임 루마와 ±10, 두 패널 회색차 > 30 |
| SC3 | 기존 3장면 회귀 없음 | ✅ Met | 기존 E2E 18개 + 유닛 274개 통과, v1 가져오기 → 렌더(`:611`), 기존 `data-testid` 무변경(`SourceRepair`는 기본값 유지) |
| SC4 | 분할선 색이 지정값으로 렌더 | ✅ Met | `:390` — `#38bdf8` → (56,189,247), 1채널 오차 |
| SC5 | 엔드카드 아이콘 정합 ≤ 2px | ⚠️ Partial → **✅ Met (§8)** | 최초 판정은 9:16만 렌더 픽셀 검증(오차 0px)이었다. §8에서 1:1·16:9 케이스를 추가해 3규격 전부 2px 이내 |
| SC6 | 유닛·E2E·빌드·타입체크 통과 | ✅ Met | §1.1 — 4개 커맨드 전부 이 세션에서 재실행 |

**5/6 Met, 1 Partial.** Partial 사유는 검증 범위이지 구현 결함이 아니다 —
`placedIconRect`는 규격 무관 순수 함수이고 1:1 상수는 원본 CSS와 대조 완료다.

---

## 4. Match Rate

| 축 | 비중 | 점수 | 근거 |
|----|:----:|:----:|------|
| Structural | 15% | **100** | Design §11.1의 13개 경로 전부 존재. 픽스처(`project-v1.json`, 두 번째 소스, 엔드카드 스틸)도 존재 |
| Functional | 25% | **96** | FR-D01~D15 전부 구현. placeholder·미구현 없음. 감점은 FR-D11의 16:9 자동 배치 미완(축퇴 처리됨) |
| Contract | 25% | **100** | 렌더 분기 · `EditorSnapshot` 태그 유니온 · 마이그레이션 적용 2곳 · preflight 템플릿 분기 · 불변식 전부 코드로 확인 |
| Runtime | 35% | **97** | 274 유닛 + 24 E2E 전량 통과(재실행). 감점은 SC5 1:1 픽셀 미검증, 60초 프리셋·메모리 미측정 |

```
Overall = 100×0.15 + 96×0.25 + 100×0.25 + 97×0.35 = 97.95 → 98%
```

### 4.1 FR 추적

| FR | 구현 지점 | 검증 |
|----|-----------|:----:|
| FR-D01 | `schema.ts:266` 판별 유니온, `TemplateSelector.tsx` | ✅ 유닛+E2E |
| FR-D02 | `migrate.ts:79`, `projectRepository.ts:72`, `projectFile.ts:142` | ✅ E2E 2건 |
| FR-D03 | `Day1Composition.tsx:40`, `useRenderQueue` preflight | ✅ E2E `:522` |
| FR-D04 | `day1/layout.ts` `SPLIT_ORIENTATION` + `splitLayout` | ✅ 유닛 3규격 |
| FR-D05 | `SplitFrame.tsx:107` `Freeze`+`grayscale(1)` | ✅ E2E 픽셀 |
| FR-D06 | `sectionDurationsOf` + 기존 `moveBoundary` 재사용 | ✅ E2E 팔레트 인덱스 |
| FR-D07 | `day1PanelSchema.transforms`, `writeRatioOverride` | ✅ 유닛+프리뷰 |
| FR-D08 | `split` 스키마, `ColorField.tsx` | ✅ E2E 픽셀 |
| FR-D09 | `copy.day1Labels`, `labelStyle`, 4행×2열 인스펙터 | ✅ 유닛+프리뷰 |
| FR-D10 | `SplitFrame` `volume={originalVolume}`, 나레이션 제외 | ⚠️ Design §5.2와 편차 (Gap-3) |
| FR-D11 | `endCard.ts` `APP_ICON_RECT`, `EndCardScene` 2레이어 | ⚠️ 16:9 자동 배치 없음 (Gap-1) |
| FR-D12 | `iconStyle` pop/pulse/glow, `cardStyle` ken-burns/fade | ✅ 전 프리셋 scale ≥ 1 코드 확인 |
| FR-D13 | `iconAdjust` + `day1-icon-dx/dy/scale` | ✅ 프리뷰 실측 |
| FR-D14 | `buildEditorSnapshot` 단일 분기점, Batch 무수정 | ✅ E2E 4잡 |
| FR-D15 | `ColorField` feature detection (버튼 미표시) | ✅ 코드 확인 (미지원 브라우저 실측은 불가) |

---

## 5. Gap List

confidence ≥ 80%만 싣는다.

### Critical

없다.

### Important

**Gap-1 — 16:9 엔드카드 자동 배치 미완** (FR-D11 / SC5)
`APP_ICON_RECT`에 16:9가 없어 `placedIconRect`가 프레임 중앙 정사각형으로 축퇴한다.
사용자 결정(D12)으로 별도 사이클로 분리된 항목이므로 **결함이 아니라 알려진 한계**다.
다만 16:9는 Plan §2.1이 지원 규격으로 명시한 3규격 중 하나이므로, 이 상태로 16:9
엔드카드를 뽑으면 아이콘이 배너에 구워진 아이콘과 어긋난다.
→ 해소 조건: bannerdesigner에 app-badge 1920×1080 레이아웃 추가 후 상수 1줄.
→ 그때까지의 사용자 안내는 이미 인스펙터에 있다(`day1-icon-manual`).

**Gap-2 — module 2~6 전량이 커밋되지 않았다**
마지막 커밋은 module-1(`ad50ef5`)이다. 그 뒤 20개 파일 수정(+2311/−451)과 19개 신규
경로가 워킹 트리에만 있다. 지금 전부 통과하는 상태이므로 **체크포인트가 없는 것이
유일한 위험**이다. 실수 한 번으로 5개 모듈 작업이 사라진다.
→ 모듈 단위로 커밋을 쪼개 남기는 것을 권한다.

### Minor

**Gap-3 — 라이브 패널 볼륨이 `duckedVolumeAt`을 타지 않는다**
Design §5.2는 "`volume`은 기존 `duckedVolumeAt`으로 계산"이라고 지정했으나 구현은
`audio.originalVolume` 상수다. Day1은 나레이션이 범위 밖이고
`buildDay1Props`가 `buildAudioRenderProps(project, [], …)`로 나레이션을 비우므로
**현재는 결과가 동일**하다. 나중에 Day1 나레이션이 들어오면 패널 오디오가 더킹되지
않는다. 코드 주석에 근거가 남아 있다.

**Gap-4 — SC5가 9:16에서만 렌더 픽셀로 검증됐다**
1:1은 프리뷰 DOM(module-5)과 유닛까지다. `placedIconRect`는 규격 무관 순수 함수이고
1:1 상수를 원본 CSS와 대조했으므로 위험은 낮다. E2E 1케이스 추가로 닫을 수 있다.

**Gap-5 — Day1 패널 소스는 새로고침 후 항상 relink가 필요하다**
3장면 소스는 File System Access 핸들로 자동 복구되지만 패널은 Dropzone 경로만 있어
핸들이 없다. relink가 미디어 id를 유지해 Trim·프레이밍은 살아남는다.
Design 미기재 편차이며 module-5 §3.5에 근거가 있다. 사용자 체감 비대칭이다.

**Gap-6 — 60초 프리셋 렌더 시간·메모리 미측정**
NFR "1.5배 이내"는 15초 기준으로만 확인됐다. 디코더 2개 구성에서 길이가 4배가 될 때의
메모리 거동이 미지수다.

**Gap-7 — Day1에서 카피 탭이 숨겨진 것은 Design 미기재 결정이다**
사용자 결정은 "Hook 숨김"까지였고 카피 탭 숨김은 Do 판단이다(module-5 §3.1). 판단
근거는 타당하고(카피 필드가 전부 3장면 개념) 코드 주석에 남아 있으나, 문서에 사용자
승인 기록이 없다.

---

## 6. Decision Record 준수 확인

| 결정 | 준수 | 확인 |
|------|:----:|------|
| D1 활성만 재생 / 비활성 흑백 정지 | ✅ | `SplitFrame` |
| D2 경계 드래그, 기본 중간 | ✅ | `day1SectionDurations` 균등 분배 |
| D3 3장면과 공존 | ✅ | 판별 유니온 + 선택기 |
| D4 배너 PNG + 아이콘 별 레이어 | ✅ | `EndCardScene` 2레이어 |
| D5 Cover + 패널별 재프레이밍 | ✅ | `objectFit="cover"` + transform |
| D6 패널 라벨 4언어 | ✅ | `copy.day1Labels` |
| D7 활성 영상 원본 사운드 | ⚠️ | 동작은 준수, 계산 경로는 편차 (Gap-3) |
| D8 16:9는 bannerdesigner 선행 | ⚠️ | 별도 사이클로 분리, 미완 (Gap-1) |
| D9 Option C | ✅ | `sections` + `templateSettings` |
| D10 sections 3튜플 고정 | ✅ | `z.tuple` 3개 |
| D11 자기 trim-in 프레임 정지 | ✅ | E2E가 두 패널 회색 차이로 증명 |
| D12 16:9 수동 배치 축퇴 | ✅ | `placedIconRect` fallback + 안내 |
| D13 사전 추출 설계 폐기 | ✅ | `Freeze` 유지, 실측 1.04× |

---

## 7. 권고

| 우선 | 항목 | 대응 |
|:----:|------|------|
| 1 | Gap-2 커밋 없음 | 모듈 단위 커밋으로 체크포인트 확보 |
| 2 | Gap-1 16:9 자동 배치 | bannerdesigner 별도 사이클. 그때까지 16:9 엔드카드는 수동 배치임을 릴리스 노트에 명시 |
| 3 | Gap-4 SC5 1:1 | E2E 1케이스 추가 (저비용) |
| 4 | Gap-3 / Gap-5 / Gap-6 | Day1 나레이션·장기 렌더 사이클에서 함께 처리 |
| 5 | Gap-7 | 카피 탭 숨김을 Design 또는 Plan에 사용자 승인으로 기록 |

---

## 8. Act — Gap 전부 수정 (2026-07-30)

사용자 결정: **"Gap 전부 수정"**. Gap-1이 다른 저장소 작업을 다시 끌어오는 것을 포함한다.

| Gap | 조치 | 검증 |
|-----|------|------|
| **Gap-2** 커밋 없음 | 모듈 3~6 작업을 소스 커밋(`e1b61cc`)과 문서 커밋(`727c5fa`)으로 고정. 파일 단위로 모듈이 뒤섞여 있어 모듈별 분할은 중간 상태가 타입체크를 통과하지 못한다 — 2개로 나눈 이유 | 커밋 시점에 유닛·E2E·빌드 전량 통과 상태 |
| **Gap-1** 16:9 자동 배치 | bannerdesigner **v1.18**: app-badge `size-16x9`(1920×1080) CSS + `APP_BADGE_CANVAS_SPECS['16x9']` + 규격 선택기·배치 체크박스(app-badge 전용, 4:5 규칙 복제). videodesigner: `APP_ICON_CSS['16:9']` 추가, `appIconRect`가 non-nullable로, 중앙 폴백 `placedIconRect`와 `day1-icon-manual` 안내 제거 | 브라우저 실측 — 단건 export 1920×1080 · 아이콘 박스 `1096,238 → 1735,877` **오차 0px**, 배치 combo `app-badge:16x9:ko` 동일, 1:1 회귀 0. Day1 E2E에 16:9 케이스 추가 후 렌더 MP4에서 2px 이내 |
| **Gap-4** SC5 1:1 미검증 | 엔드카드 E2E를 규격 파라미터화 (9:16 · 1:1 · 16:9) | 3규격 전부 렌더 MP4 픽셀에서 통과 |
| **Gap-3** 더킹 경로 | `SplitFrame`이 `duckedVolumeAt`을 타고, 나레이션 창을 구간 상대 프레임으로 변환. 현재는 창이 비어 결과 동일 | 타입체크 + 유닛 272 + E2E 전량 |
| **Gap-5** 패널 relink 강제 | 패널마다 "파일 선택"(핸들 저장) 버튼, 복원 시 핸들 → 권한 요청 → relink 순서로 축퇴. 3장면과 동일 정책 | 새 E2E: 새로고침 → relink → Trim 유지. 프리뷰 실측으로 버튼·안내 확인. 핸들 경로 자체는 OS 파일 피커라 Playwright로 못 몬다(3장면도 동일 한계) |
| **Gap-6** 60초 미측정 | 옵트인 하네스 `tests/e2e/day1-longform.spec.ts` (`DAY1_LONGFORM=1`) | 실측 — 3장면 60초 **17.97s** vs Day1 60초 **18.91s** = **1.05×**, heap 47MiB 동일 (게이트 1.5×) |
| **Gap-7** 문서 미기록 | Plan에 **D14**(카피 탭 숨김 사후 승인) · **D15**(16:9 자동 배치) 추가, Design §4.3·§5.2·§6.2·§10 갱신 | 문서 diff |

### 8.1 재검증 (수정 후, 이 세션에서 실행)

```
npx tsc -b            passed
npm test              28 files / 272 tests   passed
npm run build         passed
npx playwright test   27 passed, 1 skipped(옵트인 60초 하네스)
```

유닛이 274 → 272인 것은 16:9 폴백 테스트 4개를 상수 테스트 2개로 대체했기 때문이다(폴백 코드 자체가
사라졌다). E2E는 24 → 27 (엔드카드 1:1·16:9, 패널 복원).

### 8.2 갱신된 Match Rate

| 축 | 비중 | 이전 | 이후 | 근거 |
|----|:----:|:----:|:----:|------|
| Structural | 15% | 100 | **100** | 변동 없음 |
| Functional | 25% | 96 | **100** | FR-D11이 3규격 자동 배치로 완성 |
| Contract | 25% | 100 | **100** | 변동 없음. `Record<AspectRatio, …>`로 규격 누락이 컴파일 오류가 됨 |
| Runtime | 35% | 97 | **100** | SC5 3규격 픽셀 검증, 60초 프리셋 실측, 패널 복원 E2E |

```
Overall = 100 → 100%
```

Critical·Important·Minor 전부 해소. 남은 항목은 애초에 Plan §2.2가 범위 밖으로 둔 것들(영상 3개
이상, 클립 드래그, Day1 나레이션·TTS)과 MPEG-4 호환 확대(별도 Plan)뿐이다.

### 8.3 남긴 한계

- 패널·3장면 소스 모두 **핸들 복원 경로는 자동 테스트가 없다** — OS 파일 피커를 Playwright가 열 수 없다. 프리뷰 실측으로만 확인했다.
- 60초 측정의 절대 시간은 단색 생성 픽스처 기준이다. 실촬 영상은 디코딩이 더 비싸다(비율은 유효).
- bannerdesigner 변경은 **커밋하지 않았다** — 다른 저장소이므로 사용자 확인 후 커밋 대상이다.

```bash
/pdca report day1-template
```
