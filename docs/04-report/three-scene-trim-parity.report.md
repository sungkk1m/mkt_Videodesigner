# Three-Scene Trim Parity — Completion Report

> **Project**: mkt_videodesigner
> **Cycle**: 2026-08-16 (Plan → Design → Do ×4 → Check, 단일 세션)
> **Match Rate**: 100% · **FR** 24/24 · **Iteration** 0
> **Status**: **조건부 완료** — E2E 전량 실행이 남아 있다 (§6)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 직전 사이클이 회귀 위험을 이유로 트림 스트립과 짧은 소스 렌더 차단을 Day1에만 적용했다. 같은 편집기 안에서 템플릿에 따라 편집 능력과 안전장치가 달랐다 — 3장면은 숫자 입력 두 개뿐이었고, 소스가 장면보다 짧으면 경고만 뜬 채 검은 화면이 담긴 MP4가 그대로 렌더됐다. |
| **Solution** | 직전 사이클이 원시값 props로 만들어 둔 `TrimStrip`을 `SceneInspector`에 배선했다. 짧은 소스 판정은 `day1PanelsShorterThanSection`과 대칭인 함수를 만들어 **단일 렌더와 Batch 두 경로 모두**에 걸었다. CTA는 전용 영상이나 생성 배경을 쓸 때 공유 소스를 재생하지 않으므로 판정에서 제외했다. |
| **Function/UX Effect** | 3장면 사용자도 장면을 고르면 원본 전체가 스트립으로 깔리고, 창을 끌어 구간을 정하고, 확대 프레임으로 구도를 확인한다. 짧은 소스는 렌더 앞에서 막히고 어느 장면인지와 해소 방법을 안내받는다. 템플릿을 바꿔도 같은 조작, 같은 안전장치가 따라온다. |
| **Core Value** | "어느 템플릿을 쓰느냐"가 편집 능력과 안전장치를 가르지 않는다. 검은 화면 소재가 광고로 나가는 마지막 경로가 닫혔다. |

### Value Delivered

| 관점 | 착수 전 | 완료 후 |
|------|---------|---------|
| 3장면 구간 선택 | 숫자 입력 2개, 소스 미표시 | 16칸 스트립 + 드래그 창 + 480px 확대 프레임 |
| 3장면 Trim Out | 입력 필드 (입력해도 창만 이동) | 종속값 읽기전용 표시 |
| 3장면 짧은 소스 | 경고만, 렌더는 그대로 나감 | 인스펙터 경고 + 단일 렌더·Batch 양쪽 차단 + 장면 지목 |
| 템플릿 간 대칭 | Day1만 차단되는 의도된 비대칭 | 해소 |
| 소비자 없는 함수 | `scenesShorterThanSource`, `setDay1TrimOutMs` | 정리 완료 |
| 유닛 테스트 | 31파일 349테스트 | 31파일 **361테스트** |

---

## 1. What Shipped

**신규 1**

| 파일 | 역할 |
|------|------|
| `tests/e2e/three-scene-trim-parity.spec.ts` | T1~T7 — 스트립·캐시·읽기전용·키보드·렌더 대조·차단·해소 |

**수정 13** — `domain/editor/project.ts`(+test), `domain/editor/day1Commands.test.ts`, `domain/timeline/timeline.ts`(+test), `features/editor/SceneInspector.tsx`, `EditorWorkspace.tsx`, `useRenderQueue.ts`(+test), `projectStore.ts`, `scripts/generate-editor-fixture.mjs`, `tests/e2e/persistence-recovery.spec.ts`, `tests/e2e/editor-vertical-slice.spec.ts`

**무수정 6 (의도)** — `TrimStrip.tsx` · `useTrimThumbnails.ts` · `trimWindow.ts` · `frameSampler.ts` · `domain/ports` · `App.tsx`. 이 목록이 지켜졌다는 것이 D-P01("새 추상화를 만들지 않는다")의 판정이다.

---

## 2. Key Decisions & Outcomes

