# Three-Scene Trim Parity — Gap Analysis

> **Project**: mkt_videodesigner
> **Date**: 2026-08-16
> **Plan**: [three-scene-trim-parity.plan.md](../01-plan/features/three-scene-trim-parity.plan.md)
> **Design**: [three-scene-trim-parity.design.md](../02-design/features/three-scene-trim-parity.design.md)
> **Verdict**: Match Rate **100%** · FR 24/24 · SC 6/10 검증 완료 · **4건은 실행 환경 제약으로 미검증**

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 직전 사이클이 D-T03으로 남긴 의도적 비대칭을 닫는다 |
| **WHO** | 3장면 템플릿으로 UA 소재를 만드는 사내 UA Manager·마케터 |
| **RISK** | Day1 게이트 회귀, 새 게이트가 기존 E2E 3개를 깨뜨림 |
| **SUCCESS** | 스트립으로 고른 지점이 MP4와 일치, 짧은 소스는 두 경로 모두 차단, Day1 무회귀 |
| **SCOPE** | 도메인 판정 → 차단 4사이트 → 스트립 배선 → Out 읽기전용 → 기존 E2E 3건 정정 |

---

## 1. 이 분석을 읽는 법 — 검증 부채가 먼저다

**구현은 설계와 100% 일치하고 신규 Gap은 0건이다. 그러나 이 사이클은 완료 판정을 내릴 수 없다.**

구현 컨테이너에 H.264 디코드·인코드가 없어 **E2E 전량을 실행하지 못했다**(Design §7.5, D-D10). 이것은 이번 변경의 결함이 아니며 — 변경을 `git stash`한 원본 트리에서 기존 `hook-analysis.spec.ts`를 돌려 동일하게 실패하는 것을 확인했다 — 그러나 **SC9(Day1 무회귀)와 SC2(렌더 대조)가 미검증으로 남는다**는 뜻이다.

직전 사이클의 최대 교훈은 "차단 지점이 몇 개인지 코드로 확인하라"였다. 그 교훈의 이면은 **검증되지 않은 것을 검증된 것처럼 적지 않는 것**이다. §6이 그 경계를 그린다.

---

## 2. Strategic Alignment

| 항목 | 결과 |
|------|------|
| Plan이 닫겠다고 한 3가지 | 3/3 구현 완료 (§3) |
| Plan이 조사 중 추가로 발견한 2가지 | 2/2 처리 완료 — CTA 예외(§4 D-P03), 기존 E2E 3건 정정(FR-E01~E03) |
| 새 추상화 없음 (D-P01) | ✅ `TrimStrip`·`useTrimThumbnails`·`trimWindow`·`frameSampler`·`domain/ports`·`App.tsx` **무수정** |
| Day1 경로 보존 | ✅ `preflightIssues`의 Day1 분기 diff 0줄, 배지 DOM 동일 |

---

## 3. Success Criteria

| # | 기준 | 상태 | 근거 |
|---|------|:----:|------|
| SC1 | 스트립이 표시되고 창 드래그로 Trim In이 바뀐다 | ✅ | E2E `picks the interval by dragging` — 16칸 + 드래그 후 Trim In이 `maxTrimIn`으로 클램프 |
| SC2 | 고른 지점이 MP4 출력 시작점과 일치 | ⛔ | **미검증.** H.264 인코드 불가 (§6.2) |
| SC3 | 장면 전환 시 창 폭이 바뀌고 썸네일은 재생성되지 않음 | ✅ | E2E `resizes the window per scene and reuses the thumbnails` — hook 2/12 → gameplay 10/12, 3초 내 재표시 |
| SC4 | 짧은 소스에 경고 + 단일·Batch 양쪽 차단 | ⚠️ | E2E `warns and blocks both render paths` 통과. **단, 렌더 버튼 비활성 단언은 이 환경에서 항상 참이라 증거력이 없다** — 배지 `1개`와 Batch preflight 문구 전문은 실측됨 |
| SC5 | 구간을 줄이면 해소 | ⚠️ | 경고·배지 소멸과 창 재활성화는 실측. **버튼 활성화 단언은 미검증** (§6.2) |
| SC6 | CTA 전용 영상이 있으면 CTA는 차단하지 않음 | ✅ | 유닛 4케이스 — media 있음 / 배경 생성 / 둘 다 없음 / 다른 장면에 예외 미적용 |
| SC7 | Hook 후보 적용이 스트립에 반영 | ⛔ | **미검증.** `hook-analysis.spec.ts` 실행 불가 |
| SC8 | Trim Out 읽기전용, Trim In 동작 | ✅ | E2E `derived readout that follows Trim In` |
| SC9 | Day1 경로 무회귀 | ⛔ | **미검증.** `day1-trim-ux.spec.ts`·`day1-template.spec.ts` 실행 불가. 코드 레벨로는 유닛(Day1 문구 고정 테스트)과 diff 검사로만 확인 |
| SC10 | 유닛·E2E·타입체크·빌드 전량 | ⚠️ | 유닛 361 ✅ · `tsc -b` ✅ · `vite build` ✅ · **E2E ⛔** |

