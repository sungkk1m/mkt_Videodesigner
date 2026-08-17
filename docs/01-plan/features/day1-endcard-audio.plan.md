# day1-endcard-audio Plan

> PDCA cycle: 엔드카드 영상 모드의 오디오를 살린다 (기존 FR-05 "항상 무음" 결정을 뒤집는 사이클).
> 작성일: 2026-08-17 · 요구 확인: Checkpoint 4문항 사용자 확정 완료

## Executive Summary

| 관점 | 내용 |
|---|---|
| Problem | 엔드카드 영상은 설계상 항상 무음(endcard-video FR-05)이라, 사운드 로고·징글이 포함된 엔드카드 소재의 오디오가 산출물에서 사라진다(첨부 렌더 실측: 13–15s −91dB 디지털 무음으로 확인). |
| Solution | 영상 모드 한정 전용 토글+볼륨(기본 켜짐 100%)으로 엔드카드 영상의 오디오를 트림 구간·루프와 함께 재생하고, 종료 0.25s 페이드아웃을 적용한다. BGM과는 그대로 믹스. |
| Function UX Effect | 엔드카드 사운드 로고가 산출물에 실리고, 게임플레이(패널) 오디오와 독립적으로 레벨 조절 가능. |
| Core Value | 브랜드 사운드가 있는 엔드카드 소재를 재가공 없이 그대로 활용. |

## Context Anchor

| 항목 | 내용 |
|---|---|
| WHY | 멀티컷 캐러셀·사운드 로고형 엔드카드 소재의 오디오가 전부 소실됨 — 사용자 실산출물에서 확인 |
| WHO | UA 매니저(에디터 사용자) |
| RISK | 기본 켜짐이라 기존 프로젝트의 렌더 결과가 무음→유음으로 변화(의도된 결정), 루프 경계·15s 컷의 팝 노이즈, 미리보기/렌더 볼륨 곡선 불일치 |
| SUCCESS | SC1–SC6 충족, 실렌더 오디오 레벨 측정으로 켜짐/꺼짐/페이드 증명 |
| SCOPE | EndCardScene + endCard 스키마/커맨드 + 인스펙터 UI. 배너 모드·패널·BGM 경로 무변경 |

## 1. Requirements

- **FR-01 전용 토글+볼륨**: 엔드카드 영상 모드에 "영상 오디오" 토글과 볼륨 슬라이더(0–100%)를 추가한다. 기본 켜짐·100%. 배너+아이콘 모드는 어떤 변화도 없다.
- **FR-02 트림·루프 추종**: 오디오는 선택한 트림 구간 [inMs, outMs]를 따르고, 구간이 3초 미만이면 영상 루프와 함께 소리도 루프된다 (`@remotion/media` Video의 네이티브 loop+trim 오디오 사용 — 별도 Audio 트랙 없음).
- **FR-03 종료 페이드아웃**: 엔드카드 마지막 0.25s 동안 선형 페이드아웃해 루프 중간 컷의 팝 노이즈를 방지한다. 볼륨 곡선은 순수 함수로 두어 미리보기와 렌더가 동일하다.
- **FR-04 BGM 믹스**: BGM과 엔드카드 오디오는 그대로 섞인다(자동 덕킹 없음). 각자의 볼륨으로 조절.
- **FR-05 하위 호환**: zod `.default()`만으로 기존 v2 문서가 열린다(마이그레이션 0줄). 기본 켜짐이므로 기존 영상 엔드카드 프로젝트는 다음 렌더부터 소리가 실린다 — 사용자 확정 사항.
- **FR-06 미리보기 동등**: 중앙 Player는 동일 컴포지션이므로 자동 적용. 인스펙터 트림 프리뷰(TrimStrip)는 계속 무음 유지(트림 위치 확인용) — Non-goal로 명시.

## 2. Success Criteria

