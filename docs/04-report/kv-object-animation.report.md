# kv-object-animation — Completion Report

> **Project**: mkt_videodesigner
> **Feature**: kv-object-animation
> **Date**: 2026-08-27
> **Status**: Complete — Match Rate 100% (SC 7/7 측정 PASS)
> **Cycle**: Plan(D-01~D-06) → Design → M0 스파이크 → M1~M3 구현 → M4 레퍼런스 실측 → M5 실기기 판정, 이틀 안에

---

## 1. 무엇이 배송됐나

키비주얼 위에 오브젝트를 **직접 지정**하고(드래그), 지정한 곳에 이펙트를
거는 층 — 레퍼런스의 마지막 층(불티·글로우 펄스)이 루핑 템플릿의 동작이 됐다.

| 부분 | 구현 |
|---|---|
| 스키마 | 슬롯별 `effects` — discriminated union(`particles` rect / `glow` 점+반경), `.default([])`로 마이그레이션 없음. 시드는 추가 시 1회 생성·저장(D-03) |
| 도메인 | `effects.ts` — 파티클은 (시드, 프레임)의 닫힌 식(수명 주기 + 정수 해시), 글로우는 무시드 주기 함수. 도달 범위(`kvParticlesReach`)도 닫힌 식이라 SC1 판정이 수식을 그대로 쓴다 |
| 렌더 | `KvEffectsCanvas` — 이미지와 **같은 transform 문자열**을 받는 캔버스 레이어(가산 합성). 카메라 추종이 검증이 아니라 구조로 성립(D-04). 이펙트 없으면 캔버스 자체가 없다(NFR-O01) |
| UI | 인스펙터 "이펙트 오브젝트" 섹션(추가·삭제·색·밀도·속도·크기·세기·반경·주기) + 미리보기 오버레이 드래그(영역 이동·리사이즈, 글로우 중심·반경) |
| 기본값 | 발명하지 않고 실측 — M4에서 언더다크 레퍼런스를 정량 측정해 교정 (density 0.2 · speed 0.4 · 8px · 1300ms · TRAVEL 0.03/0.32) |

## 2. Success Criteria — 7/7

실기기 판정의 수치 전체: [m5-render-verification](../03-analysis/kv-object-animation.m5-render-verification.md).

| SC | 결과 | 근거 |
|---|---|---|
| SC1 지정 영역 밖 무변화 | ✅ 실기기 실측 | 도달 밴드 밖 \|on−off\|가 같은 위상의 사이클 반복 diff(=코덱 노이즈 실측치) 이하 — 15/15 위상 버킷 |
| SC2 결정론 | ✅ | 이펙트 원반의 사이클 반복 diff 1.40 luma = off 렌더 1.43 (기여 0). 컨테이너 sha256 비트 동일(M0·M2) |
| SC3 스크럽 = 렌더 | ✅ | 글로우 주기 1296~1313ms·위상 −5°~−1° — 순수 함수 예측(1300ms·0°) 그대로. M0 게이트 ⑤ 0.48/255 |
| SC4 카메라 추종 | ✅ | halo 변위 측정 vs 예측 오차 0.6~2.8px, 정지 가설 잔차 10~47px 전 세그 기각 |
| SC5 성능 게이트 (D-05) | ✅ | on/off 총 렌더 시간 차 **−2.2%** (기준 5%). 이펙트 실비용 ≈0.27ms/프레임 |
| SC6 기존 프로젝트 무영향 | ✅ | off 렌더 배율 곡선이 이전 사이클 실측과 ≤0.001 + `.default([])` 유닛 + M2 하네스 비트 동일 |
| SC7 회귀 없음 | ✅ | 유닛 614 · kv DOM E2E 19 passed·1 skipped · tsc/build 클린. H.264 렌더 E2E는 컨테이너 제약(기존)으로 실기기 프로브가 대신 확정 |

## 3. 결정 전부 확정

D-01~D-06 — [Plan §1.5.1](../01-plan/features/kv-object-animation.plan.md).
마지막으로 열려 있던 D-05(성능 게이트)가 M5에서 수치로 닫혔다: 실기기 총
시간 차 −2.2% < 5%, 컨테이너의 19~25ms/프레임 상한 경고는 실기기에서 소멸
(블러 사이클과 같은 패턴 — 소프트웨어 래스터라이저의 상한은 네이티브 경로의
예측치가 아니다).

## 4. 증거 문서

| 문서 | 내용 |
|---|---|
| [m0-canvas-spike](../03-analysis/kv-object-animation.m0-canvas-spike.md) | 결정론 캔버스 레이어의 렌더 실증 5/5 (드로잉=인코딩, 격리, 카메라 추종, 비용) |
| [m4-reference-measurement](../03-analysis/kv-object-animation.m4-reference-measurement.md) | 레퍼런스 실측 — 파티클 2집단·글로우 주기, 기본값 교정 |
| [m5-render-verification](../03-analysis/kv-object-animation.m5-render-verification.md) | 실기기 H.264 on/off 판정 — SC1~SC7, D-05 확정 |
| [m5-runbook](../01-plan/kv-object-animation.m5-runbook.md) | 실기기 절차 + Pages 브랜치 배포·원복 |

## 5. 남은 것 (이 사이클 밖)

- **지정 UX의 다음 단계 — 요청자 확인(2026-08-27)**: "클릭 하나로 캐릭터
  같은 오브젝트를 지정"하고 싶다. 현 사이클의 드래그 지정은 D-01의 의도적
  1차 범위이고, 클릭→마스크는 Plan §1.4에 예약된 **AI 지정 사이클**(온디바이스
  세그멘테이션, 제안까지만·확정은 사용자)이다. 다음 Plan의 1순위 입력.
- **오브젝트 모션 — 새 요구(2026-08-27)**: 지정한 오브젝트 자체에 줌인/줌아웃
  같은 **모션**을 걸고 싶다. 현 이펙트 2종(파티클·글로우)은 오브젝트 위에
  빛을 얹는 층이고, 오브젝트를 움직이는 층이 아니다 — 정적 원화에서
  오브젝트만 확대하면 배경에 구멍이 생기므로 마스크(AI 지정)와 채움/느슨한
  경계 전략이 선행돼야 한다. AI 지정 사이클의 Plan에서 범위를 결정할 것.
- 라이선스 — 렌더 결과물의 실제·유료 캠페인 사용 전 Remotion Company License
  구매 (기존 조건 유지).

## Version History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0.0 | 2026-08-27 | 김성권 / Claude | 사이클 완료 — SC 7/7 |
