# Day1 Trim UX — Completion Report

> **Project**: mkt_videodesigner
> **Cycle**: 2026-08-15 (Plan → Design → Do ×4 → Check → Report, 단일 세션)
> **Match Rate**: 100% · **SC** 8/8 · **FR** 15/15 · **Iteration** 0

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | Day1 패널 트리밍이 초 단위 숫자 입력 두 개뿐이라, 75초 촬영본에서 쓸 6초를 고르려면 외부 플레이어로 먼저 보고 숫자를 받아 적어야 했다. 게다가 소스가 구간보다 짧으면 경고도 차단도 없이 검은 화면이 담긴 MP4가 광고로 나갔다. |
| **Solution** | 프레임 샘플러를 포트로 추출해 인스펙터에 16칸 썸네일 스트립 + 고정 폭 드래그 창 + 확대 프레임을 얹었다. 짧은 소스는 인스펙터 경고와 **두 렌더 경로 모두**에서 차단한다. |
| **Function/UX Effect** | 패널을 펼치면 원본 전체가 한눈에 보이고, 창을 끌어 구간을 정하고, 확대 프레임으로 구도를 확인한 뒤 그대로 렌더한다. 외부 플레이어 왕복이 사라졌다. 짧은 소스는 렌더 앞에서 막히고 해소 방법을 안내받는다. |
| **Core Value** | 트리밍이 "감으로 숫자를 넣고 렌더해서 확인"에서 "보고 고르는" 작업이 됐다. 검은 화면 소재가 광고로 나가는 경로가 닫혔다. |

### Value Delivered

| 관점 | 착수 전 | 완료 후 |
|------|---------|---------|
| 구간 선택 | 숫자 입력 2개, 소스 미표시 | 16칸 스트립 + 드래그 창 + 480px 확대 프레임 |
| 외부 도구 | 플레이어로 먼저 확인 필요 | 불필요 |
| 짧은 소스 | 무경고·무차단, 검은 화면 MP4 출력 | 인스펙터 경고 + 단일 렌더·Batch 양쪽 차단 + 해소 안내 |
| 테스트 | 유닛 29파일 296테스트 | 유닛 **31파일 349테스트**, E2E 42 passed |
| Hook 분석 | — | 회귀 없음 (샘플러 추출 후에도 2/2) |

---

## 1. What Shipped

**신규 8**

| 파일 | 역할 |
|------|------|
| `src/infrastructure/media/frameSampler.ts` | `FrameSampler` 구현 — 호출자가 정한 시각으로 프레임 디코딩 |
| `src/infrastructure/hook-analysis/heuristicHookAnalyzer.test.ts` | SC8 정적 방어선 (14 테스트) |
| `src/domain/timeline/trimWindow.ts` | 창 기하·샘플 시각 순수 함수 |
| `src/domain/timeline/trimWindow.test.ts` | 경계 조건 29 테스트 |
| `src/features/editor/TrimStrip.tsx` | 스트립 + 창 + 확대 프레임 |
| `src/features/editor/useTrimThumbnails.ts` | 지연 샘플링 + 세션 캐시 |
| `tests/e2e/day1-trim-ux.spec.ts` | E1~E7 + 렌더 대조 (10 테스트) |
| `tests/e2e/helpers/videoSampling.ts` | ffmpeg 픽셀 샘플링 (day1-template과 공유) |

**수정 10** — `domain/ports`, `heuristicHookAnalyzer`, `project.ts`, `day1Commands.test.ts`, `Day1Inspector`, `EditorWorkspace`, `projectStore`, `useRenderQueue`(+test), `editor.css`, `App.tsx`, `day1-template.spec.ts`

---

## 2. Key Decisions & Outcomes

| 결정 | 준수 | 결과 |
|------|:----:|------|
| **[Plan D-T01]** 스트립 + 드래그 창 (스크러버 아님) | ✅ | `reconcileTrim`의 고정 길이 창 구조가 UI에 그대로 드러난다. 창 폭이 곧 구간 길이 |
| **[Plan D-T02]** 문제 2를 경고 + 렌더 차단까지 포함 | ✅ | 3장면 경고 문구가 이미 있다는 조사 결과가 근거였고, 실제로 이식 비용이 낮았다 |
| **[Plan D-T03]** Day1만 적용 | ✅ | `SceneInspector` 무수정, 3장면 E2E 전량 통과. 회귀 방어선이 지켜졌다 |
| **[Design D-D01]** Option C — 최소 추출 | ✅ | 공통분모가 `loadVideo`·`seekTo`·drawImage뿐이라 SC8 위험이 작았고, 실제로 회귀 0 |
| **[Design D-D02]** 프레임당 콜백 + `needsPixels` | ✅ | Hook(ImageData)·스트립(dataURL)·확대 프레임(단일 시각)이 한 API로 해결 |
| **[Design D-D03]** `domain/timeline` 배치 | ✅ | 다음 사이클 3장면 작업이 순수 배선 작업으로 남았다 |
| **[Do D-D08]** 샘플 시각 반올림을 원본과 일치 | ✅ | 설계 스케치대로면 seek이 0.5ms 밀렸다. SC8이 목적인 모듈에서 "거의 없다"에 기대지 않은 판단 |
| **[Do D-D11]** 렌더 차단을 두 경로에 | ✅ | **설계 오류 정정.** 아래 §3 참조 |