- **SC1** 스키마 unit: 기존 v2 JSON 파싱 시 `videoAudioEnabled: true`, `videoAudioVolume: 1`로 기본 적용, 볼륨 범위 [0,1] 검증.
- **SC2** 커맨드 unit: `updateDay1EndCard` patch로 토글/볼륨 갱신, 볼륨 클램프(iconAdjust와 동일 패턴).
- **SC3** 페이드 함수 unit: `endCardAudioVolumeAt(frame, fps, durationInFrames, volume)` — 본문 구간 = volume, 마지막 0.25s 선형 감쇠, 경계값(0프레임·마지막 프레임) 정확.
- **SC4** e2e(L2): 영상 모드에서만 토글+슬라이더 노출, 배너 모드 비노출, 상태 반영.
- **SC5** e2e(L3 실렌더): ① 켜짐 렌더의 12–15s 오디오 레벨이 무음 임계보다 큼(픽스처 톤 활용) ② 꺼짐 렌더는 12–15s 무음 유지 ③ 마지막 0.25s가 본문 대비 감쇠. ffmpeg volumedetect/astats 측정.
- **SC6** `tsc -b` + 전체 unit/e2e 스위트 그린.

## 3. Scope

**변경**: `domain/editor/schema.ts`(필드 2), `domain/editor/types.ts`(렌더 props), `domain/editor/project.ts`(patch 클램프 + buildEndCardProps), `domain/day1/endCard.ts`(페이드 순수 함수), `compositions/day1/EndCardScene.tsx`(muted 조건 + volume 콜백), `features/editor/Day1Inspector.tsx`(토글+슬라이더), 관련 unit/e2e.

**Non-goals**: 인스펙터 트림 프리뷰 오디오, BGM 자동 덕킹, 패널 오디오 경로 변경, 배너 모드.

## 4. Risks

| 리스크 | 대응 |
|---|---|
| 기존 프로젝트 산출물 변화(무음→유음) | 사용자 확정 기본값. Report에 Decision으로 기록, 토글로 끌 수 있음 |
| 루프 경계 팝 노이즈 | 소스 자체 경계는 소재 특성이라 범위 외, 15s 컷은 FR-03 페이드로 방지 |
| Player/렌더 볼륨 곡선 불일치 | SceneVideo `volume`이 per-frame 콜백을 지원("ducking is identical in preview and render" 기존 주석), 순수 함수 공유 |
| e2e 오디오 측정 픽스처 | 픽스처는 패널 구분용 톤을 이미 포함(generate-editor-fixture) — day1-panel-b.mp4를 엔드카드 소스로 사용 |

## 5. Design Notes (경량 설계 — 이전 사이클과 동일 방식)

- **스키마**: `endCard`에 `videoAudioEnabled: z.boolean().default(true)`, `videoAudioVolume: z.number().min(0).max(1).default(1)` — endcard-video의 `.default()` 마이그레이션 패턴 재사용.
- **커맨드**: 신설 없이 기존 `updateDay1EndCard(patch)` 확장 — patch에 두 필드 허용, `videoAudioVolume`은 iconAdjust처럼 [0,1] 클램프.
- **렌더 props**: `buildEndCardProps`에 두 필드 통과 (`Day1EndCardRenderProps` 확장).
- **페이드 함수**: `domain/day1/endCard.ts`에 `END_CARD_AUDIO_FADE_S = 0.25` + `endCardAudioVolumeAt(frame, fps, durationInFrames, volume)` — 마지막 fade 구간에서 선형 0 도달.
- **컴포지션**: `EndCardScene` video 분기 — `muted={!endCard.videoAudioEnabled}`, `volume={(frame) => endCardAudioVolumeAt(frame, fps, durationInFrames, endCard.videoAudioVolume)}`. 배너 분기 무변경.
- **UI**: 엔드카드 섹션 video 분기에 토글(`day1-endcard-audio-toggle`) + `PercentField` 볼륨(`day1-endcard-audio-volume`), 영상 없으면 비활성.
