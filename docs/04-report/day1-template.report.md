# Day1 Template — Completion Report

> **Status**: **Complete**
>
> **Project**: mkt_videodesigner
> **Version**: 0.1.0
> **Author**: 김성권 / Claude
> **Completion Date**: 2026-07-30
> **PDCA Cycle**: #2 (browser-video-mvp 이후)
> **Match Rate**: **100%** (Check 98% → Act 이후 100%)

---

## Executive Summary

### 1.1 Project Overview

| Item | Content |
|------|---------|
| Feature | day1-template — Before/After 분할 비교 영상 템플릿 + 템플릿 판별자 기반 |
| Start Date | 2026-07-28 (Plan) |
| End Date | 2026-07-30 (Check·Act·Report) |
| Duration | 3일 (Plan → Design → Do 6모듈 → Check → Act) |
| PRD | 없음 (`/pdca pm` 미실행 — Plan Executive Summary가 상위 근거) |

### 1.2 Results Summary

```
┌─────────────────────────────────────────────┐
│  Completion Rate: 100%                       │
├─────────────────────────────────────────────┤
│  ✅ Complete:     15 / 15 FR                 │
│  ✅ Success Crit:  6 / 6 SC                  │
│  ✅ Gap resolved:  7 / 7 (Critical 0)        │
│  ⏳ Next cycle:    3 items (Plan §2.2 범위 밖)│
└─────────────────────────────────────────────┘
```

### 1.3 Value Delivered

| Perspective | Content |
|-------------|---------|
| **Problem** | 스키마가 `[Hook, Gameplay, CTA]` 3장면 + 영상 1개로 고정되어, UA에서 성과가 검증된 "Day 1 vs Day 30" 분할 비교 포맷은 매번 외부 편집 도구를 거쳐야 했다. |
| **Solution** | `sections`(공통 시간축) + `templateSettings`(판별 유니온) 구조로 스키마를 v2로 올리고(Design Option C), Day1 경로를 추가했다. 타임라인·Batch·파일명·자동저장은 무수정 재사용, 컴포지션 분기는 `buildEditorSnapshot` 1곳으로 모았다. |
| **Function/UX Effect** | 업로드 → 편집 → 3규격(9:16·1:1·16:9) MP4까지 브라우저 안에서 완결된다. 렌더 비용은 3장면 대비 **15초 1.04× / 60초 1.05×** (게이트 1.5×), heap 47MiB 동일. 기존 3장면 E2E는 무회귀. 외부 편집 도구 개입 지점이 0이 됐다. |
| **Core Value** | 검증된 비교 포맷을 반복 생산할 수 있게 됐고, 3번째 UA 포맷은 **스키마 1곳 + 스냅샷 빌더 1곳** 수정으로 얹힌다. `Record<AspectRatio, …>` 타입 때문에 규격 누락은 조용한 폴백이 아니라 컴파일 오류가 된다. |

---

## 1.4 Success Criteria Final Status

> Plan §4.1 기준. 근거는 Check 세션에서 **재현·재실행**한 것이다 (Do 문서 인용이 아님).

