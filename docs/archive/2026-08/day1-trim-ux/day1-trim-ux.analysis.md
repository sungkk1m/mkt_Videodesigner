# Day1 Trim UX — Gap Analysis

> **Project**: mkt_videodesigner
> **Date**: 2026-08-15
> **Plan**: [day1-trim-ux.plan.md](day1-trim-ux.plan.md)
> **Design**: [day1-trim-ux.design.md](day1-trim-ux.design.md)
> **Match Rate**: **100%** (Structural 100 · Functional 100 · Contract 100 · Runtime 100)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | Day1 트리밍의 병목은 로직이 아니라 가시성이다. 앱 안에서 소스를 보고 자를 수 있게 만들고, 조용히 실패하던 짧은 소스 케이스를 드러낸다. |
| **WHO** | Day1 템플릿으로 비교 영상을 만드는 사내 UA Manager·마케터 |
| **RISK** | 샘플러 분리로 인한 Hook 분석 회귀, 스트립 픽셀 해상도, canvas·video의 유닛 테스트 불가 |
| **SUCCESS** | 스트립으로 고른 지점이 MP4와 일치, 짧은 소스는 경고+차단, 기존 테스트 전량 통과 |
| **SCOPE** | 샘플링 분리 → 순수 함수 → 스트립 UI → 짧은 소스 게이트. Day1만. |

---

## 1. Strategic Alignment

Plan이 정의한 문제는 "트리밍 로직은 정상인데 어디를 자를지 앱 안에서 볼 수 없다"였다. 구현은 이 문제를 직접 해결한다 — 원본 전체가 16칸 스트립으로 보이고, 고정 폭 창을 끌어 구간을 고르며, 확대 프레임으로 구도를 확인한다. 외부 플레이어 왕복이 제거됐다.

**핵심 검증**: 렌더 대조 E2E가 "스트립에서 고른 3초 → 출력 3초 지점이 소스 6초"를 실제 MP4 픽셀로 확인한다. 즉 이번 사이클이 새로 만든 경로(스트립 → 스토어 → 렌더)가 끝까지 이어진다.

Plan §1.1의 부수 목표(조용한 실패 제거)도 달성됐고, Do 과정에서 **원래 설계보다 강한 형태**가 됐다 (§4 D-D11).

---

## 2. Success Criteria

| # | 기준 | 상태 | 근거 |
|---|------|:----:|------|
| SC1 | 스트립이 표시되고 창 드래그로 Trim In이 바뀐다 | ✅ | E2E `picks the interval by dragging` — 16칸 채워짐 + 드래그 후 Trim In 변화 |
| SC2 | 스트립에서 고른 지점이 MP4 출력 시작점과 일치 | ✅ | E2E `renders the source from the point chosen on the strip` — Trim In 3s → 출력 3s 지점 픽셀이 팔레트 index 6 (소스 6초) |
| SC3 | 확대 프레임이 창 시작 지점을 반영 | ✅ | E2E `updates the enlarged frame` + 브라우저 실측 (0초 빨강 → 4초 주황) |
| SC4 | 짧은 소스에 경고 + 렌더 차단 | ✅ | E2E `warns and blocks the render` — 경고 2개, `day1-short-blocker`, 렌더 버튼 비활성, Batch preflight 문구 |
| SC5 | 구간을 줄이면 경고와 차단이 해소 | ✅ | E2E `clears the warning and the block` — 30초→15초 후 경고·배지 소멸, 버튼 활성 |
| SC6 | 생성 중에도 숫자 입력·조작 가능 | ✅ | E2E `keeps the number field usable while thumbnails are still decoding` |
| SC7 | 유닛·E2E 전량 + 타입체크·빌드 통과 | ✅ | 유닛 31파일 349테스트, E2E 42 passed / 1 skip, `npm run build` 통과 |
| SC8 | Hook 분석 회귀 없음 | ✅ | `hook-analysis.spec.ts` 2/2 (썸네일 `<img>` 단언 포함) + 신규 유닛 14개가 구 계산식과 대조 |

**8/8 충족.**

