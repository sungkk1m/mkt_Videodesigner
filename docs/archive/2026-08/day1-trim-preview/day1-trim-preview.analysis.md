# day1-trim-preview Gap Analysis

> Check 실행일: 2026-08-17 · 기준 문서: docs/01-plan/features/day1-trim-preview.plan.md (§5 Design Notes 포함, 사용자 요청으로 Design 단계 압축)

## Context Anchor

| 항목 | 내용 |
|---|---|
| WHY | 트림 구간이 선처럼 보여 인지 실패 + 엔드카드 컷 경계 노출 사고 방지 |
| WHO | UA 매니저(에디터 사용자) |
| RISK | 기존 e2e 계약 파손, video seek 정밀도, remotion 루프-트림 프리뷰 |
| SUCCESS | SC1–SC6 전부 충족, 기존 스위트 그린 |
| SCOPE | TrimStrip + Day1Inspector + domain trim 커맨드, 렌더 컴포지션 무변경 |

## 1. FR Verification

| FR | 내용 | 판정 | 증거 |
|---|---|---|---|
| FR-01 | 최소 폭 34px + 그립 + 길이 라벨, 우측 클램프 | ✅ | 400s 합성 소스: 자연 폭 4.3px → 34.0px 렌더, 우측 끝 드래그 시 오버플로 −1px(트랙 내부). e2e: 그립 2개·"6.0s" 라벨 어서션 통과 |
| FR-02 | 드래그 커밋 시 [in, in+구간] 1회 재생 | ✅ | e2e + 런타임 프로브 `dragStartedPlayback:true`, 종료 후 시작 프레임 정지 |
| FR-03 | 프리뷰 클릭 재생/일시정지 토글 | ✅ | e2e: click→paused:true→click→paused:false |
| FR-04 | img 프리뷰 계약 유지 | ✅ | day1-trim-ux.spec.ts 9/9 그린(E3 src 갱신 포함). 재생 중 img는 opacity:0로 측정 가능 유지 |
| FR-05 | 아웃 핸들 0.5–3.0s 조절, 이동 시 길이 보존 | ✅ | unit 2건(클램프·보존), e2e 3건(3000→2000→500 floor→3000 cap, 이동 후 길이 2000 유지), 포인터 드래그 프로브 lenMs:2000 |
| FR-06 | 3초 미만 자동 루프 + 안내·채움 시각화 | ✅ | 프리뷰 루프 랩 실측: t=0.36s에서 2.4s 재생 후 t=0.73s(2s 경계 랩). 렌더 경로 무변경 — endcard-video L3 렌더 e2e 그린. loop-note/loop-fill e2e 어서션 통과 |
| FR-07 | 엔드카드 커밋 시 3초 슬롯 기준 1회 재생 | ✅ | 핸들 릴리즈 → playsOnRelease:true, 3초 슬롯 소진 후 {t:0.00, paused:true} |
| FR-08 | 하위 호환(스키마·마이그레이션 불필요) | ✅ | persistence-recovery e2e 3/3(v1 임포트 포함), 스키마 무변경, 기존 outMs=in+3s 값 그대로 유효 |

## 2. Success Criteria

| SC | 판정 | 증거 |
|---|---|---|
| SC1 도메인 클램프/보존 unit | ✅ | day1Commands.test.ts 37/37 (신규 2건 포함) |
| SC2 2s 구간 → 프레임 정확 반영 | ✅ | day1Props.test.ts: inMs 2600/outMs 4600 → 78/138 frames @30fps |
| SC3 기존 스위트 그린 | ✅ | unit 363/363 · e2e 53 passed, 0 failed (2 skipped = opt-in 실렌더 계측) |
| SC4 신규 e2e | ✅ | day1-trim-preview.spec.ts 3/3 |
| SC5 tsc | ✅ | `tsc -b` exit 0 |
| SC6 브라우저 시각 검증 | ✅ | 스크린샷 5장: 패널 구간 표시·재생 상태·엔드카드 2s 루프 표시·400s 최소폭·핸들 드래그 |

## 3. Runtime Verification 요약

- **L2(UI)**: 신규 스펙 3건 + 기존 day1 스펙 전부 그린.
- **L3(렌더)**: 렌더 경로 무변경 검증 — day1-endcard-video 렌더 2건(트림 윈도우·2s 소스 루프), day1-trim-ux E2(스트립 지점 = MP4 시작 지점) 그린.
- **수동 프로브**: 400s 소스 최소폭·우측 클램프, 재생/일시정지/루프 랩/슬롯 종료 정지 실측.

## 4. 발견 사항 (Non-gap)

1. **키보드 길이 조절은 재생을 트리거하지 않음** — FR-02의 "드래그 커밋만 재생" 결정과 일관(연타 시 소음 방지). 의도된 동작으로 기록.
2. 검증 중 프로브 스크립트 결함(뷰포트 밖 raw mouse 이벤트) 1건 — 앱 결함 아님, 프로브 수정 후 전 항목 통과.

## 5. Match Rate

**100%** — FR 8/8, SC 6/6 직접 증거로 충족. Iteration 불필요(≥90%).
