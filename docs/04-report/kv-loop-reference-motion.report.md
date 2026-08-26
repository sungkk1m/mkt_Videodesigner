# kv-loop-reference-motion — Completion Report

> **Project**: mkt_videodesigner
> **Feature**: kv-loop-reference-motion
> **Date**: 2026-08-26
> **Status**: Complete — Match Rate 100% (SC 8/8: 측정 7, 논리적 커버 1)
> **Cycle**: Plan → 레퍼런스 실측 → Design → M0 스파이크 → M1~M3 구현 → M4 실기기 검증 → M5 성능 판정, 하루 안에

---

## 1. 무엇이 배송됐나

영상팀 디자이너의 5개 항목이 루핑 템플릿의 동작이 됐다.

| 요청 | 구현 |
|---|---|
| 왕복 줌 (R-1/R-2) | 진행도의 3지점 보간 `[0, mid, last] → [0,1,0]`, 구간별 easeInOut. 마지막 프레임 진행도가 정확히 0이라 컷 양쪽 배율이 구조적으로 일치 |
| 컷 전환 (R-3) | `kv-loop` 전용 전환 하한 0 (0 = 컷). 3장면의 `MIN_TRANSITION_MS`는 그대로 |
| 가우시안 북엔드 (R-4/R-5) | 장면+오버레이를 감싸는 `BlurBookend` 한 장, 세기 연동 3σ 오버스캔, 본편 프레임 filter 없음. 기본 333ms·30px — 레퍼런스 실측치 |
| 조절 가능 | 인스펙터에 왕복 토글·컷 힌트·블러 길이/세기 |
| 호환성 | 저장 문서는 세 필드 `.default()`로 전부 "꺼짐" 파싱 — 마이그레이션 없음 |

새 프로젝트 기본값: 왕복 켬 · 컷 · 블러 333ms/30px · 검정 페이드 0 (FR-L17을
의도적으로 대체 — 레퍼런스 실측이 근거).

## 2. Success Criteria — 8/8

| SC | 결과 | 근거 |
|---|---|---|
| SC1 왕복 대칭·정점 중앙 | ✅ 실기기 실측 | 1.000→1.050→**1.100**(중앙)→1.046→1.000, 이론값 그대로 |
| SC2 하드 컷 | ✅ | 경계 48.9~104.2 vs 내부 7.7 |
| SC3 컷 무봉합·사이클 동일 | ✅ | 양쪽 1.000; 반복 대조 1.000 (rms 0.8) |
| SC4 블러 램프 | ✅ | 양끝 정확히 20프레임, 본편 무변화 |
| SC5 가장자리 누출 없음 | ✅ | 테두리 181 vs 캔버스 13 |
| SC6 기존 프로젝트 무영향 | ✅ 논리적 | 스키마 기본값 단위 테스트. 실물은 기존 프로젝트 열람 시 자연 확인 |
| SC7 미리보기 = 렌더 | ✅ | Player f0 = 렌더 f0 (전면 블러) + DOM E2E |
| SC8 회귀 없음 | ✅ | 유닛 589 · DOM E2E 7 · tsc/build 클린 |

NFR-R02: 실기기 `createFrame=991ms`/900프레임 — 블러 초과분 ≈2% < 5% 게이트.
(컨테이너 소프트웨어 경로의 1.25초/프레임 경고는 실기기에서 소멸 —
[m4-render-verification](../03-analysis/kv-loop-reference-motion.m4-render-verification.md) §3.)

## 3. 결정 전부 확정

D-01~D-11 — [Plan §1.5.1](../01-plan/features/kv-loop-reference-motion.plan.md).
마지막 항목 D-10은 M4 검수에서 **강도 0.5 유지**로 확정: 정점 1.10이 분명히
읽히되 구도가 무너지지 않고, 값 자체가 UI에서 조절 가능하다.

## 4. 증거 문서

| 문서 | 내용 |
|---|---|
| [reference-measurement](../03-analysis/kv-loop-reference-motion.reference-measurement.md) | 레퍼런스(언더다크) 실측 — 구성·컷·블러·원화 애니메이션 층 |
| [m0-blur-spike](../03-analysis/kv-loop-reference-motion.m0-blur-spike.md) | 컨테이너 블러의 렌더 경로 실증 (5/5 PASS) + 경로별 비용 |
| [m4-render-verification](../03-analysis/kv-loop-reference-motion.m4-render-verification.md) | 실기기 H.264 렌더 판정 |
| [m4-runbook](../01-plan/kv-loop-reference-motion.m4-runbook.md) | 실기기 절차 + 코덱 검증 + Pages 브랜치 배포·원복 |

## 5. 남은 것 (이 사이클 밖)

- **kv-object-animation** — 템플릿의 최종 목표(오브젝트 AI/직접 지정 + 이펙트).
  [Draft Plan](../01-plan/features/kv-object-animation.plan.md)이 결정 대기 상태다
- 라이선스 — 렌더 결과물의 실제·유료 캠페인 사용 전 Remotion Company License
  구매 (기존 조건 유지)

## Version History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0.0 | 2026-08-26 | 김성권 / Claude | 사이클 완료 |