| # | Criteria | Status | Evidence |
|---|----------|:------:|----------|
| SC1 | Day1으로 3규격 각각 실제 MP4가 나온다 | ✅ Met | [day1-template.spec.ts:339](../../tests/e2e/day1-template.spec.ts) — 1080×1080 · 1080×1920 · 1920×1080, h264+aac, 15.0초, `ffprobe` 확인 |
| SC2 | 흑백 전환이 렌더 결과물에 반영된다 | ✅ Met | 동 spec `:390` — 비활성 패널 평균 채도 < 8, 정지 회색이 **자기 소스** 첫 프레임 루마와 ±10, 두 패널 회색차 > 30 |
| SC3 | 기존 3장면 프로젝트가 회귀 없이 열리고 렌더된다 | ✅ Met | 기존 E2E 18개 + 유닛 272개 통과, v1 JSON 가져오기 → 실제 렌더(동 spec `:689`), 기존 `data-testid` 무변경 |
| SC4 | 분할선 색이 지정한 값으로 렌더된다 | ✅ Met | 동 spec `:390` — `#38bdf8` → (56,189,247), 1채널 오차 |
| SC5 | 엔드카드 앱아이콘 정합 ≤ 2px | ✅ Met | 동 spec `:501` — Act에서 규격 파라미터화. 9:16 · 1:1 · 16:9 **3규격 전부** 렌더 MP4 픽셀에서 2px 이내. 16:9는 bannerdesigner 브라우저 실측 오차 **0px** |
| SC6 | 유닛·E2E·타입체크·빌드 통과 | ✅ Met | `npx tsc -b` · `npm test` 272 · `npm run build` · `npx playwright test` — 이 Report 세션에서 전부 재실행 (§5.1) |

**Success Rate**: **6/6 (100%)**

> Check 최초 판정은 SC5가 ⚠️ Partial(9:16만 렌더 픽셀 검증)이었다. 사용자 결정 "Gap 전부 수정"에 따라 Act에서 1:1·16:9 케이스를 추가해 닫았다.

## 1.5 Decision Record Summary

> Plan D1~D15 · Design D9~D13 체인. PRD가 없어 [Plan] 계층이 최상위다.

| Source | Decision | Followed? | Outcome |
|--------|----------|:---------:|---------|
| [Plan] D1 | 활성 패널만 재생, 비활성은 첫 프레임 정지 + 흑백 | ✅ | `SplitFrame` `Freeze` + `grayscale(1)`. 동시 디코딩 1개 유지 → 렌더 1.04× |
| [Plan] D2 | 컬러 전환 시점 = 타임라인 경계 드래그, 기본 중간 | ✅ | `day1SectionDurations`가 A·B 균등 분배, 기존 `moveBoundary` 무수정 재사용 |
| [Plan] D3 | 템플릿 선택기로 3장면과 공존 | ✅ | 판별 유니온 + `TemplateSelector`. 3장면 E2E 18개 무회귀 |
| [Plan] D4 | 엔드카드 = 배너 PNG(배경) + 앱아이콘 PNG(오버레이) | ✅ | `EndCardScene` 2레이어. 프리셋 전부 `scale ≥ 1`로 밑이 드러나지 않음 |
| [Plan] D5 | 패널 Cover + 패널별 재프레이밍 | ✅ | `objectFit: cover` + `transforms`, 규격별 override |
| [Plan] D6 | 패널 라벨 패널별 + 4언어 | ✅ | `copy.day1Labels` — 기존 4언어 구조 재사용, `optional()`이라 v1 문서 통과 |
| [Plan] D7 | 분할 구간 오디오는 활성 영상 원본 사운드 | ✅ | Check 시점엔 `originalVolume` 상수(편차, Gap-3) → Act에서 `duckedVolumeAt` 경로로 교정 |
| [Plan] D8 | 16:9 엔드카드는 bannerdesigner 선행 작업으로 해결 | ✅ | Design에서 별도 사이클로 분리 → Do에서 수동 배치 축퇴(D12) → **Act에서 원안대로 완주**(D15) |
| [Plan] D14 | Day1에서 Hook 탭과 함께 카피 탭도 숨긴다 | ✅ | Do 판단이 먼저였고(Gap-7) Check 단계에서 사후 승인 기록 |
| [Plan] D15 | 16:9 엔드카드도 자동 배치로 완성 | ✅ | bannerdesigner v1.18 + `APP_ICON_CSS['16:9']`. 중앙 폴백 제거 |
| [Design] D9 | **Option C** — `sections` 공통 + `templateSettings` 판별 유니온 | ✅ | 타임라인·Batch·파일명 무수정 재사용, 죽은 필드 0 |
| [Design] D10 | `sections`는 당분간 3튜플 고정 (YAGNI) | ✅ | `z.tuple` 3개 유지. N구간 일반화는 필요해질 때 |
| [Design] D11 | 비활성 패널은 **자기 trim-in** 프레임에 정지 | ✅ | E2E가 두 패널 회색값 차이(>30)로 증명 — 상대 패널 프레임이 아님 |
| [Design] D12 | 16:9는 아이콘 수동 배치로 축퇴 | ⛔ 폐기 | D15가 대체. 폐기가 상위 의도(Plan D8)에 더 부합 |
| [Design] D13 | 정지 프레임 사전 추출 설계 폐기 | ✅ | 스파이크 0.99× → 실측 1.04×. `Freeze` 유지가 옳았다 |

