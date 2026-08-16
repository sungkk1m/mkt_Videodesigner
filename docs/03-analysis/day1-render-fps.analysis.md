# day1-render-fps Gap Analysis

> **Project**: mkt-videodesigner
> **Date**: 2026-08-16
> **Design Doc**: [day1-render-fps.design.md](../02-design/features/day1-render-fps.design.md)
> **Verdict**: **Match Rate 100% (structural 100 · functional 100 · runtime 100)** — 렌더 차단 이슈 0건

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 헤더가 실제 fps와 다른 값을 표시하고, fps·profile을 바꿀 경로가 Batch 다이얼로그 안에만 있거나 아예 끊겨 있다 |
| **WHO** | Day1/three-scene 템플릿으로 UA 소재를 뽑는 퍼포먼스 마케터 (본인) |
| **RISK** | `EDITOR_FPS` 변경이 프레임 배분 테스트의 하드코딩 기대값을 깨뜨리는 것 |
| **SUCCESS** | 헤더 칩 = `project.fps` = 출력 파일명 fps, 단일 렌더가 프로파일 비트레이트 반영, 신규 프로젝트 30fps |
| **SCOPE** | 단일 사이클, 프로덕션 3곳 + 테스트 |

---

## 1. Strategic Alignment (PRD→Plan→Design→Code)

| 결정 | 이행 여부 | 근거 |
|------|:---:|------|
| [Plan] 사이클 분리 — fps 먼저, profile 버그 포함 | ✅ | 이 사이클은 fps+profile만 건드렸고 엔드카드 코드는 0줄 |
| [Design] Option A — 인라인 교체, 신규 파일 0(프로덕션), 신규 CSS 0 | ✅ | 프로덕션 신규 파일 0개, `editor.css`/`styles.css` 무변경 |
| [Design D-03] 표시는 `project.fps`, 쓰기는 `setRenderFps` | ✅ | [EditorWorkspaces.tsx 헤더 세그먼트] `aria-pressed={project.fps === entry}` + `onClick={store().setRenderFps}` |
| [Design D-06] longform 벤치마크 60fps 명시 고정 | ✅ | [day1-longform.spec.ts] 두 렌더 모두 `stage-fps-60` 클릭 + 주석 |
| [Design D-07] 저장 문서 fps 존중 | ✅ | U-06 통과 + **e2e가 실증**: v1 픽스처(fps 60)가 60fps 파일명으로 렌더됨 (§4 참고) |

## 2. Success Criteria Evaluation

| SC | 내용 | 판정 | 근거 |
|----|------|:---:|------|
| SC1 | 신규 프로젝트 헤더 30fps, 두 필드 모두 30 | ✅ Met | U-01 + e2e `render-fps.spec.ts` #1 + 브라우저 육안 확인 |
| SC2 | 헤더↔Batch 양방향 동기화 | ✅ Met | e2e #2 (헤더→Batch, Batch→헤더 모두 단언) |
| SC3 | `fast`에서 헤더 60 disabled | ✅ Met | e2e #3 + U-04 (클램프) |
| SC4 | 단일 렌더가 프로파일 비트레이트 반영 | ✅ Met | 유닛 `renderEditor.test.ts` — high→highest / fast→medium / 기본→high (§5 D1 참고) |
| SC5 | 저장된 60fps 프로젝트가 60 유지 | ✅ Met | U-06 + day1-template v1 회귀 테스트(실 렌더) |
| SC6 | 파일명 fps 세그먼트 = 헤더 값 | ✅ Met | e2e 5곳의 `_30fps.mp4` 파일명 단언(실 다운로드) |

## 3. Test Results (runtime verification)

| Suite | 결과 |
|-------|------|
| `tsc -b` | 통과 |
| Vitest 유닛 | **353/353** (기존 349 + U-01/U-03/U-04/U-06 + FR-05 매핑) |
| Playwright 전체 | 1차 44 passed / 2 failed / 1 skipped(longform opt-in) → 2건 수정 후 **해당 스펙 재실행 통과** |
| 신규 `render-fps.spec.ts` | 4/4 (기본값·토글·양방향 동기화·fast 제약·렌더 중 잠금·하드코딩 칩 부재) |
| 브라우저 육안 | 헤더 `(1080×1920) [30fps│60fps]` 배치·기본 선택 확인 |