---

## 3. Requirement Traceability

| FR | 구현 | 검증 |
|----|------|------|
| FR-T01 | [Day1Inspector.tsx](../../../../src/features/editor/Day1Inspector.tsx) `<TrimStrip>` | E2E E1 |
| FR-T02 | [trimWindow.ts](../../../../src/domain/timeline/trimWindow.ts) `windowBoundsRatio`·`trimInFromRatio` + [TrimStrip.tsx](../../../../src/features/editor/TrimStrip.tsx) | 유닛 29 + E2E E1 |
| FR-T03 | [ports/index.ts](../../../../src/domain/ports/index.ts) `onFrame` + [useTrimThumbnails.ts](../../../../src/features/editor/useTrimThumbnails.ts) | E2E E1 |
| FR-T04 | `useTrimThumbnails` 모듈 캐시 | E2E `keeps thumbnails after collapse` |
| FR-T05 | `TrimStrip` 확대 프레임 + `nearestSampleIndex` | E2E E3 |
| FR-T06 | `Day1Inspector` `SecondsField` 유지, `onTrimIn` 공유 | E2E E6 |
| FR-T07 | `Day1Inspector` 읽기전용 readout | E2E `derived readout` |
| FR-T08 | `TrimStrip.handleKeyDown` | E2E E7 |
| FR-T09 | `TrimStrip` 조기 반환 + `useTrimThumbnails.failed` + `frameSampler` 실패 경로 | 코드 경로 (수동) |
| FR-T10 | `useTrimThumbnails` 비동기 샘플링 | E2E E6 |
| FR-S01 | [project.ts](../../../../src/domain/editor/project.ts) `day1PanelsShorterThanSection` | 유닛 6 |
| FR-S02 | `Day1Inspector` `day1-{key}-trim-short` | E2E E4 |
| FR-S03 | [useRenderQueue.ts](../../../../src/features/editor/useRenderQueue.ts) `preflightIssues` **+** [EditorWorkspace.tsx](../../../../src/features/editor/EditorWorkspace.tsx) 버튼 조건식 | 유닛 4 + E2E E4 |
| FR-S04 | `preflightIssues` 문구 (패널 지목 + 해소 경로) | 유닛 2 + E2E E4 |
| FR-S05 | `maxTrimInMs` → `TrimStrip` `locked` | 유닛 + E2E E4·E5 |

**15/15 구현·검증.** 모든 FR이 코드에 `FR-xxx` 주석으로 표기돼 있어 grep으로 추적된다.

---

## 4. Decision Record Verification

| 결정 | 준수 | 결과 |
|------|:----:|------|
| D-T01 스트립 + 드래그 창 | ✅ | 스크러버 단독이 아닌 스트립+창으로 구현 |
| D-T02 문제 2 포함, 경고 + 렌더 차단 | ✅ | 오히려 확대됨 — D-D11로 차단 경로가 2개임이 드러나 둘 다 막았다 |
| D-T03 Day1만 | ✅ | `SceneInspector` 무수정. 3장면 E2E 전량 통과 |
| D-T04 In 유지 / Out 읽기전용 | ✅ | FR-T06·T07 |
| D-T05 지연 생성 + 캐시 | ✅ | 패널 펼침 시 생성, `sourceId` 키 캐시 |
| D-T06 확대 프레임 | ✅ | 480px 별도 샘플 |
| D-D01 Option C | ✅ | `loadVideo`·`seekTo`·샘플링만 추출 |
| D-D02 프레임당 콜백 | ✅ | `needsPixels` 플래그로 두 소비자 분기 |
| D-D03 `domain/timeline` 배치 | ✅ | `reconcileTrim` 옆 |
| D-D04 확대 프레임 별도 호출 | ✅ | 같은 포트, `maxEdge`만 다름 |
| D-D05 모듈 캐시 | ✅ | 완료된 실행만 캐시 (부분 abort는 폐기) |
| D-D06 고아 제거 | ✅ | `onTrimOut` prop·배선·스토어 액션 제거, 도메인 함수 유지 |