**편차 1건 (설계된 비용)**: Design §1.1의 1순위 목표 "기존 3장면 경로를 한 줄도 바꾸지 않는다"는 문언대로는 지켜지지 않았다. `source`·`scenes`가 `templateSettings` 아래로 내려가 기존 소비자가 경유 함수를 타게 됐다. 다만 이것은 Design §3.4가 "이번 설계의 유일한 구조 변경"으로 **예고한** 것이고, 실제 회귀 방어선(기존 E2E·`data-testid`·동작)은 유지됐다.

---

## 2. Related Documents

| Phase | Document | Status |
|-------|----------|--------|
| PM | — | ⚪ 미실행 (`/pdca pm` 생략) |
| Plan | [day1-template.plan.md](../01-plan/features/day1-template.plan.md) | ✅ v0.1.1 (D14·D15 반영) |
| Design | [day1-template.design.md](../02-design/features/day1-template.design.md) | ✅ v0.1.1 (D12 폐기 반영) |
| Spike | [day1-template.render-spike.md](../03-analysis/day1-template.render-spike.md) | ✅ 0.99× |
| Do 증거 | [module-1](../03-analysis/day1-template.module-1-schema.md) · [module-2](../03-analysis/day1-template.module-2-domain.md) · [module-3](../03-analysis/day1-template.module-3-composition.md) · [module-4](../03-analysis/day1-template.module-4-endcard.md) · [module-5](../03-analysis/day1-template.module-5-ui.md) · [module-6](../03-analysis/day1-template.module-6-render.md) | ✅ 6/6 |
| Check·Act | [day1-template.analysis.md](../03-analysis/day1-template.analysis.md) | ✅ 100% (§8 Act 포함) |
| Report | 현재 문서 | ✅ |

---

## 3. Completed Items

### 3.1 Functional Requirements

| ID | Requirement | Status | 구현 지점 |
|----|-------------|:------:|-----------|
| FR-D01 | `template` 판별자 + 헤더 선택기 | ✅ | `schema.ts:266` 판별 유니온, `TemplateSelector.tsx` |
| FR-D02 | v1 프로젝트 `three-scene` 자동 승격 | ✅ | `migrate.ts:79`, `projectRepository.ts:72`, `projectFile.ts:142` (적용 2곳) |
| FR-D03 | 영상 2개 필수, 없으면 렌더 차단 | ✅ | `Day1Composition.tsx:40`, `useRenderQueue` preflight (E2E `:600`) |
| FR-D04 | 규격별 상하/좌우 분할과 재생 순서 | ✅ | `day1/layout.ts` `SPLIT_ORIENTATION` + `splitLayout` |
| FR-D05 | 활성만 재생 / 비활성 정지 + 흑백 | ✅ | `SplitFrame.tsx:107` `Freeze` + `grayscale(1)` |
| FR-D06 | 컬러 전환 경계 드래그, 기본 중간 | ✅ | `sectionDurationsOf` + 기존 `moveBoundary` 재사용 |
| FR-D07 | 패널별 Cover 재프레이밍 + 규격 override | ✅ | `day1PanelSchema.transforms`, `writeRatioOverride` |
| FR-D08 | 분할선 두께·색 (피커 + 스포이트) | ✅ | `split` 스키마, `ColorField.tsx` |
| FR-D09 | 패널별 라벨 4언어 + 스타일 조절 | ✅ | `copy.day1Labels`, `labelStyle`, 인스펙터 4행×2열 |
| FR-D10 | 활성 영상 원본 사운드, 전환 시 넘어감 | ✅ | `SplitFrame` → `duckedVolumeAt` (Act 교정) |
| FR-D11 | 엔드카드 배너 배경 + 아이콘 규격별 자동 배치 | ✅ | `endCard.ts` `APP_ICON_RECT` **3규격**, `EndCardScene` 2레이어 |
| FR-D12 | 아이콘 애니메이션 프리셋 + 카드 모션 | ✅ | `iconStyle` pop/pulse/glow, `cardStyle` ken-burns/fade |
| FR-D13 | 아이콘 좌표 수동 미세조정 | ✅ | `iconAdjust` + `day1-icon-dx/dy/scale` |
| FR-D14 | 기존 렌더·Batch·자동저장·JSON 경로 재사용 | ✅ | `buildEditorSnapshot` 단일 분기점, Batch 무수정 |
| FR-D15 | 스포이트 미지원 브라우저 축퇴 | ✅ | `ColorField` feature detection (버튼 미표시) |

