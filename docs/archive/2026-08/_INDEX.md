# Archive Index — 2026-08

완료된 PDCA 사이클의 문서를 보관합니다. 문서 안의 코드 링크는 아카이브 기준
상대 경로(`../../../../src/...`)로 다시 맞춰 두었습니다.

| Feature | Cycle | Match Rate | 기간 | 문서 |
|---------|:-----:|:----------:|------|------|
| [day1-trim-ux](day1-trim-ux/) | #4 | **100%** | 2026-08-15 (단일 세션) | Plan · Design · Check 분석 · 완료 리포트 |

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
