# day1-trim-preview Plan

> PDCA cycle: 트림 구간의 시각화·재생 프리뷰와 엔드카드 가변 루프 구간.
> 작성일: 2026-08-17 · 승인: 시안(인터랙티브 목업) 사용자 확정

## Executive Summary

| 관점 | 내용 |
|---|---|
| Problem | 긴 원본(예: 417s)에서 6초 트림 윈도우가 4px 선으로 렌더돼 "구간"으로 인지되지 않고, 선택한 구간이 실제로 어떤 영상인지 렌더 전에는 알 수 없다. 엔드카드는 3초 창이 고정이라 멀티컷 캐러셀 소스에서 컷 경계가 카드 안에 걸린다. |
| Solution | 트림 윈도우에 최소 시각 폭+경계 그립+길이 라벨을 부여하고, 구간 확정 시 프리뷰에서 해당 구간을 1회 재생(클릭 토글). 엔드카드는 아웃 핸들로 구간을 0.5–3.0s로 조절하고 3초 미만이면 슬롯을 자동 루프로 채운다(렌더 엔진은 기존 loop 그대로). |
| Function UX Effect | "숫자 입력 후 렌더로 확인" → "보면서 잡고 즉시 재생으로 확인". 엔드카드는 원하는 단일 컷만 잡아 루핑 가능. |
| Core Value | UA 소재 제작 반복 속도 향상: 트림 시행착오 렌더 제거, 엔드카드 컷 사고 방지. |

## Context Anchor

| 항목 | 내용 |
|---|---|
| WHY | 트림 구간 인지 실패(선처럼 보임)와 엔드카드 컷 경계 노출이 실제 산출물 품질 사고로 이어짐(첨부 렌더에서 재현 확인). |
| WHO | UA 매니저(에디터 사용자) — 패널 A/B·엔드카드 트림을 자주 조정. |
| RISK | 기존 e2e 계약(윈도우 슬라이더·img 프리뷰 src·고정 폭) 파손, `<video>` seek 정밀도, remotion 루프-트림 프리뷰 동작. |
| SUCCESS | SC1–SC6 전부 충족, 기존 스위트 그린 유지. |
| SCOPE | TrimStrip + Day1Inspector + domain trim 커맨드. 렌더 컴포지션 무변경. |

## 1. Requirements

### A. 패널 A/B — 트림 구간 시각화 + 재생 프리뷰
- **FR-01 구간 가시성**: 트림 윈도우에 최소 시각 폭(34px)을 보장하고 양끝 경계 그립과 구간 길이 라벨("6.0s")을 표시한다. 위치·폭은 실제 타임라인 비율을 유지하되(최소 폭 초과 시), 트랙 우측 끝을 넘지 않게 클램프한다.
- **FR-02 커밋 시 1회 재생**: 스트립 드래그를 놓는 순간 프리뷰 `<video>`가 [inMs, inMs+구간] 을 1회 재생하고, 끝나면 시작 프레임에서 정지한다. 숫자 입력(Trim In 필드)은 재생을 트리거하지 않는다(사용자 선택).
- **FR-03 클릭 토글**: 프리뷰 클릭 = 재생/일시정지. 재생이 끝난 상태에서 클릭하면 구간 처음부터 다시 재생. 항상 음소거(오디오 믹스는 프로젝트 오디오가 소유).
- **FR-04 기존 프리뷰 계약 유지**: 정지 프레임 `<img data-testid="*-trim-preview">`(샘플 프레임)는 유지되어 재생 중이 아닐 때 표시된다. 기존 e2e의 src 갱신·가시성 어서션과 윈도우 슬라이더 시맨틱(role/aria/키보드/드래그)을 깨지 않는다.

### B. 엔드카드 — 가변 구간 + 자동 루프
- **FR-05 구간 길이 조절**: 엔드카드 스트립 윈도우 우측에 아웃 핸들을 추가, 드래그(및 키보드 화살표)로 구간 길이를 0.5s–3.0s 범위에서 조절한다. 구간은 소스 길이를 넘을 수 없다. 윈도우 이동 시 선택한 길이가 보존된다.
- **FR-06 자동 루프**: 구간 < 3.0s면 3초 슬롯을 채울 때까지 자동 루프(렌더는 기존 `SceneVideo loop` — Endcard-Video D-01 — 그대로, 컴포지션 무변경). 인스펙터에 루프 안내문과 "구간 ×N회" 채움 시각화를 표시한다(`day1-endcard-loop-note` testid 유지, 조건을 소스 기준 → 구간 기준으로 일반화).
- **FR-07 엔드카드 프리뷰 재생**: 커밋 시 3초 슬롯 기준으로 1회 재생 — 구간이 짧으면 루프를 포함해 총 3초 재생 후 정지.
- **FR-08 하위 호환**: 기존 프로젝트(videoTrim.outMs = inMs + min(3s, 소스))는 그대로 유효. 스키마 변경·마이그레이션 없음(스키마는 이미 {inMs, outMs} 저장, outMs ≤ source 검증만 존재).