**15/15 Must·Should 전부 구현. placeholder·미구현 스캔 0건.**

### 3.2 Non-Functional Requirements

| 항목 | 목표 | 실측 | Status |
|------|------|------|:------:|
| 렌더 성능 (15초 9:16) | 3장면 대비 ≤ 1.5× | 7.36s → 7.62s = **1.04×** | ✅ |
| 렌더 성능 (60초 프리셋) | 동일 게이트 | 17.97s → 18.91s = **1.05×**, heap 47MiB 동일 | ✅ |
| 회귀 | 기존 유닛 164 / E2E 17 전량 통과 | 유닛 **272** / E2E **27 통과 + 1 skip**(옵트인 60초 하네스) | ✅ |
| 아키텍처 경계 | `domain/day1/**` 순수 (React·Remotion·Zustand 금지) | `architecture.test.ts` 통과 | ✅ |
| 브라우저 | Chrome 95+ (EyeDropper) | feature detection 축퇴 (FR-D15) | ✅ |
| 프리뷰·렌더 일치 | 흑백·분할선·라벨·엔드카드가 Player와 MP4에서 동일 | E2E 픽셀 검증 + 프리뷰 실측 | ✅ |

### 3.3 Deliverables

| Deliverable | Location | 규모 |
|-------------|----------|------|
| Day1 순수 도메인 | `src/domain/day1/` — `layout.ts` · `playback.ts` · `endCard.ts` (+ 3 test) | 106줄 로직 / 184줄 테스트 |
| 스키마 v2 + 마이그레이션 | `src/domain/editor/schema.ts` · `migrate.ts` | `migrate.ts` 93줄 |
| 컴포지션 | `src/compositions/Day1Composition.tsx` · `day1/SplitFrame.tsx` · `day1/EndCardScene.tsx` | 454줄 |
| UI | `TemplateSelector.tsx` · `Day1Inspector.tsx` · `Day1AssetPanel.tsx` · `ColorField.tsx` · `useDay1Assets.ts` | `Day1Inspector` 519줄 |
| 렌더 통합 | `renderEditor.ts` 분기, `buildEditorSnapshot` 태그 유니온 | 단일 분기점 |
| E2E | `tests/e2e/day1-template.spec.ts` (+ `day1-longform.spec.ts` 옵트인) | +9 케이스 |
| 픽스처 | `tests/fixtures/project-v1.json` · `gameplay-sample-b.mp4` · 엔드카드 스틸 | 생성 스크립트 포함 |
| 문서 | Plan v0.1.1 · Design v0.1.1 · 모듈 증거 6종 · Check 분석 · 본 리포트 | — |
| 외부 저장소 | `mkt_bannerdesigner` v1.18 — app-badge `size-16x9` 레이아웃 | ⚠️ **미커밋** (§4.1) |

