# day1-endcard-video Completion Report

> **Project**: mkt-videodesigner
> **Date**: 2026-08-17
> **Match Rate**: 100% (iteration 0회)
> **Documents**: [Plan](day1-endcard-video.plan.md) · [Design](day1-endcard-video.design.md) · [Analysis](day1-endcard-video.analysis.md)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 엔드카드가 배너 PNG + 앱아이콘 PNG 조합으로 고정되어, 일러스트를 애니메이션한 영상을 마지막 3초에 쓸 방법이 없었다. |
| **Solution** | `endCard.mode: 'banner' \| 'video'` 택일. zod `.default` 3개로 마이그레이션 0줄, 패널과 대칭인 커맨드 2개, `@remotion/media`의 네이티브 `loop`로 3초 미만 소스를 채움, TrimStrip 재사용으로 3초 창 선택. |
| **Function/UX Effect** | 인스펙터에서 [배너+아이콘\|영상] 토글. 영상 모드는 업로드+트림+루프 안내만 남고, 안을 오가도 반대편 설정이 보존된다. 미리보기와 렌더가 같은 스냅샷·같은 루프 수식을 쓴다. |
| **Core Value** | 엔드카드가 "배너디자이너 산출물"에서 "무엇이든 3초"로 — 광고 소재의 마지막 3초가 실험 가능해졌다. |

### Value Delivered

| 항목 | 계획 | 실제 |
|------|------|------|
| 수정 파일 | ~10개 ~200줄 | 15개 +574/-110 (신규 e2e 스펙·유닛 8케이스 포함) |
| 신규 파일 | e2e 1 + 픽스처 1 | 동일 (`day1-endcard-video.spec.ts`, `endcard-2s.mp4` 7KB) |
| 마이그레이션 코드 | 0줄 | **0줄** (U-01이 증명) |
| 테스트 | 전체 그린 | `tsc` 통과 · 유닛 **360/360** · e2e **50 passed/1 skipped** · 신규 스펙 4/4 |

## Key Decisions & Outcomes

| 결정 | 이행 | 결과 |
|------|:---:|------|
| [Plan] mode 플래그 + 슬롯 (판별 유니온 기각) | ✅ | 전환 시 반대편 설정 보존이 U-07·L2로 실증. flat props 덕에 기존 배너 테스트 무수정 |
| [Plan] 3초 미만 = 루프, 렌더 비차단 | ✅ | 2초 픽스처 실 렌더에서 14.5s 지점 실픽셀 (루프 미작동 시 검정) |
| [Design D-01] `<Video loop>` 네이티브, 항상 on | ✅ | `<Loop>` 래퍼 0, 조건 분기 0. 미리보기·렌더 동일 수식 |
| [Design D-04] videoTrim 패치 차단 | ✅ | 타입 수준 차단 — reconcile 우회 불가 |
| [Design D-06] 2초 픽스처 ffmpeg 생성 | ✅ | `day1-panel-b.mp4`에서 `-t 2` 추출 |

## Success Criteria Final Status — 6/6 Met

SC1 전환 보존 ✅ · SC2 v2 무마이그레이션 ✅ · SC3 트림 창 미리보기=렌더 ✅ · SC4 2초 루프 ✅ · SC5 무음 ✅ · SC6 배너 회귀 0 ✅ (근거: [analysis §2](day1-endcard-video.analysis.md))

## Learnings

1. **미디어 슬롯은 3면 계약이다** — 스키마 필드 + 세션 URL 수명주기(`session.retain`) + import 강등(`markSourceUnresolved`). 이번에 뒤 2면을 각각 놓쳤다 잡았다: retain 누락은 엔드카드를 통째로 검게 만들었고(L3 픽셀 단언이 검출), 강등 누락은 U-02 왕복 테스트가 잡았다. 다음에 미디어 슬롯을 추가하면 이 3면을 체크리스트로.
2. **픽셀 단언이 값을 했다.** "렌더 성공 + 파일 길이 정상"만 봤다면 검은 엔드카드가 그대로 통과했다. 출력 샘플 RGB가 정확히 `CANVAS_COLOR`였던 것이 "영상 부재"의 결정적 증거.
3. **네이티브 기능 확인이 설계를 줄였다.** Plan R2는 `<Loop>` 래퍼 합성 문제를 걱정했지만, 패키지 소스 확인으로 loop가 트림과 네이티브 합성임을 알아내 래퍼·직교화·조건 분기 전부가 불필요해졌다.

## 잔여 (비차단)

- 배너/앱아이콘의 import 미강등 (이 사이클 이전부터의 동작)
- 루프 이음선 품질은 소재별 육안 판단 (Plan R1 — 안내 문구로 대응)

## Next

- `/pdca archive day1-render-fps day1-endcard-video` — 두 사이클 아카이브
- 후속 아이디어(선택): 엔드카드 영상의 리프레이밍(scale/x/y), three-scene CTA에도 동일 패턴 적용