## 2. Success Criteria

- **SC1** `setDay1EndCardTrimLengthMs` 단위 테스트: [500, 3000] 클램프, 소스보다 긴 구간 불가, 이동 시 길이 보존, 새 영상 업로드 시 min(3s, 소스)로 리셋.
- **SC2** 2.0s 구간이 렌더 props(videoTrimBefore/AfterFrames)에 프레임 정확도로 반영되는 단위 테스트.
- **SC3** 기존 유닛 스위트 + day1 관련 e2e(day1-trim-ux, day1-endcard-video L2) 그린 유지.
- **SC4** 신규 e2e(L2): 아웃 핸들 키보드 조작으로 2.0s 설정 → trim-out readout 갱신 + 루프 노트 표시.
- **SC5** `tsc -b` 통과.
- **SC6** 브라우저 수동 검증: 커밋 재생 1회·클릭 토글·엔드카드 루프 프리뷰 스크린샷 확인.

## 3. Scope

**변경**: `TrimStrip.tsx`(+CSS), `Day1Inspector.tsx`, `domain/editor/project.ts`(엔드카드 트림 커맨드 2), `domain/day1/playback.ts`(MIN 상수), `projectStore.ts`, `EditorWorkspace.tsx`(프롭 연결), 관련 unit/e2e 테스트.

**Non-goals**: 패널 A/B 구간 길이 조절(6초는 타임라인 소유), 2단 줌 스트립, 3-scene 인스펙터의 아웃 핸들(재생 프리뷰는 TrimStrip 공유로 자연 획득), 프리뷰 오디오.

## 4. Risks

| 리스크 | 대응 |
|---|---|
| 기존 e2e 계약 파손 | img 프리뷰·슬라이더 시맨틱 유지, 윈도우 폭 어서션은 12s 픽스처(50% 폭)라 min-width 미발동 |
| `<video>` seek/stop 정밀도 | rAF 가드로 out 지점 정지, ±1프레임 허용. 정지 프레임은 img가 소유 |
| remotion 루프-트림 프리뷰 | 기존 D-01 경로 재사용(소스<3s 루프와 동일 메커니즘), 수동 검증 SC6로 확인 |
| 대용량 소스 재생 부하 | 로컬 blob 디코드, preload="metadata", 재생 중에만 video 활성 |

## 5. Design Notes (경량 설계 — Design 단계 대체, 사용자 요청으로 압축 진행)

- **TrimStrip 구조 개편**: `.trim__track`(overflow visible) > `.trim__cells`(신설, overflow hidden — 썸네일 클립) + `.trim__windowbox`(신설 래퍼, left/width 계산 담당) > `-trim-window` 버튼(이동 슬라이더, 그립 스팬 2개 + 길이 라벨) + (엔드카드만) `-trim-length` 아웃 핸들 버튼(길이 슬라이더).
- **min-width CSS 계산**: `width: max(w%, 34px)`, `left: min(start%, calc(100% - max(w%, 34px)))`. 드래그 중심 보정은 시각 폭 px 기준.
- **재생 컨트롤러**: TrimStrip 내부 훅 — `commit → seek(inMs) → play → rAF로 out/슬롯 감시 → pause+seek(in)`. props: `playbackSlotMs?`(엔드카드 3000, 기본 = 구간).
- **도메인**: `endCardTrimLengthMs(settings)` 도우미(outMs−inMs, 0이면 3000) + `setDay1EndCardTrimInMs`가 현재 길이 보존 + 신설 `setDay1EndCardTrimLengthMs`. `MIN_END_CARD_TRIM_MS = 500`.
- **렌더 경로 무변경**: `EndCardScene`/`SceneVideo`/`buildDay1RenderProps`는 outMs 기반으로 이미 정확.