**코드 규모**: `src` 기준 신규 25파일 · 수정 28파일, **+8,147 / −2,065줄**. 테스트·픽스처·문서 포함 전체 78파일 **+13,482 / −2,160줄** (`561c409..HEAD` + 워킹 트리).

---

## 4. Incomplete Items

### 4.1 다음 사이클로 넘긴 것

| 항목 | 사유 | 우선 | 예상 |
|------|------|:----:|------|
| **bannerdesigner v1.18 커밋** | 별개 저장소(`mkt_bannerdesigner`)의 워킹 트리에만 있다. 그 프로젝트의 PDCA·커밋 정책을 따라야 하므로 사용자 확인 대상 | **높음** | 즉시 (커밋 1회) |
| MPEG-4 / HEVC 업로드 호환 확대 | 모든 템플릿 공통 영향. 사용자 결정으로 분리 ([media-codec-compat.plan.md](../01-plan/features/media-codec-compat.plan.md)) | 중간 | 별도 Plan 존재 |
| Day1 나레이션·TTS | Plan §2.2 범위 밖. 오디오 경로는 이미 `duckedVolumeAt`을 타도록 준비됨 | 낮음 | — |
| 핸들 복원 경로 자동 테스트 | OS 파일 피커를 Playwright가 열 수 없다. 3장면 소스도 동일 한계 | 낮음 | 도구 제약 |

### 4.2 취소·보류

| 항목 | 사유 | 대안 |
|------|------|------|
| Design D12 (16:9 아이콘 수동 배치) | Act에서 자동 배치가 완성되어 전제가 사라짐 | D15 자동 배치 |
| 정지 프레임 사전 추출 설계 (D13) | 스파이크·실측 모두 게이트 여유 | `Freeze` 유지 |
| 영상 3개 이상 / 가변 분할 / 클립 드래그 | Plan §2.2 명시적 범위 밖 | 필요 시 별도 템플릿 |

---

## 5. Quality Metrics

### 5.1 최종 검증 (이 Report 세션에서 재실행)

```
npx tsc -b            passed
npm test              28 files / 272 tests    passed  (2.38s)
npm run build         tsc -b + vite build     passed
npx playwright test   27 passed, 1 skipped    passed  (1.5m)
```

이 세션 로그의 3장면 9:16 렌더 실측은 **7.37s** — Check 세션의 7.36s와 일치한다 (Day1 7.62s 대비 1.04×).

| Metric | 목표 | 최종 | 변화 |
|--------|------|------|------|
| Design Match Rate | ≥ 90% | **100%** | 98% → 100% (Act) |
| Success Criteria | 6/6 | **6/6** | 5 Met + 1 Partial → 6 Met |
| Unit tests | 회귀 0 | **272** (28 files) | 164 → 272 (+108) |
| E2E tests | 회귀 0 | **27** (+1 옵트인 skip) | 17 → 27 (+10) |
| Critical Gap | 0 | **0** | — |
| Important Gap | 0 | **0** | 2 → 0 |
| Minor Gap | 0 | **0** | 5 → 0 |

Match Rate 축별 (Check §8.2): Structural 100 / Functional 100 / Contract 100 / Runtime 100.

### 5.2 해소한 Gap 7건

