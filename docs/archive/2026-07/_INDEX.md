# Archive Index — 2026-07

완료된 PDCA 사이클의 문서를 보관합니다. 문서 안의 코드 링크는 아카이브 기준
상대 경로(`../../../../src/...`)로 다시 맞춰 두었습니다.

| Feature | Cycle | Match Rate | 기간 | 문서 |
|---------|:-----:|:----------:|------|------|
| [day1-template](day1-template/) | #2 | **100%** | 2026-07-28 → 2026-07-30 | Plan · Design · 모듈 증거 6종 · Render Spike · Check/Act 분석 · 완료 리포트 |

## day1-template

Before/After 분할 비교 영상 템플릿(Day 1 vs Day 30)과, 이후 UA 포맷을 얹을 템플릿
판별자 기반. 스키마 v1 → v2 (`sections` + `templateSettings` 판별 유니온).

| 항목 | 값 |
|------|-----|
| Match Rate | 100% (Check 98% → Act 이후 100%) |
| Success Criteria | 6/6 |
| Functional Requirements | 15/15 (FR-D01 ~ FR-D15) |
| Gap | 7건 전부 해소 (Critical 0) |
| 렌더 성능 | 3장면 대비 15초 1.04× · 60초 1.05× (게이트 1.5×) |
| 최종 검증 | 유닛 272 · E2E 27(+1 옵트인 skip) · `tsc -b` · `vite build` |
| 관련 커밋 | `ad50ef5` (module-1) · `e1b61cc` (module 3~6 소스) · `727c5fa` (모듈 문서) · `ada8766` (Check gap 수정) · `cd8d9fe` (완료 리포트) |
| 외부 저장소 | `mkt_bannerdesigner` `ef6e33a` — app-badge 16:9(1920×1080) 레이아웃. Day1 엔드카드 좌표의 출처 |

**시작점**: [완료 리포트](day1-template/day1-template.report.md) — Executive Summary,
Success Criteria 최종 상태, Decision Record(D1~D15), 회고가 모두 여기 있습니다.

**주의**: `day1-template/day1-template.plan.md` §2.1의 앱아이콘 좌표표와
`src/domain/day1/endCard.ts`는 bannerdesigner의 app-badge CSS를 복제한 값입니다.
그쪽 레이아웃이 바뀌면 두 곳을 함께 갱신해야 합니다.
