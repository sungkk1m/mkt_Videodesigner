# Archive Index — 2026-08

완료된 PDCA 사이클의 문서를 보관합니다. 문서 안의 코드 링크는 아카이브 기준
상대 경로(`../../../../src/...`)로 다시 맞춰 두었습니다.

| Feature | Cycle | Match Rate | 기간 | 문서 |
|---------|:-----:|:----------:|------|------|
| [day1-trim-ux](day1-trim-ux/) | #4 | **100%** | 2026-08-15 (단일 세션) | Plan · Design · Check 분석 · 완료 리포트 |
| [day1-render-fps](day1-render-fps/) | #5 | **100%** | 2026-08-16 (단일 세션) | Plan · Design · Check 분석 · 완료 리포트 |
| [day1-endcard-video](day1-endcard-video/) | #6 | **100%** | 2026-08-17 (단일 세션) | Plan · Design · Check 분석 · 완료 리포트 |
| [day1-trim-preview](day1-trim-preview/) | #7 | **100%** | 2026-08-17 (단일 세션) | Plan(경량 설계 내장) · Check 분석 · 완료 리포트 |

## day1-trim-preview

트림 윈도우에 **최소 폭 34px + 경계 그립 + 길이 라벨**을 부여해 긴 원본에서도
"구간"으로 읽히게 하고, 드래그 커밋 시 선택 구간을 프리뷰에서 **1회 재생**(클릭
토글)하게 했다. 엔드카드는 아웃 핸들로 구간을 0.5–3.0s로 줄일 수 있고, 3초
미만이면 3초 슬롯을 자동 루프로 채운다 — 멀티컷 캐러셀에서 단일 컷만 잡는 용도.

| 항목 | 값 |
|------|-----|
| Match Rate | 100% |
| Success Criteria | 6/6 |
| Iteration | 0 |
| 최종 검증 | 유닛 363테스트 · E2E 53 passed(2 opt-in skip) · `tsc -b` · 400s 소스 실측 · 라이브 스모크 7/7 |
| 착수 시 기준선 | 유닛 360테스트 · E2E 50 passed |

**시작점**: [완료 리포트](day1-trim-preview/day1-trim-preview.report.md) — 시안
선승인 흐름과 Key Decisions가 여기 있습니다.

### 이 사이클에서 남길 만한 것

**이미 절반이 있는지 먼저 본다.** "선처럼 보인다"의 실체는 이미 존재하는 윈도우의
폭이 1.4%였던 것이고, 엔드카드 루프도 렌더 엔진에 이미 있었다(D-01). 실제 작업은
"없는 기능 추가"가 아니라 "있는 메커니즘의 노출"이었고, 그 판별이 Plan 단계 코드
조사에서 나와 렌더 경로 무변경(위험 0)으로 이어졌다.

**인터랙티브 시안 선승인이 재작업을 제거했다.** 요구가 모호했던 ①(구간 표시
방식)을 실프레임 기반 목업으로 확정한 뒤 구현해 UI 방향 수정 0회.

**raw mouse 프로브는 스크롤을 직접 챙겨야 한다.** 검증 중 유일한 실패는 앱이
아니라 뷰포트 밖 좌표를 클릭한 프로브였다. `locator.click()`과 달리
`mouse.down()`은 auto-scroll이 없다.

## day1-endcard-video

엔드카드를 배너 PNG + 앱아이콘 PNG 고정에서 **"배너+아이콘 / 영상" 택일**로 바꿔,
일러스트를 애니메이션한 영상 1개를 마지막 3초에 쓸 수 있게 했다.

| 항목 | 값 |
|------|-----|
| Match Rate | 100% |
| Success Criteria | 6/6 |
| Iteration | 0 |
| 최종 검증 | 유닛 360테스트 · E2E 50 passed(1 opt-in skip) · `tsc -b` · 실 렌더 픽셀 검증 2건 |
| 착수 시 기준선 | 유닛 353테스트 · E2E 46 passed |

**시작점**: [완료 리포트](day1-endcard-video/day1-endcard-video.report.md)

### 이 사이클에서 남길 만한 것

**미디어 슬롯은 3면 계약이다.** 스키마 필드 + 세션 URL 수명주기(`session.retain`)
+ import 강등(`markSourceUnresolved`). 뒤 두 면을 각각 놓쳤다가 테스트가 잡았다.
retain 누락은 엔드카드를 통째로 검게 만들었고, 출력 샘플 RGB가 정확히
`CANVAS_COLOR`였던 것이 "임계값 문제가 아니라 영상 부재"의 결정적 증거였다.
**"렌더 성공 + 파일 길이 정상"만 봤다면 검은 엔드카드가 그대로 통과했다.**

**네이티브 기능 확인이 설계를 줄였다.** Plan 최대 리스크 R2는 remotion `<Loop>`
래퍼와 트림의 프레임 기준 충돌이었으나, `@remotion/media`의 `<Video>`가 자체
`loop` prop을 갖고 트림 창 위에서 도는 것을 패키지 소스에서 확인해 래퍼·직교화·
조건 분기가 전부 사라졌다. 항상 `loop`를 켜는 단일 경로로 두 케이스 모두 정답.