| Gap | 문제 | 조치 | 검증 |
|-----|------|------|------|
| **Gap-1** (Important) | 16:9 엔드카드 자동 배치 미완 — 중앙 정사각형 폴백 | bannerdesigner v1.18에 app-badge `size-16x9` 추가, `APP_ICON_CSS['16:9']` 상수화, 폴백·안내 문구 제거, 반환형 non-nullable | 브라우저 실측 아이콘 박스 `1096,238 → 1735,877` **오차 0px**, 1:1 회귀 0, E2E 16:9 렌더 픽셀 2px 이내 |
| **Gap-2** (Important) | 모듈 2~6 전량이 미커밋 (체크포인트 없음) | 소스 커밋 `e1b61cc` + 문서 커밋 `727c5fa`로 고정. 파일 단위로 모듈이 뒤섞여 모듈별 분할은 중간 상태가 타입체크를 통과하지 못함 → 2개로 분할 | 커밋 시점 유닛·E2E·빌드 전량 통과 |
| **Gap-3** (Minor) | 라이브 패널 볼륨이 `duckedVolumeAt`을 우회 (Design §5.2 편차) | `SplitFrame`이 `duckedVolumeAt`을 타고, 나레이션 창을 구간 상대 프레임으로 변환 | 타입체크 + 유닛 + E2E. 현재는 창이 비어 결과 동일 |
| **Gap-4** (Minor) | SC5가 9:16에서만 렌더 픽셀 검증 | 엔드카드 E2E를 규격 파라미터화 (9:16·1:1·16:9) | 3규격 전부 렌더 MP4 픽셀 통과 |
| **Gap-5** (Minor) | Day1 패널 소스가 새로고침 후 항상 relink 필요 (3장면과 비대칭) | 패널마다 "파일 선택"(핸들 저장) 버튼, 복원 시 핸들 → 권한 요청 → relink 순서로 축퇴 | 새 E2E: 새로고침 → relink → Trim 유지. 핸들 경로는 프리뷰 실측 |
| **Gap-6** (Minor) | 60초 프리셋 렌더 시간·메모리 미측정 | 옵트인 하네스 `tests/e2e/day1-longform.spec.ts` (`DAY1_LONGFORM=1`) | 3장면 17.97s vs Day1 18.91s = **1.05×**, heap 47MiB 동일 |
| **Gap-7** (Minor) | 카피 탭 숨김이 Design 미기재 Do 판단 | Plan에 **D14**(사후 승인) · **D15** 추가, Design §4.3·§5.2·§6.2·§10 갱신 | 문서 diff |

### 5.3 남긴 한계 (알려진 상태)

- **핸들 복원 경로는 자동 테스트가 없다** — OS 파일 피커를 Playwright가 열 수 없다. 패널·3장면 소스 모두 동일하며 프리뷰 실측으로만 확인했다.
- **60초 측정의 절대 시간은 단색 생성 픽스처 기준**이다. 실촬 영상은 디코딩이 더 비싸다 (비율 1.05×는 유효).
- **bannerdesigner 좌표 상수는 외부 CSS에 결합**되어 있다. app-badge 레이아웃이 바뀌면 `endCard.ts`도 갱신해야 한다 (출처를 주석에 남겼고, `Record<AspectRatio, …>` 타입이 규격 누락을 컴파일 오류로 만든다).

---

## 6. Lessons Learned & Retrospective

### 6.1 잘된 것 (Keep)

- **성능 게이트를 Design 착수 전에 스파이크로 닫았다.** Plan §4.3이 "1.5× 초과 시 사전 추출 설계로 전환"이라는 분기를 미리 정의했고, 스파이크 0.99×가 나오면서 D13으로 복잡한 대안을 **설계 전에** 폐기했다. Design이 짧아진 직접적 원인이다.
- **"Day1은 이미 3구간이다"는 통찰(Design §1.2)이 재사용 범위를 결정했다.** 타임라인 도메인이 `SceneDurationsMs` 순수 3튜플 위에서만 동작한다는 것을 먼저 확인해서, 경계 드래그·불변식·프레임 배분·프리셋을 무수정으로 가져왔다.
- **Check가 Do 문서를 인용하지 않고 재현했다.** 유닛·E2E·빌드를 전량 재실행하고, `APP_ICON_RECT`를 bannerdesigner 원본 CSS와 직접 대조했다. 그래서 "16:9 좌표가 없다"는 D12의 전제가 사실임을 독립 확인할 수 있었고, 반대로 Gap-1을 자신 있게 열 수 있었다.
- **타입으로 조용한 실패를 막았다.** `APP_ICON_RECT`를 `Record<AspectRatio, …>`로 두어 규격 추가 시 좌표 없이는 컴파일이 실패한다. 중앙 정사각형 폴백보다 낫다.
- **판별 유니온 스냅샷 태그.** 구조 추론(`'layout' in snapshot`) 대신 명시적 태그를 골라서, 3번째 템플릿이 우연히 같은 필드를 가져도 조용히 깨지지 않는다.

