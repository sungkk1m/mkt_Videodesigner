# day1-render-fps Completion Report

> **Project**: mkt-videodesigner
> **Date**: 2026-08-16
> **Match Rate**: 100% (iteration 0회)
> **Documents**: [Plan](day1-render-fps.plan.md) · [Design](day1-render-fps.design.md) · [Analysis](day1-render-fps.analysis.md)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 헤더 "60fps" 칩이 하드코딩 문자열이라 실제 fps와 무관하게 표시됐고, fps는 Batch 다이얼로그에서만 변경 가능했으며, 단일 렌더는 `render.profile`을 전달하지 않아 항상 Standard 비트레이트로 나갔다. |
| **Solution** | `EDITOR_FPS` 60→30, 하드코딩 칩을 `project.fps`를 읽는 30/60 세그먼트로 제자리 교체(Option A, 신규 파일·CSS 0), 단일 렌더 config에 `profile` 1줄 추가. |
| **Function/UX Effect** | 헤더가 항상 사실을 표시하고 그 자리에서 fps를 바꾼다. Fast/High 프로파일이 단일 렌더에 실제 적용된다. 신규 프로젝트는 30fps로 시작하고, 저장된 60fps 프로젝트는 그대로 유지된다. |
| **Core Value** | 화면의 숫자 = 출력 파일. UA 소재 기본 렌더 시간·파일 크기가 절반 수준으로. |

### Value Delivered

| 항목 | 계획 | 실제 |
|------|------|------|
| 프로덕션 변경 | 3곳 ~20줄 | 3곳 (constants 1줄 + 헤더 세그먼트 ~20줄 + profile 1줄) — 일치 |
| 신규 파일 (프로덕션) | 0 | 0 (신규는 e2e 스펙 1개뿐) |
| 테스트 | 전체 그린 | 유닛 353/353 · e2e 46 passed/1 skipped(opt-in) · tsc 통과 |
| 검증 강화 | — | `setRenderFps`/`setRenderProfile` 유닛 커버리지 0→4케이스, profile→비트레이트 매핑 고정, 헤더 e2e 4케이스 신설 |

## Key Decisions & Outcomes

| 결정 | 이행 | 결과 |
|------|:---:|------|
| [Plan] fps 사이클을 endcard와 분리, 선행 | ✅ | endcard 코드 0줄 접촉. `day1-endcard-video`는 이 위에서 착수 가능 |
| [Plan] profile 누락 버그 포함 | ✅ | 1줄 + 회귀 방지 유닛 3단언 |
| [Design A] 인라인 교체 | ✅ | 옆 길이 프리셋과 동일 구조, CSS 0줄로 끝남 (Plan R3 실현 안 됨) |
| [Design D-03] 표시 `project.fps` / 쓰기 `setRenderFps` | ✅ | 불변식(두 fps 필드 동일)을 U-03으로 고정 |
| [Design D-06] longform 벤치마크 60fps 명시 고정 | ✅ | 측정 대상(3600프레임) 보존. 실행은 opt-in이라 다음 렌더 경로 변경 때 |
| [Design D-07] 저장 문서 fps 존중 | ✅ | **실증됨** — v1 픽스처(fps 60)가 실 렌더에서 `_60fps.mp4`로 출력 |

## Success Criteria Final Status — 6/6 Met

| SC | 판정 | 근거 |
|----|:---:|------|
| SC1 신규 프로젝트 30fps | ✅ | U-01, e2e, 육안 |
| SC2 헤더↔Batch 양방향 동기화 | ✅ | e2e render-fps #2 |
| SC3 fast에서 60 disabled | ✅ | e2e #3, U-04 |
| SC4 프로파일 비트레이트 반영 | ✅ | renderEditor 유닛 3단언 |
| SC5 저장 60fps 유지 | ✅ | U-06 + v1 실 렌더 e2e |
| SC6 파일명 = 헤더 fps | ✅ | e2e 파일명 단언 5곳 |

## Learnings (다음 사이클용)

1. **"상수 바꾸고 실측 먼저"가 값을 했다.** Design 예측: 유닛 1파일 2건 → 실측 6파일 10건. e2e 예측 6곳 → 실측 8곳. 프레임 수 하드코딩은 파일명·시크 위치·ffprobe 스트림 메타데이터처럼 서로 다른 얼굴로 흩어져 있었다.
2. **순차 실패는 한 번에 하나씩만 드러난다.** vertical-slice의 ffprobe 단언은 시크 단언을 고친 뒤에야 나타났다. 기대값 일괄 갱신 후에는 같은 파일을 끝까지 다시 돌려야 한다.
3. **일괄 치환은 의미를 안 본다.** v1 마이그레이션 픽스처(저장 fps 60)의 파일명까지 30으로 바꿨다가 e2e가 잡아냈다 — 이 실패 자체가 D-07의 실증이 됐다.
4. Plan 품질 기준에 "lint 무경고"를 적었지만 이 저장소에는 lint 설정이 없다. 실제 게이트는 tsc + vitest + playwright.

## 잔여 (후속 정리, 비차단)

- `EditorWorkspace.tsx:2` 낡은 주석 "Module 3A is 9:16 and 60fps only" (Plan §9)
- `.bkit` 상태의 `browser-video-mvp` 메타데이터 `defaultFps: 60` — 과거 사이클 기록
- longform 벤치마크 실측 실행 (opt-in, 다음 렌더 경로 변경 때)

## Next

`/pdca design day1-endcard-video` — R2(`<Video>`+`<Loop>` 프레임 기준)부터 확정.