---

## 3. 이 사이클에서 가장 중요했던 발견

**Design §5.5가 `preflightIssues`를 렌더 게이트로 전제했으나, 그것은 Batch 전용이었다.**

단일 MP4 렌더 버튼은 `EditorWorkspace`의 별도 조건식(`renderableSource`, `narrationTooLong`)으로 막힌다. 설계대로만 구현했다면 Batch만 막히고 **단일 렌더로는 검은 화면 MP4가 그대로 나갔을 것이다.** FR-S03은 절반만 충족된 채 "구현 완료"로 보였을 것이다.

발견 경로는 문서가 아니라 코드였다 — module-4의 E2E를 쓰려고 기존 차단 테스트(`blocks the render and Batch until both panels are present`)를 읽다가, 그것이 `day1-render-blocker`와 `batch-preflight`를 **따로** 단언하는 것을 보고 두 경로임을 알았다.

교훈: 차단·게이트 계열 요구사항은 Design 단계에서 "차단 지점이 몇 개인지"를 코드로 확인해야 한다. `preflightIssues`라는 이름이 유일한 게이트처럼 읽혔던 것이 오해의 원인이다.

---

## 4. 회고 교훈의 적용 결과

직전 사이클에서 남긴 교훈 2건을 이번에 실행했다.

| 교훈 | 적용 | 효과 |
|------|------|------|
| **범위 항목은 반드시 FR 표에 넣을 것** | Plan §2.1의 모든 범위 항목에 FR-T01~T10 / FR-S01~S05 부여. 산문에만 있는 항목 0 | Check에서 15/15 추적이 기계적으로 확인됐다. 누락 0 |
| **Do 단계 미기재 결정은 그 자리에서 기록** | Do 중 6건(D-D07~D-D12) 발생, 전부 즉시 Design에 기록 | Check 단계에서 새로 발견된 Gap이 **0건**이었다 — 이미 다 기록돼 있었기 때문 |

두 번째 교훈의 효과가 특히 컸다. 설계 오류(D-D11) 같은 중대한 항목이 Check까지 미뤄졌다면 "Gap 발견 → iterate" 사이클이 한 번 더 돌았을 것이다.

---

## 5. Success Criteria — Final

| # | 기준 | 상태 | 근거 |
|---|------|:----:|------|
| SC1 | 스트립 표시 + 창 드래그로 Trim In 변경 | ✅ | E2E, 16칸 확인 |
| SC2 | 고른 지점 = MP4 출력 시작점 | ✅ | 렌더 대조 — Trim In 3s → 출력 3s가 소스 6초 (팔레트 index 6) |
| SC3 | 확대 프레임이 창을 따라감 | ✅ | E2E + 브라우저 실측 (빨강→주황) |
| SC4 | 짧은 소스 경고 + 렌더 차단 | ✅ | E2E — 경고 2개, 배지, 버튼 비활성, Batch preflight |
| SC5 | 구간을 줄이면 해소 | ✅ | E2E — 막다른 길이 아님을 보장 |
| SC6 | 생성 중 조작 가능 | ✅ | E2E |
| SC7 | 유닛·E2E·빌드 전량 | ✅ | 31파일 349테스트 / 42 passed / 빌드 통과 |
| SC8 | Hook 분석 회귀 없음 | ✅ | 2/2, 썸네일 단언 포함 |

**8/8.**

---

## 6. Next Cycle Candidates

| 항목 | 근거 |
|------|------|
| **3장면에 스트립 적용** | Plan D-T03이 미룬 것. `TrimStrip`이 원시값 props라 배선만 하면 된다 |
| **3장면 짧은 소스 렌더 차단** | 현재 Day1만 차단되는 의도된 비대칭(Plan §2.2). 붙일 때 `scenesShorterThanSource`(소비자 없음)와 `day1PanelsShorterThanSection`을 함께 정리 |
| **소스 오디오 파형** | Plan §2.2에서 제외. 스트립만으로 이번 목표는 달성됐으나 대사 있는 소재엔 유용할 수 있다 |

---

## 7. Verification Commands

```bash
npm test && npm run build && npx playwright test
```

착수 시점 기준선: 유닛 29파일 296테스트, `hook-analysis.spec.ts` 2/2.
완료 시점: 유닛 31파일 349테스트, E2E 42 passed / 1 skipped(기존), 빌드 통과.

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-08-15 | 사이클 완료. Match Rate 100%, SC 8/8, FR 15/15, iteration 0. 설계 오류 1건(D-D11)을 Do 중 발견·수정. | 김성권 / Claude |