### 6.2 개선할 것 (Problem)

- **모듈 5개 분량을 커밋 없이 진행했다 (Gap-2).** Check가 열어준 유일한 Important 결함이 구현 품질이 아니라 **작업 위생**이었다. 게다가 파일 단위로 모듈이 뒤섞여 있어 사후에 모듈별로 쪼갤 수도 없었다 — 중간 상태가 타입체크를 통과하지 못한다.
- **Design 미기재 결정을 Do에서 3건 만들었다** (카피 탭 숨김 / 패널 relink 정책 / 스냅샷 태그). 판단 근거는 모두 타당했고 코드 주석에도 남았지만, 문서 승인 기록이 없어 Check에서 Gap으로 잡혔다.
- **"기존 경로를 한 줄도 바꾸지 않는다"는 Design 목표가 처음부터 달성 불가였다.** §3.4가 구조 변경을 예고했으므로 §1.1의 문언이 과했다. 목표를 "동작·`data-testid`·E2E 무회귀"로 썼다면 편차 판정이 필요 없었다.
- **Plan §2.3이 선행 작업을 "지연시키지 않는다"로 우회했지만 결국 Act에서 되돌아왔다.** 축퇴(D12)로 진행한 뒤 Check에서 되살리는 왕복이 생겼다. 좌표 상수 1줄짜리 작업이었으므로 처음에 함께 처리하는 게 값싼 선택이었다.

### 6.3 다음에 시도할 것 (Try)

- **모듈 종료 = 커밋**을 Do 완료 조건에 넣는다. 파일 경계가 모듈 경계와 어긋나는 작업은 특히 그렇다.
- **Do 중 Design 미기재 결정이 생기면 그 자리에서 Design에 한 줄 추가**한다. 사후 승인 기록을 Check까지 미루지 않는다.
- **Design Goals를 검증 가능한 문장으로 쓴다.** "한 줄도 바꾸지 않는다" → "기존 E2E 17개와 `data-testid` 70개가 무변경으로 통과한다".
- **크로스 저장소 선행 작업은 비용을 먼저 재고 결정한다.** "1줄인가 1일인가"를 Plan에서 판단하면 축퇴 → 복원 왕복을 피할 수 있다.

---

## 7. Process Improvement Suggestions

### 7.1 PDCA Process

| Phase | 이번 사이클 | 개선 제안 |
|-------|-------------|-----------|
| PM | 미실행 | 사내 단일 사용자·검증된 포맷이라 생략이 적절했다. 시장 가정이 들어가는 포맷(리뷰 인용 등)에는 실행 |
| Plan | 성능 게이트·분기 조건을 미리 정의 — 효과적 | 크로스 저장소 선행 작업의 **실제 비용 추정**을 결정 근거에 포함 |
| Design | 3안 비교 후 Option C 선택 — 적절 | Design Goals를 검증 가능한 문장으로 (§6.3) |
| Do | 모듈 6개 분할 + 증거 문서 6종 — 추적성 좋음 | 모듈 종료 시 커밋 필수화, 미기재 결정 즉시 반영 |
| Check | 재현 기반 검증 + 외부 상수 독립 대조 — 이번 사이클의 최고 수확 | 유지. Do 문서 인용 금지 원칙을 명문화 |
| Act | Gap 7건 전량 수정 후 재검증 | 유지 |

