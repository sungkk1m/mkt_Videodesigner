# day1-endcard-video Gap Analysis

> **Project**: mkt-videodesigner
> **Date**: 2026-08-17
> **Design Doc**: [day1-endcard-video.design.md](day1-endcard-video.design.md)
> **Verdict**: **Match Rate 100% (structural 100 · functional 100 · runtime 100)** — 렌더 차단 이슈 0건

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 엔드카드 표현이 완성 배너 PNG 하나로 고정되어 애니메이션 엔드카드를 만들 수 없다 |
| **WHO** | Day1 템플릿으로 UA 소재를 뽑는 퍼포먼스 마케터 (본인) |
| **RISK** | 3초 미만 루프 이음선 (비차단 안내로 대응) — R2(`<Video>`+`<Loop>`)는 Design §1.3에서 해소됨 |
| **SUCCESS** | 택일이 저장 후 유지 + v2 문서 무마이그레이션 + 미리보기=렌더로 3초 채움 |
| **SCOPE** | M1 도메인 / M2 컴포지션 / M3 UI / M4 e2e — 전부 완료 |

## 1. Strategic Alignment

| 결정 | 이행 | 근거 |
|------|:---:|------|
| [Plan] mode 플래그 + 슬롯, 마이그레이션 0줄 | ✅ | zod `.default` 3개만으로 기존 v2 문서 파싱 통과 (U-01 실증). `schemaVersion` bump 없음, `migrate.ts` 무변경 |
| [Plan] 3초 미만 루프, 렌더 비차단 | ✅ | L3 #2 — 2초 픽스처가 렌더 차단 없이 3초를 채움, 14.5s 지점 실픽셀 확인 |
| [Plan] TrimStrip 재사용 | ✅ | 신규 트림 UI 0줄 — 호출부 배선만 (`sectionDurationMs={DAY1_END_CARD_MS}`) |
| [Plan] 무음 고정, 옵션 없음 | ✅ | `SceneVideo muted` 하드코딩, UI에 오디오 옵션 부재 |
| [Design C] 패널 대칭 커맨드 | ✅ | `setDay1EndCardVideo`/`setDay1EndCardTrimInMs`가 `setDay1PanelSource`/`setDay1TrimInMs`와 동일 구조 |
| [Design D-01] 항상 loop, 래퍼 없음 | ✅ | `EndCardScene`에 `<SceneVideo loop muted>`, 조건 분기 0 |
| [Design D-04] videoTrim 패치 차단 | ✅ | `Day1EndCardPatch`가 `Omit<..., 'videoTrim'>` — 타입 수준 차단 |

## 2. Success Criteria — 6/6 Met

| SC | 판정 | 근거 |
|----|:---:|------|
| SC1 모드 전환 시 반대편 보존 | ✅ | U-07 (banner·iconAdjust·video·trim 왕복 보존) + L2 #1 |
| SC2 v2 문서 무마이그레이션 | ✅ | U-01 — mode/video/videoTrim 키 없는 문서가 `'banner'`/`null`/`{0,0}`으로 파싱 |
| SC3 트림 3초 창이 미리보기=렌더 | ✅ | U-06 (30fps 프레임 변환) + L3 #1 (12s 소스, 13.5s 지점 실픽셀) |
| SC4 2초 영상 루프 | ✅ | L3 #2 — 루프 미작동이면 검정이 되는 14.5s 지점에서 실픽셀 |
| SC5 무음 | ✅ | `muted` 하드코딩 — 코드 검사로 확인 (오디오 트랙 경로 자체가 없음) |
| SC6 배너 모드 회귀 0 | ✅ | 기존 엔드카드 유닛·e2e 무수정 통과 (전체 스위트 그린) |

## 3. Runtime Verification

| Suite | 결과 |
|-------|------|
| `tsc -b` | 통과 |
| Vitest | **360/360** (기존 353 + U-01~08 신규 7) |
| 신규 e2e `day1-endcard-video.spec.ts` | **4/4** — L2 토글·조건부·루프 안내 + L3 실 렌더 2건(픽셀 검증) |
| 전체 Playwright | 50 passed / 1 skipped(longform opt-in) — §5 최종 런 |

## 4. Check가 잡은 실결함 2건 (구현 중 발견·수정)

1. **[Critical] 엔드카드 영상 object URL이 즉시 회수됨** — `EditorWorkspace`의 `session.retain` 목록에 `endCard.video.id`가 없어, 업로드 직후 URL이 폐기되고 렌더 시 `videoUrl`이 null → 엔드카드가 `CANVAS_COLOR`로만 렌더. **L3 픽셀 단언이 잡았다** (출력 샘플 RGB (10,14,17) = 캔버스색 — 임계값 문제가 아니라 영상 부재의 결정적 증거). 1줄 수정 후 4/4 그린. Design §6.2 Consumers 표가 retain 목록을 나열하지 않은 것이 원인 — 세션 URL 수명주기는 향후 미디어 슬롯 추가 시 필수 점검 항목.
2. **[Medium] import 시 영상 상태 강등 누락** — `markSourceUnresolved`가 패널만 `missing`으로 강등하고 엔드카드 video를 몰랐음. U-02 왕복 테스트가 잡음. 패널과 같은 규칙으로 수정. (배너/앱아이콘의 동일 미강등은 이 사이클 이전부터의 동작이라 손대지 않음 — §6 잔여)

두 건 모두 같은 교훈: **미디어 슬롯 하나는 스키마 필드가 아니라 "스키마 + 세션 URL 수명주기 + import 강등"의 3면 계약**이다.

## 5. Design 대비 편차

| # | 편차 | 심각도 | 처리 |
|---|------|:---:|------|
| D1 | 배지 계산 `endCardAssetCount` 변수 → `endCardAssetBadge` 문자열로 형태 변경 | None | §5.5 요구(모드별 카운트)의 자연스러운 구현 |
| D2 | 영상 AssetField의 `previewUrl`을 null로 고정 | Low | AssetField의 미리보기는 `<img>` 기반이라 영상 URL을 넣으면 깨진 이미지가 뜸. 파일명 표시 + TrimStrip 썸네일이 시각 확인을 담당 |
| D3 | video 모드에서 TrimStrip을 영상 유무와 무관하게 렌더 | None | 패널 관행과 동일 — TrimStrip이 null url을 자체 처리 |

## 6. 잔여 (비차단, 후속 정리 대상)

- 배너/앱아이콘도 import 시 `missing` 강등이 안 되는 기존 동작 — 이번 사이클 밖 (§4-2)
- 루프 이음선 품질(Plan R1)은 도구가 판단할 수 없음 — 실사용에서 미리보기로 확인하는 운영 리스크로 유지
- `endcard-2s.mp4` 픽스처(7KB)가 저장소에 추가됨 — 바이너리지만 테스트 필수 자산

**Verdict: 갭 없음. Match Rate 100% — Report 진행 가능.**