| 결정 | 준수 | 결과 |
|------|:----:|------|
| **[Plan D-P01]** 배선만, 새 추상화 없음 | ✅ | 6개 파일 무수정. **직전 사이클 D-D03의 배치 판단이 옳았음이 입증됐다** |
| **[Plan D-P02]** Trim Out 읽기전용 | ✅ | 명령 함수·스토어 액션·prop까지 함께 제거 |
| **[Plan D-P03]** CTA 예외 | ✅ | **판단이 결정적이었다** — §4 참조 |
| **[Plan D-P04]** `scenesShorterThanSource` 삭제·교체 | ✅ | 반환형·가드·이름 셋 다 해소 |
| **[Plan D-P05]** 코덱 픽스처 12초 | ✅ | `ffprobe` 실측. ALAC은 렌더 경로 밖이라 3초 유지 |
| **[Plan D-P06]** 두 경로 모두 차단 | ✅ | 4사이트 전부 |
| **[Design D-D05]** `preflightIssues`를 `else` 블록으로 | ✅ | **버그를 미리 막았다** — §3 참조 |
| **[Design D-D09]** CTA 예외는 기본값 | ✅ | Do 중 발견, 즉시 기록 |
| **[Design D-D10]** E2E 실행 불가를 그대로 보고 | ✅ | §6 |

---

## 3. 이 사이클에서 가장 중요했던 것 — 버그를 Design에서 막았다

`preflightIssues`의 3장면 분기는 `else if` 체인이었다.

```ts
if (day1) { … } else if (!source) { … } else if (!sourceResolved) { … }
```

짧은 장면 검사를 **이 체인에 `else if`로 하나 더 붙였다면, 소스가 있고 해소된 정상 경로에서 영원히 실행되지 않았을 것이다.** 코드상 FR-S04가 존재하는데 Batch는 전혀 막히지 않는 상태 — 직전 사이클 D-D11(단일 렌더만 안 막힘)의 **정확한 거울상**이다.

**직전 사이클은 이것을 Do 중에 잡았고, 이번 사이클은 Design 단계에서 잡았다.** 회고 교훈 3번("차단·게이트 계열은 차단 지점이 몇 개인지 코드로 확인")을 Plan 단계로 앞당긴 직접적 효과다. Plan §1.4 ②가 4사이트를 표로 세어 두었기 때문에, Design이 각 사이트의 제어 흐름을 실제로 읽었고 거기서 체인 구조가 드러났다.

유닛 테스트 `reports the short source on the ordinary resolved path`가 이 회귀를 고정한다.

---

## 4. Plan 조사가 만들어낸 두 가지

Plan 단계의 코드 조사가 없었다면 Do에서 범위 재조정이 필요했을 항목들이다.

**① CTA 예외는 엣지 케이스가 아니었다.** Plan은 `CtaScene`을 읽고 "CTA 전용 영상이나 생성 배경이면 공유 소스를 안 읽는다"를 발견해 D-P03으로 예외를 넣었다. 당시 판단은 "좁지만 실재하는 오차단"이었다. Do 중 `DEFAULT_CTA.useGeneratedBackground`가 `true`임을 확인했다 — **모든 신규 프로젝트의 CTA가 처음부터 면제 대상**이다. 예외를 넣지 않았다면 CTA 구간보다 짧은 소스가 **항상** 해소 불가능하게 차단됐을 것이다.

**② 기존 E2E 3건이 실제로 깨졌다.** 코덱 픽스처 3초(15s 프리셋 gameplay는 10초), `persistence-recovery`의 30초 프리셋 + 12초 소스, `editor-vertical-slice`의 `trim-out` 입력. 셋 다 테스트가 낡은 것이었고 — 앞 둘은 실제로 검은 화면을 렌더하고 있었다 — Plan §1.4 ⑤에서 FR로 등재해 두어 Do에서 놀라지 않았다.

---

## 5. 회고 교훈의 적용 결과

직전 사이클이 남긴 교훈 3건을 모두 실행했다.

| 교훈 | 적용 | 효과 |
|------|------|------|
| **범위 항목은 반드시 FR 표에** | §2.1 전 항목에 FR-P/S/C/E 24개 부여. 조사 중 드러난 E2E 정정도 FR-E01~E03으로 등재 | Check에서 24/24 추적이 기계적으로 확인됐다. 누락 0 |
| **Do 중 결정은 그 자리에 기록** | D-D09·D-D10 2건 즉시 기록 | Check 신규 Gap **0건** |
| **차단·게이트는 지점 수를 코드로 확인** | **Design이 아니라 Plan에서** 실행 (§1.4 ②) | §3의 버그를 Design에서 막았다. 이번 사이클 최대 성과 |

세 번째 교훈을 Plan으로 한 단계 앞당긴 것이 효과가 가장 컸다. Plan이 4사이트를 세어 두었기 때문에 Design이 각 사이트의 제어 흐름을 읽을 수밖에 없었고, 거기서 `else if` 문제가 드러났다.

---

## 6. 남은 일 — 이 사이클은 아직 닫히지 않았다