### 7.2 Tools / Environment

| Area | 개선 제안 | 기대 효과 |
|------|-----------|-----------|
| 렌더 성능 | `DAY1_LONGFORM=1` 하네스를 릴리스 전 체크리스트에 넣는다 | 60초 프리셋 회귀를 놓치지 않음 |
| 크로스 저장소 | `endCard.ts` 상수와 bannerdesigner CSS를 잇는 대조 스크립트 | 좌표 드리프트를 수동 대조 없이 감지 |
| E2E | 픽셀 검증 헬퍼(채도·색상·박스 오차)를 공용화 | 다음 템플릿의 SC 검증 비용 절감 |
| 파일 복원 | 핸들 경로를 테스트 가능하게 만들 대안 조사 (Playwright의 파일 피커 제약 우회) | 마지막 미검증 경로 해소 |

---

## 8. Next Steps

### 8.1 즉시

- [ ] **bannerdesigner v1.18 커밋** — 다른 저장소이므로 사용자 확인 필요 (§4.1)
- [ ] `/pdca archive day1-template` — 문서 아카이브
- [ ] 릴리스 노트: 템플릿 2종, Day1 3규격 지원, 스키마 v2 자동 마이그레이션

### 8.2 다음 PDCA 사이클

| 항목 | 우선 | 근거 |
|------|:----:|------|
| media-codec-compat (MPEG-4 / HEVC 업로드 호환) | 높음 | Plan 존재. 템플릿 공통 영향이라 사용자 체감이 크다 |
| 3번째 UA 포맷 (리뷰 인용 / 랭킹 자랑) | 중간 | 이번 사이클의 Core Value 검증 — 스키마 1곳 + 스냅샷 1곳으로 붙는지 실증 |
| Day1 나레이션·TTS | 낮음 | 오디오 경로는 이미 준비됨 (Gap-3 교정) |

---

## 9. Changelog

### v0.2.0 (2026-07-30)

**Added:**
- 템플릿 판별자 — 헤더 선택기로 3장면 / Day1 전환 (`template: 'three-scene' | 'day1'`)
- Day1 분할 비교 템플릿 — 영상 2개, 규격별 상하/좌우 분할, 활성 패널만 재생 + 비활성 흑백 정지
- 분할선 두께·색 조절 (컬러 피커 + EyeDropper 스포이트, 미지원 브라우저 자동 축퇴)
- 패널 라벨 — 패널별 문구 4언어, 크기·색·외곽선·위치
- 엔드카드 — 배너 PNG 배경 + 앱아이콘 오버레이 3규격 자동 배치, 애니메이션 프리셋 (pop/pulse/glow), 카드 모션 (ken-burns/fade)
- 옵트인 60초 렌더 하네스 (`DAY1_LONGFORM=1`)

**Changed:**
- 스키마 v1 → v2 — `sections`(공통 시간축) + `templateSettings`(판별 유니온). `source`·`scenes`가 `templateSettings` 아래로 이동
- `EditorSnapshot`이 템플릿 태그 유니온으로, 컴포지션 분기는 `buildEditorSnapshot` 1곳
- Day1 좌측 레일은 소재·오디오 2탭 (Hook·카피 탭 숨김)
- Day1 패널 소스도 File System Access 핸들로 자동 복원 (3장면과 동일 정책)
- `mkt_bannerdesigner` v1.18 — app-badge 1920×1080 레이아웃 추가 (미커밋)

**Fixed:**
- 저장된 v1 프로젝트를 읽을 때 `three-scene`으로 자동 승격. 마이그레이션 실패 시 원본 보존
- 라이브 패널 볼륨이 `duckedVolumeAt` 경로를 타도록 교정 (나레이션 도입 시 더킹 누락 방지)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-07-30 | 완료 리포트 작성. Match Rate 100%, SC 6/6, Gap 7/7 해소. 검증 커맨드 4종 재실행. | 김성권 / Claude |