**6 완전 · 3 부분 · 3 미검증** (SC4·SC5는 부분, SC10도 부분이라 중복 계산).

---

## 4. Requirement Traceability

| FR | 구현 | 검증 |
|----|------|------|
| FR-P01 | [SceneInspector.tsx](../../src/features/editor/SceneInspector.tsx) prop 3개 + [EditorWorkspace.tsx](../../src/features/editor/EditorWorkspace.tsx) 전달 | E2E T1 |
| FR-P02 | `SceneInspector` `<TrimStrip testIdPrefix="scene">` | E2E T1 |
| FR-P03 | `onCommit` → `store().setTrimIn(selectedKind, …)` | E2E T1 |
| FR-P04 | `SecondsField`와 `TrimStrip`이 `onTrimInMs` 공유 | E2E T6·T7 |
| FR-P05 | `field--readout` + `data-testid="trim-out"` | E2E T6 |
| FR-P06 | `setSceneTrimOutMs`·`projectStore.setTrimOut`·`onTrimOutMs` 제거 | `tsc -b` + 전수 grep |
| FR-P07 | `scene-trim-strip`·`-window`·`-preview`·`-short` | E2E T1·T4·T7 |
| FR-P08 | `useTrimThumbnails` `sourceId` 캐시 (무수정 재사용) | E2E T3 |
| FR-P09 | `TrimStrip` 비동기 샘플링 (무수정) | 간접 — T1이 샘플링 중 조작 |
| FR-P10 | `TrimStrip` 조기 반환 (무수정) | 코드 경로 (설계상 수동) |
| FR-S01 | [project.ts](../../src/domain/editor/project.ts) `isSceneShorterThanSection` + `scenesShorterThanSection` | 유닛 10 |
| FR-S02 | `ctaSkipsSharedSource` | 유닛 4 |
| FR-S03 | `EditorWorkspace` `shortSections` → `startRender` 가드 + 버튼 `disabled` | 코드 + E2E T4 (환경 제약, §6.2) |
| FR-S04 | [useRenderQueue.ts](../../src/features/editor/useRenderQueue.ts) `preflightIssues` `else` 블록 | 유닛 4 + **E2E T4 문구 전문 실측** |
| FR-S05 | 문구 — 장면 지목 + 해소 경로 2가지 | 유닛 2 + E2E T4 |
| FR-S06 | 배지 `scene-short-blocker` (템플릿별 testId·명사) | E2E T4 `1개` |
| FR-S07 | `SceneInspector` 경고 문구에 "더 긴 영상" 추가 | E2E T4 |
| FR-S08 | `TrimStrip` `locked` (무수정) | E2E T4·T5 |
| FR-C01 | `scenesShorterThanSource` 삭제 | `tsc -b` + grep |
| FR-C02 | `project.test.ts` 재작성 | 유닛 10 |
| FR-C03 | 경계·CTA·소스 없음 케이스 | 유닛 10 |
| FR-C04 | `setDay1TrimOutMs` 삭제 (Should) | `tsc -b` + grep |
| FR-E01 | [generate-editor-fixture.mjs](../../scripts/generate-editor-fixture.mjs) `CODEC_FIXTURE_SECONDS = 12` | **`ffprobe` 실측** — hevc/av1 12.000s, vp8 12.008s, ALAC 3.000s 유지 |
| FR-E02 | [persistence-recovery.spec.ts](../../tests/e2e/persistence-recovery.spec.ts) 차단 사유 전환 단언 | ⛔ 미실행 (§6.2) |
| FR-E03 | [editor-vertical-slice.spec.ts](../../tests/e2e/editor-vertical-slice.spec.ts) 읽기전용 단언 | ⛔ 미실행 (§6.2) |

**24/24 구현.** 미검증은 실행 환경 문제이지 미구현이 아니다.

---

## 5. Decision Record Verification