**마이그레이션 0줄.** zod `.default()` 3개만으로 기존 v2 문서가 그대로 열린다.
`schemaVersion` bump 없음, `migrate.ts` 무변경.

## day1-render-fps

기본 fps를 60→30으로 내리고, 하드코딩돼 있던 헤더 "60fps" 칩을 **실제
`project.fps`를 읽는 30/60 토글**로 교체했으며, 단일 렌더가 프로파일을 전달하지
않던 버그를 함께 고쳤다.

| 항목 | 값 |
|------|-----|
| Match Rate | 100% |
| Success Criteria | 6/6 |
| Iteration | 0 |
| 최종 검증 | 유닛 353테스트 · E2E 46 passed(1 opt-in skip) · `tsc -b` |
| 프로덕션 변경량 | 3곳 ~20줄 (상수 1줄 + 헤더 세그먼트 + profile 1줄) |

**시작점**: [완료 리포트](day1-render-fps/day1-render-fps.report.md)

### 이 사이클에서 남길 만한 것

**"상수 바꾸고 실측 먼저"가 값을 했다.** Design 예측은 유닛 1파일 2건이었으나
실측은 6파일 10건, e2e는 6곳 예측에 8곳 실측이었다. 프레임 수 하드코딩은
파일명·시크 위치·ffprobe 스트림 메타데이터처럼 서로 다른 얼굴로 흩어져 있다.

**순차 실패는 한 번에 하나씩만 드러난다.** vertical-slice의 ffprobe fps 단언은
시크 단언을 고친 뒤에야 나타났다. 기대값 일괄 갱신 후에는 같은 파일을 끝까지
다시 돌려야 한다.

**일괄 치환은 의미를 안 본다.** v1 마이그레이션 픽스처(저장 fps 60)의 파일명까지
30으로 바꿨다가 e2e가 잡아냈고, 이 실패 자체가 "저장된 문서는 자기 fps를
유지한다"(D-07)의 실증이 됐다.

## day1-trim-ux

Day1 패널의 소재 트리밍을 숫자 입력에서 **썸네일 스트립 + 드래그 트림 창**으로
전환하고, 소스가 구간보다 짧을 때의 무음 실패를 경고와 렌더 차단으로 드러냈다.

| 항목 | 값 |
|------|-----|
| Match Rate | 100% (Check에서 신규 Gap 0건) |
| Success Criteria | 8/8 |
| Functional Requirements | 15/15 (FR-T01~T10, FR-S01~S05) |
| Iteration | 0 |
| 최종 검증 | 유닛 31파일 349테스트 · E2E 42 passed(1 기존 skip) · `tsc -b` · `vite build` |
| 착수 시 기준선 | 유닛 29파일 296테스트 · `hook-analysis.spec.ts` 2/2 |

**시작점**: [완료 리포트](day1-trim-ux/day1-trim-ux.report.md) — Executive Summary,
Decision Record(D-T01~06, D-D01~12), 회고 교훈의 적용 결과가 여기 있습니다.

### 이 사이클에서 남길 만한 것

**설계 오류 1건을 Do 중에 잡았다.** Design은 `preflightIssues`를 렌더 게이트로
전제했으나 그것은 **Batch 전용**이고, 단일 MP4 렌더 버튼은 `EditorWorkspace`의
자체 조건식으로 막힌다. 설계대로만 구현했다면 Batch만 막히고 단일 렌더로는 검은
화면 MP4가 그대로 나갔을 것이다. 발견 경로는 문서가 아니라 기존 차단 E2E가 두
경로를 따로 단언하는 것을 읽은 것이었다 (D-D11).

**직전 사이클 회고 교훈 2건이 실제로 작동했다.**

| 교훈 | 효과 |
|------|------|
| 범위 항목을 전부 FR 표에 등재 | Check에서 15/15 추적이 기계적으로 확인됨. 누락 0 |
| Do 중 결정을 그 자리에서 기록 | Do 중 6건(D-D07~D-D12) 즉시 기록 → **Check 신규 Gap 0건**, iterate 0회 |

### 아키텍처 자산

`FrameSampler` 포트(`domain/ports`)와 `infrastructure/media/frameSampler.ts`는
Hook 분석과 트림 스트립이 공유한다. 호출자가 샘플 시각을 정하는 형태라, 프레임
디코딩이 필요한 이후 기능도 여기에 붙일 수 있다.

`domain/timeline/trimWindow.ts`는 템플릿 무관 순수 함수이며 `reconcileTrim`과
유닛 테스트로 교차 검증된다.

### 다음 사이클로 넘긴 것

| 항목 | 근거 |
|------|------|
| 3장면(`SceneInspector`)에 스트립 적용 | Plan D-T03이 회귀 위험을 이유로 범위에서 제외. `TrimStrip`이 원시값 props라 배선만 하면 됨 |
| 3장면 짧은 소스 렌더 차단 | 현재 Day1만 차단되는 **의도된 비대칭** (Plan §2.2) |
| `scenesShorterThanSource` 정리 | 여전히 소비자 없음. 위 항목과 함께 처리 |
