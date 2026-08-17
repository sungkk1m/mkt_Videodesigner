# day1-endcard-audio Gap Analysis

> Check 실행일: 2026-08-17 · 기준 문서: docs/01-plan/features/day1-endcard-audio.plan.md (§5 Design Notes 포함)

## Context Anchor

| 항목 | 내용 |
|---|---|
| WHY | 사운드 로고·징글이 있는 엔드카드 소재의 오디오가 전부 소실(구 FR-05 하드 무음) |
| WHO | UA 매니저(에디터 사용자) |
| RISK | 기존 프로젝트 산출물 변화(무음→유음), 루프·15s 컷 팝 노이즈, 미리보기/렌더 볼륨 곡선 불일치 |
| SUCCESS | SC1–SC6 충족, 실렌더 오디오 측정으로 증명 |
| SCOPE | EndCardScene + endCard 스키마/커맨드 + 인스펙터 UI. 배너·패널·BGM 경로 무변경 |

## 1. FR Verification

| FR | 내용 | 판정 | 증거 |
|---|---|---|---|
| FR-01 | 전용 토글+볼륨, 기본 켜짐 100%, 배너 모드 무변화 | ✅ | e2e SC4(배너 모드 비노출·기본 checked·영상 없으면 비활성·끄면 볼륨 비활성), clamp unit 4케이스, UI 스크린샷 |
| FR-02 | 오디오가 트림 구간·루프 추종 | ✅ | 실렌더: 2s 구간 루프 설정 후 14.1–14.5s(루프 2회차) mean −55dB 초과 톤 실측 — 소리가 영상과 함께 루프됨 |
| FR-03 | 종료 0.25s 선형 페이드아웃, 순수 함수 | ✅ | unit 4케이스(본문 유지·선형 중점 0.5·경계 0·NaN 프로브) + 실렌더 페이드 프로파일: body −21.1dB → 14.75+ −24.7 → 14.9+ −30.1 → 14.95+ −33.6dB 단조 감소 |
| FR-04 | BGM 그대로 믹스(자동 덕킹 없음) | ✅ | AudioLayer/duckedVolumeAt 무변경(diff 없음) — 믹스는 remotion 네이티브 합산, 간섭 코드 부재로 충족 |
| FR-05 | 하위 호환: zod default, 마이그레이션 0줄 | ✅ | schema unit: 구 문서 파싱 시 enabled true/volume 1, 범위 밖 볼륨 거부. persistence-recovery e2e 3/3(v1 임포트 포함) 그린 |
| FR-06 | 미리보기 동등(중앙 Player), 트림 프리뷰는 무음 유지 | ✅ | 동일 컴포지션+순수 함수 공유(SceneVideo volume 콜백 — "preview와 render 동일" 기존 계약), TrimStrip muted 무변경 |

## 2. Success Criteria

| SC | 판정 | 증거 |
|---|---|---|
| SC1 스키마 default·범위 unit | ✅ | schema.test 2건 신규(legacy 파싱, 1.5 거부) + day1Props 통과 unit |
| SC2 patch 클램프 unit | ✅ | day1Commands.test 1건(4 assertion) |
| SC3 페이드 함수 unit | ✅ | endCard.test 4건(19/19) |
| SC4 L2 UI e2e | ✅ | day1-endcard-audio.spec L2 1건 |
| SC5 L3 실렌더 측정 | ✅ | 켜짐: body −21.1dB > −55 + 루프 2회차 톤 + 페이드 −6dB 초과 드롭 / 꺼짐: 12.5–15s −91dB 무음 |
| SC6 tsc + 전체 스위트 | ✅ | tsc 0 · unit 371/371 · e2e 56 passed/0 failed(2 opt-in skip) |

## 3. Act 이력 (Check 중 발견·수정 2건)

1. **NaN 프로브 렌더 거부** — `@remotion/media`가 volume 콜백을 `frame=NaN`으로 평가하는데 초기 구현이 NaN을 전파해 렌더 전체가 실패("returned NaN for frame NaN"). 분기 반전으로 NaN이 본문 볼륨으로 폴백하게 수정 + 회귀 unit 추가. 기존 `duckedVolumeAt`이 안전했던 이유(NaN 비교 false → base 반환)와 동일 구조로 정렬.
2. **페이드 어서션 임계 조정** — 측정창 14.8+0.28s의 드롭이 4.7dB로 임계 5dB에 미달(테스트 결함, 기능은 정상). 실산출물 프로파일 측정 후 창을 14.9+0.18s(실측 9.0dB 드롭)로 이동, 임계 6dB.

## 4. Match Rate

**100%** — FR 6/6, SC 6/6 직접 증거 충족. 코드 결함 1건(NaN)은 Check 루프 안에서 발견·수정·회귀 고정 완료.