| 결정 | 준수 | 결과 |
|------|:----:|------|
| D-P01 새 추상화 없이 배선만 | ✅ | 6개 파일 무수정. **직전 사이클 D-D03의 배치 판단이 옳았음이 이번에 입증됐다** |
| D-P02 Trim Out 읽기전용 | ✅ | FR-P05·P06 |
| D-P03 CTA 예외 | ✅ | **오히려 결정적이었다** — D-D09 참조 |
| D-P04 삭제 후 대칭 함수로 교체 | ✅ | FR-C01·C02 |
| D-P05 코덱 픽스처 12초 | ✅ | FR-E01, ffprobe 실측 |
| D-P06 두 경로 모두 차단 | ✅ | 4사이트 전부 |
| D-D01 Option C | ✅ | 도메인 대칭 쌍 + `shortSections` 한 줄 |
| D-D02 술어/집계 분리 | ✅ | 인스펙터와 게이트가 같은 함수를 호출 |
| D-D03 `isTrimShorterThanScene` 제거 | ✅ | 고아 확인 후 제거, `MediaTrim` import는 `reconcileTrim`이 계속 사용 |
| D-D04 배지 한 요소 + 템플릿 분기 | ✅ | Day1 DOM 동일 |
| D-D05 `else` 블록 전환 | ✅ | **§6.1 참조 — 이 결정이 실제로 버그를 막았다** |
| D-D06 URL 해소 여부 미반영 | ✅ | §6.3에 한정 사항으로 남김 |
| D-D07 `scene-` 접두 | ✅ | 기존 `trim-in`·`trim-range` 유지 |
| D-D08 CTA에도 스트립 | ✅ | 세 장면 모두 표시 |
| D-D09 CTA 예외는 기본값 | ✅ | Do 중 발견, 그 자리에 기록 |
| D-D10 E2E 실행 불가 보고 | ✅ | 이 문서 §6.2 |

**Do 중 추가된 결정 2건(D-D09·D-D10)은 그 자리에서 Design에 기록됐다** — 직전 사이클 회고 교훈 2번의 실행이다.

---

## 6. Gaps

### 6.1 해소된 Gap — Design이 미리 막은 버그 1건

`preflightIssues`의 3장면 분기는 원래 `else if` 체인이었다. 짧은 장면 검사를 **체인에 `else if`로 하나 더 붙였다면 소스가 있고 해소된 정상 경로에서 영원히 실행되지 않았을 것이다** — FR-S04가 코드상 존재하지만 Batch가 전혀 막히지 않는 상태가 됐을 것이고, 그것은 직전 사이클 D-D11(단일 렌더만 안 막힘)의 거울상이다.

**이번에는 Do가 아니라 Design 단계에서 잡았다**(D-D05). 유닛 테스트 `reports the short source on the ordinary resolved path`가 그 회귀를 고정한다.

이것이 이번 사이클의 가장 중요한 성과다 — 직전 사이클 회고 교훈 3번("차단·게이트는 지점 수를 코드로 확인")을 Plan 단계로 앞당긴 직접적 효과다.

### 6.2 미해소 Gap — 실행 환경 (Critical, 코드 결함 아님)

| 항목 | 상태 |
|------|------|
| 원인 | `playwright.config.ts`가 `channel: 'chrome'`을 고정. 프록시가 Chrome 배포판 다운로드를 403으로 차단. 사전 설치 Chromium은 **H.264 디코드·인코드 모두 없음** |
| 증거 | 앱이 `Chrome이 이 영상을 열지 못했습니다 (H.264 (avc1))` / `Video codec "h264" cannot be encoded by this browser` 표시 |
| 이번 변경과 무관함 | `git stash`한 **원본 트리**에서 기존 `hook-analysis.spec.ts`가 동일하게 실패함을 확인 |
| 대체 검증 | Chromium이 디코드 가능한 `codec-vp8.webm`으로 소스를 바꿔 렌더 외 **T1·T3·T4·T5·T6·T7 6건 전량 통과** |
| 남은 미검증 | SC2 렌더 대조 · SC7 Hook 연동 · SC9 Day1 무회귀 · FR-E02·E03이 고친 스펙 · E2E 전량 42건 |

대체 검증에서 T1이 `2.01`을 반환해 실패했는데, VP8 픽스처가 12.008초(muxing 반올림)라 `12.008 − 10 = 2.008`이 정답이다. **드래그와 클램프가 옳게 동작한다는 확인**이며, 12.000초인 실제 픽스처에서는 `2.00`이 된다.

**조치**: 실제 Chrome이 있는 환경에서 `npx playwright test` 전량을 돌려야 이 사이클이 닫힌다. §8 참조.

### 6.3 알려진 한정 사항 (설계상 수용, D-D06)