**Do 중 추가된 결정 6건** (D-D07~D-D12)은 모두 그 자리에서 Design에 기록됐다 — 직전 사이클 회고 교훈의 실행이다.

---

## 5. Gaps

### 5.1 해소된 Gap — 설계 오류 1건 (Critical, Do 중 발견·수정)

**Design §5.5가 `preflightIssues`를 렌더 게이트로 전제했으나, 그것은 Batch 전용이었다.** 단일 MP4 렌더 버튼은 `EditorWorkspace`의 자체 조건식으로 막힌다.

설계대로만 구현했다면 **Batch만 막히고 단일 렌더로는 검은 화면 MP4가 그대로 나갔을 것이다** — FR-S03이 절반만 충족된 채 테스트는 통과했을 수 있다. module-4 구현 중 기존 차단 테스트(`blocks the render and Batch until both panels are present`)가 두 경로를 따로 단언하는 것을 보고 발견했다.

수정: `shortPanels`를 버튼 `disabled`·`startRender` 조기 반환·`day1-short-blocker` 배지에 추가. Design에 D-D11로 정정 기록.

### 5.2 남은 Gap

**없음.** Plan §2.2가 명시적으로 제외한 항목들은 의도된 미구현이다.

### 5.3 의도된 비대칭 (Plan §2.2 기재대로)

3장면 경로는 경고만 있고 렌더 차단이 없다. Day1만 차단된다. Plan 작성 시 의도적으로 남긴 것이며, 다음 사이클 과제로 등재돼 있다.

---

## 6. Runtime Verification

| 레벨 | 실행 | 결과 |
|------|------|------|
| 유닛 | `npm test` | **31파일 349테스트 통과** (착수 전 29/296 → +2파일 +53테스트) |
| 빌드·타입 | `npm run build` | 통과 |
| E2E 전량 | `npx playwright test` | **42 passed / 1 skipped** (스킵은 [day1-longform.spec.ts:67](../../../../tests/e2e/day1-longform.spec.ts:67) 기존 조건부) |
| 회귀 게이트 | `hook-analysis.spec.ts` | 2/2 (착수 전 기준선과 동일) |
| 브라우저 실측 | 개발 서버 + 수동 | 스트립 16칸, 창 `left:33.33% width:50%`, 확대 프레임 빨강→주황, 콘솔 오류 0 |

**렌더 대조(E2)가 이 사이클의 최종 증거다.** DOM이 아니라 출력 MP4의 픽셀에서 "스트립에서 고른 지점 = 렌더 시작점"을 확인한다.

---

## 7. Quality Notes

**설계 대비 강화된 것**
- 샘플 시각 반올림을 원본과 비트 단위로 맞춤 (D-D08). 설계 스케치대로면 seek이 최대 0.5ms 밀렸다.
- E2E 픽셀 샘플링 헬퍼를 추출해 `day1-template.spec.ts`와 공유 (D-D12). 100줄 복사를 피했고, 추출 후 기존 9개 전량 통과로 무해함을 확인.

**테스트 작성 중 배운 것**
- `SecondsField`는 prop을 로컬 draft로 복사해 한 렌더 늦게 반영된다. E2E는 `expect.poll`로 안정된 값을 단언해야 한다. 기존 컴포넌트 동작이며 이번 변경과 무관.
- 스트립은 썸네일·확대 프레임이 도착하며 레이아웃이 자란다. 드래그 전 `waitForStripReady`로 안정화하지 않으면 좌표가 어긋난다. 3회 연속 실행으로 안정성 확인.

**남은 기술 부채 (신규 아님)**
- `scenesShorterThanSource`(project.ts)는 여전히 소비자가 없다. 3장면 렌더 차단을 붙일 때 `day1PanelsShorterThanSection`과 함께 정리 대상.

---

## 8. Verdict

**Match Rate 100%. Gap 0. SC 8/8. FR 15/15.**

Check 단계에서 새로 발견된 Gap이 없다 — Do 중 발견한 설계 오류 1건(§5.1)을 그 자리에서 수정하고 기록했기 때문이다.