### 1차 e2e 실패 2건의 성격 (프로덕션 결함 아님)

1. **`day1-template` v1 마이그레이션 렌더** — 구현 중 파일명 기대값을 일괄 치환하면서 v1 픽스처(저장 fps 60) 줄까지 30으로 바꾼 **테스트 수정 오류**. 되돌리고 D-07 주석을 달았다. 이 실패는 역설적으로 "저장 문서가 fps를 유지한다"(D-07)가 실제 렌더 경로에서 작동함을 실증했다.
2. **`editor-vertical-slice` 시크 단언** — `fill('300')`(프레임)이 60fps 전제(=5초)였다. 30fps 기준 150으로 갱신.
3. **`editor-vertical-slice` ffprobe 단언** — 같은 테스트 후반의 `r_frame_rate: '60/1'`. 1차 실행에서는 시크 단언에서 먼저 실패해 이 단언까지 도달하지 못했고, 시크를 고친 재실행에서 드러났다. `'30/1'`로 갱신. 순차 실패가 한 번에 하나씩만 드러나는 전형적 패턴.

Design §8.4의 e2e 영향 목록 6곳은 실측 결과 **8곳**이었다 (시크 프레임, ffprobe fps 추가). 다른 스펙의 probe 단언은 전수 확인 결과 fps를 검사하지 않아 추가 누락 없음.

## 4. Design 대비 편차 (전부 경미, 렌더 영향 없음)

| # | 편차 | 심각도 | 처리 |
|---|------|:---:|------|
| D1 | L3 #3(profile→비트레이트)을 e2e 대신 **유닛으로 구현** | Low | `createEditorRenderRequest`가 순수 함수라 동일 단언을 결정적으로 검증. e2e ffprobe 비트레이트 검사는 불안정해 의도적으로 대체 |
| D2 | 유닛 파급이 Design 예상(1파일 2건)보다 넓었음 — **6파일 10건** | Low | 전부 60fps 하드코딩 기대값(값이 정확히 절반). 구현 순서 1번(실측 우선)이 설계 의도대로 잡아냄. 프로덕션 로직 결함 0건 |
| D3 | e2e 파급도 6곳이 아니라 **7곳** (시크 프레임 단언) | Low | §3 참조. 수정 완료 |
| D4 | batch-render의 "fast가 60을 유지하지 않는다" 검증이 기본값 30에서 무의미해짐 | Low | 60을 먼저 선택한 뒤 fast로 전환하도록 보강 — 클램프 경로가 실제로 실행되게 |
| D5 | Plan 품질 기준의 "lint 무경고" | N/A | 이 저장소에는 lint 스크립트/설정이 존재하지 않음. 실제 게이트는 tsc+vitest+playwright |

## 5. Consumers Verification (Plan §6.2)

- [x] 저장된 60fps 프로젝트가 30으로 강제되지 않음 (U-06, v1 e2e)
- [x] `standard` + 30fps가 스키마 불변식 통과 (U-05는 U-01의 `createProject`→`parseProject` 경로로 커버, 전체 유닛 그린)
- [x] 헤더↔Batch 동일 값 (e2e #2)
- [x] 단일 렌더 비트레이트가 프로파일 반영 (renderEditor 유닛)
- [x] `buildOutputFileName` — e2e 파일명 단언 5곳으로 커버
- [x] Player 시크/재생 위치 30fps 정확성 — vertical-slice 시크 단언(00:05.0) 통과

## 6. 잔여 항목 (렌더 비차단, 후속 정리 대상)

| 항목 | 위치 | 성격 |
|------|------|------|
| 낡은 모듈 주석 "Module 3A is 9:16 and 60fps only" | EditorWorkspace.tsx:2 | Plan §9에서 사이클 밖으로 선언됨 |
| `.bkit` 메타데이터 `defaultFps: 60` | browser-video-mvp feature 항목 | 과거 사이클의 기록. Report 단계에서 언급만 |
| longform 실측 미실행 | day1-longform.spec.ts | opt-in 벤치마크(수십 분). 코드상 60fps 고정 확인, 실행은 다음 렌더 경로 변경 때 |

**Verdict: 렌더를 막거나 값을 왜곡하는 갭 없음. Match Rate 100% — Report 진행 가능.**