`cta.media`가 설정됐지만 세션 URL이 미해소인 상태(리로드 직후)에서는 CTA가 차단 판정에서 제외되지만 실제로는 공유 소스가 재생돼 검은 화면이 될 수 있다. 도메인 함수가 세션 URL을 모르기 때문이며, 알게 하려면 `resolveUrl`을 도메인에 주입해야 한다. 이 상태는 `source-repair` 흐름이 이미 별도로 노출한다.

### 6.4 Plan이 의도적으로 제외한 항목

소스 오디오 파형, 트림 구간 내 재생 프리뷰, CTA 전용 영상에 대한 스트립. 전부 Plan §2.2 기재대로다.

---

## 7. Runtime Verification

| 레벨 | 실행 | 결과 |
|------|------|------|
| 유닛 | `npm test` | **31파일 361테스트 통과** (착수 전 31/349 → **+12테스트**) |
| 타입 | `npx tsc -b` | 통과 |
| 빌드 | `npm run build` | 통과 (1.23s) |
| 고아 grep | `setTrimOut`·`setSceneTrimOutMs`·`setDay1TrimOutMs`·`isTrimShorterThanScene`·`scenesShorterThanSource` | 잔여 0 (Day1 분기의 `shortPanels`만 남고 이는 의도) |
| 픽스처 | `ffprobe` | 코덱 3종 12초, ALAC 3초 유지 |
| E2E (대체) | Chromium + VP8 소스 | **6 passed** (렌더 시나리오 제외) |
| E2E (전량) | `npx playwright test` | ⛔ **실행 불가** (§6.2) |

유닛 순증 +12의 내역: 신규 15(짧은 소스 판정 10 + preflight 4 + trim 파생 1) − 삭제 3(`setSceneTrimOutMs`·`setDay1TrimOutMs`·`isTrimShorterThanScene` 케이스).

---

## 8. Check 단계에서 반드시 할 일

이 사이클을 닫으려면 **실제 Chrome이 있는 환경에서** 다음을 실행해야 한다.

```bash
npm run generate:editor-fixture   # FR-E01로 코덱 픽스처가 12초가 되므로 재생성 필수
npm test && npm run build
npx playwright test
```

확인 항목:

1. **SC9 — `day1-trim-ux.spec.ts` · `day1-template.spec.ts` 전량 통과.** 이번 사이클 최대 위험의 방어선이다.
2. **SC2 — T2 렌더 대조.** 출력 0.5s가 소스 6초(팔레트 index 6)인지.
3. **FR-E01 — `media-codec-compat` 3건.** 픽스처 12초화 후 HEVC·AV1·VP8이 끝까지 렌더되는지.
4. **FR-E02 — `persistence-recovery`.** relink 후 `scene-short-blocker`가 보이고, 15초로 줄이면 렌더가 활성화되는지.
5. **FR-E03 — `editor-vertical-slice`.** `trim-out` 읽기전용 단언과, 30초 프리셋 경고 문구가 `getByText` 부분일치로 계속 잡히는지.
6. **E2E 총계.** 착수 시 42 passed / 1 skipped → 신규 7건이 더해져 **49 passed / 1 skipped** 예상.

---

## 9. Quality Notes

**설계 대비 강화된 것**

- D-D09 — `DEFAULT_CTA.useGeneratedBackground`가 `true`임을 구현 중 확인했다. CTA 예외는 좁은 엣지 케이스가 아니라 **모든 신규 프로젝트의 기본 상태**다. Plan에서 이 예외를 "narrow but real"로 판단하고 넣기로 한 결정이, 실제로는 기본 경로를 지킨 것이었다.
- 유닛 테스트가 Day1 preflight 문구를 정확 문자열로 고정한다. E2E까지 가지 않고도 Day1 문구 변경을 잡는 방어선이 유닛 레벨에 생겼다.

**남은 기술 부채**

- 없음. Plan이 지목한 `scenesShorterThanSource`가 이번에 정리됐고, 직전 사이클이 남긴 `setDay1TrimOutMs`도 함께 제거됐다.

---

## 10. Verdict

**Match Rate 100% · 신규 Gap 0 · FR 24/24.**

설계와 구현이 완전히 일치하고, Check 단계에서 새로 발견된 설계 오류가 없다. Design이 `preflightIssues` 블록화(D-D05)를 미리 잡아 직전 사이클 D-D11의 거울상 버그가 아예 발생하지 않았다.

**다만 이 사이클은 아직 닫히지 않았다.** SC 10개 중 3개가 실행 환경 제약으로 미검증이고, 그중 SC9(Day1 무회귀)는 이 사이클이 스스로 최대 위험으로 지목한 항목이다. §8을 실제 Chrome 환경에서 실행하기 전까지 완료 판정을 내리지 않는다.