**E2E 전량을 실행하지 못했다.** 구현 컨테이너의 Chromium에 H.264 디코드·인코드가 없고(`playwright.config.ts`가 `channel: 'chrome'`을 고정하는 이유), 프록시가 Chrome 배포판 다운로드를 403으로 막는다.

**이번 변경 때문이 아님을 확인했다** — 변경을 `git stash`한 원본 트리에서 기존 `hook-analysis.spec.ts`가 동일하게 실패한다.

**대체 검증**: Chromium이 디코드할 수 있는 `codec-vp8.webm`으로 소스를 바꿔 렌더 시나리오를 제외한 **6건 전량 통과**를 확인했다. Batch preflight 문구 전문과 배지 `1개`까지 실측했다.

**실제 Chrome 환경에서 반드시 실행해야 하는 것**:

```bash
npm run generate:editor-fixture   # 코덱 픽스처 12초화 반영에 필수
npm test && npm run build
npx playwright test
```

| # | 확인 항목 | 이유 |
|---|-----------|------|
| 1 | `day1-trim-ux.spec.ts` · `day1-template.spec.ts` (SC9) | **이 사이클이 스스로 지목한 최대 위험** |
| 2 | T2 렌더 대조 (SC2) | 스트립에서 고른 지점 = MP4 시작점 |
| 3 | `media-codec-compat` 3건 (FR-E01) | 픽스처 12초화 후 끝까지 렌더되는지 |
| 4 | `persistence-recovery` (FR-E02) | relink 후 15초로 줄이면 활성화되는지 |
| 5 | `editor-vertical-slice` (FR-E03) | 읽기전용 단언 + 경고 문구 부분일치 |

**예상 총계**: 착수 시 42 passed / 1 skipped → 신규 7건이 더해져 **49 passed / 1 skipped**.

---

## 7. Verification — 현재까지

| 레벨 | 결과 |
|------|------|
| 유닛 | **31파일 361테스트 통과** (착수 전 349 → +12) |
| 타입 | `npx tsc -b` 통과 |
| 빌드 | `npm run build` 통과 |
| 고아 grep | 잔여 0 |
| 픽스처 | `ffprobe` — 코덱 3종 12초, ALAC 3초 |
| E2E (VP8 대체) | 6 passed |
| E2E (전량) | ⛔ 미실행 — §6 |

---

## 8. Next Cycle Candidates

| 항목 | 근거 |
|------|------|
| **CI에서 E2E를 실제로 돌릴 수 있게 하기** | 이번에 드러난 구조적 문제. `channel: 'chrome'` 의존 때문에 Chrome 없는 환경에서 E2E가 전무해진다. 픽스처를 VP9/AV1 WebM으로 옮기거나 CI에 Chrome을 고정 설치하는 선택지가 있다 |
| **소스 오디오 파형 표시** | 두 사이클 연속 범위 밖. 대사 있는 소재엔 여전히 유용하다 |
| **`cta.media` 미해소 시 CTA 예외의 빈틈** | Design §6·D-D06의 알려진 한정 사항. `resolveUrl` 주입 비용 때문에 미룬 것이라, 비슷한 요구가 하나 더 생기면 함께 판단 |

---

## 9. 팀 리뷰에서 특히 봐 주었으면 하는 곳

| 지점 | 왜 |
|------|-----|
| [project.ts `ctaSkipsSharedSource`](../../src/domain/editor/project.ts) | `CtaScene`의 `freezeSourceFrame` 조건과 **두 곳이 같은 식**이어야 한다. 한쪽만 바뀌면 조용히 어긋난다 |
| [useRenderQueue.ts `preflightIssues`의 `else` 블록](../../src/features/editor/useRenderQueue.ts) | §3의 이유로 `else if`로 되돌리면 안 된다. 주석에 근거를 남겼지만 리뷰로 한 번 더 고정되면 좋겠다 |
| [persistence-recovery.spec.ts FR-E02](../../tests/e2e/persistence-recovery.spec.ts) | 기존 단언을 "삭제"가 아니라 "차단 사유 전환"으로 고쳤다. 의도가 보존됐는지 |
| Design §7.5 | 검증되지 않은 것을 통과로 적지 않았는지 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-08-16 | 사이클 구현 완료. Match Rate 100%, FR 24/24, Check 신규 Gap 0, iteration 0. Design 단계에서 `preflightIssues` 제어 흐름 버그를 미리 차단(D-D05). Do 중 결정 2건(D-D09·D-D10) 즉시 기록. **E2E 전량 미실행 상태이므로 조건부 완료로 표시**한다. | 김성권 / Claude |
