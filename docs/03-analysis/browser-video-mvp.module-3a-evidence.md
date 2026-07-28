# Browser Video MVP Module 3A Editor Vertical Slice

> **Feature**: browser-video-mvp
> **Scope**: module-3a-editor-vertical-slice
> **Date**: 2026-07-28
> **Status**: Implemented and verified in real Chrome

## Context Anchor

| Key | Value |
|-----|-------|
| WHY | 실제 촬영본을 브라우저에서 바로 편집하고 MP4로 출력하는 경로를 먼저 사용자에게 노출한다. |
| WHO | 사내 UA Manager와 마케터, 최신 데스크톱 Chrome 사용자 |
| RISK | 브라우저 미디어 수명주기, object URL 정리, 미리보기와 렌더의 프레이밍 불일치 |
| SUCCESS | 업로드 → 고정 3장면 타임라인 조정 → trim/transform → 9:16 미리보기 → 1080×1920 H.264/AAC MP4 다운로드 |
| SCOPE | 저장소·다국어·Hook 분석·TTS·Batch 이전의 좁은 편집기 vertical slice |

## Scope Note

이 범위는 Design의 module-3(Media and Persistence)과 module-4(Editor and Composition)
전체보다 앞서 삽입된 부분 범위다. IndexedDB, autosave, JSON import/export, 파일 relink,
1:1·16:9, 4언어 카피, Hook 모션·분석, CTA 에셋, TTS·오디오 믹스, Batch는 구현하지 않았고
placeholder도 만들지 않았다.

## Implementation Scope

- 로컬 영상 1개 업로드와 `probeVideoFile` 기반 name / MIME / duration / 해상도 / 디코딩 확인
- 업로드 즉시 Hook · Gameplay · CTA 세 장면에 동일 소스 적용, `세 장면에 다시 적용`으로 재적용
- 15 / 30 / 60초 프리셋과 승인된 기본 장면 길이 `2/10/3`, `3/24/3`, `3/54/3`
- 고정 3장면 타임라인, 경계 2개 드래그 및 키보드 조절, 전체 길이 불변, 장면 최소 1초
- 장면별 Trim In / Out. 소스 구간은 장면 길이와 동일한 창으로 유지되고 원본 길이로 clamp
- 장면별 Cover 고정 + Scale / X / Y / 초기화
- 9:16 Remotion Player 미리보기, 재생·일시정지·seek·현재 시간·선택 장면 표시
- 1080×1920 H.264/AAC MP4 렌더, 기본 60fps, 진행률·취소·오류·다운로드
- module-2 capability probe와 OPFS(`web-fs`) / ArrayBuffer fallback 유지
- 렌더 시작 시 `buildCompositionProps`의 deep-frozen snapshot 고정
- 영상 교체·언마운트 시 object URL 해제와 활성 렌더 abort

## Architecture Placement

| Layer | File | Responsibility |
|-------|------|----------------|
| Domain | `src/domain/editor/types.ts` | 장면·소스·transform·렌더 props 타입과 불변 상수 |
| Domain | `src/domain/editor/project.ts` | 순수 command 함수와 frozen composition snapshot |
| Domain | `src/domain/timeline/timeline.ts` | 프리셋, 경계 이동, 프레임 배분, trim 보정 |
| Infrastructure | `src/infrastructure/media/probeMedia.ts` | File → `SourceMedia` 검증, 실패 시 typed error |
| Infrastructure | `src/infrastructure/render/renderEditor.ts` | 편집 snapshot → Web Renderer 요청, 파일명 규칙 |
| Compositions | `src/compositions/ThreeSceneComposition.tsx` | `@remotion/media` `Video` + `Sequence` 3장면 |
| Features | `src/features/editor/*` | Option A 레이아웃, 타임라인, Inspector |
| App | `src/app/App.tsx` | 기본 편집기, `#render-poc` 해시로 module-2 화면 유지 |

`@remotion/media`의 `Video`에 `trimBefore` / `trimAfter` / `objectFit="cover"`를 사용했고,
canvas 프레임 복사는 사용하지 않았다.

## Design Decisions Made During Implementation

| 항목 | 결정 | 이유 |
|------|------|------|
| Trim 창 길이 | 소스 구간 길이를 장면 길이와 동일하게 유지하고 In 또는 Out으로 위치만 이동 | 고정 타임라인에서 구간과 장면 길이가 어긋나면 빈 구간이 생긴다. reversed·empty interval도 구조적으로 불가능해진다 |
| 원본이 장면보다 짧을 때 | 차단 대신 창을 원본 길이로 축소하고 Inspector에 경고 표시 | handoff의 "block or clamp"에서 clamp를 선택. 작업은 계속 가능하고 문제는 명시된다 |
| 프레임 배분 | 마지막 장면이 반올림 잔여 프레임을 흡수 | 장면 프레임 합계가 항상 `preset × fps`와 정확히 일치해야 한다 |
| module-2 화면 | 삭제하지 않고 `#render-poc` 해시로 이동 | 벤치마크 러너와 기존 E2E를 유지하면서 편집기를 기본 화면으로 노출 |
| 일괄 적용 버튼 | 업로드가 이미 세 장면에 적용되므로 버튼은 "trim 초기화 후 재적용" | 의미 없는 중간 상태를 만들지 않기 위함 |

## Verification Environment

| Item | Value |
|------|-------|
| Device | MacBook Air, Apple M5, 16 GB |
| OS | macOS 26.5.1 |
| Browser | Chrome (Playwright `channel: 'chrome'`, headless) |
| Node / npm | Node 25.8.2 / npm 11.11.1 |
| Remotion | `remotion`, `@remotion/media`, `@remotion/player`, `@remotion/web-renderer` 모두 `4.0.499` |
| Dev server | 기존 `127.0.0.1:4173` 재사용 (`reuseExistingServer`) |

## Test Results

| Check | Command | Result |
|-------|---------|--------|
| Unit | `npm test` | 6 files, 49 tests passed |
| Type + build | `npm run build` | Passed |
| E2E | `npx playwright test` | 3 tests passed (module-3a 2개, module-2 1개) |
| module-2 benchmark runner | `POC_MATRIX=smoke npm run benchmark:render` | Passed, ffprobe H.264/AAC 확인 |

module-2 이전 단위 테스트 6개는 그대로 유지되며, 추가된 43개는 timeline 불변식,
project command, media probe, 렌더 요청·파일명에 대한 테스트다.

## Rendered Output Evidence

`tests/fixtures/gameplay-sample.mp4`는 초마다 색이 다른 12초 1920×1080 H.264/AAC 소재다.
따라서 출력 프레임의 색이 곧 사용된 원본 초를 의미한다.

E2E 최종 편집 상태: 15초 프리셋 `2/10/3`, Hook trim in 6s, Gameplay trim in 2s, CTA trim in 9s.

| 출력 시각 | 기대 원본 초 | 측정 결과 |
|-----------|--------------|-----------|
| 0.5s (Hook) | 6 | 6 |
| 1.5s (Hook) | 7 | 7 |
| 2.5s (Gameplay) | 2 | 2 |
| 11.5s (Gameplay) | 11 | 11 |
| 12.5s (CTA) | 9 | 9 |
| 14.5s (CTA) | 11 | 11 |

장면별 trim offset과 장면 경계가 렌더 결과물에서 그대로 재현된다.

ffprobe 결과 (`artifacts/module-3a/editor-vertical-slice.mp4`):

- video: `h264`, 1080×1920, `r_frame_rate 60/1`, 900 frames
- audio: `aac`
- container duration: 15.08s

## Render Timing

동일 소재·동일 편집 상태에서 UI 클릭부터 `완료` 표시까지의 wall clock이다.
Blob 읽기와 UI 갱신을 포함하므로 module-2의 순수 render 시간과 직접 비교하지 않는다.

| Preset | Wall clock | Output | Frames |
|--------|-----------:|-------:|-------:|
| 15초 1080×1920 60fps | 10.9s | 379,048 B | 900 |
| 30초 1080×1920 60fps | 15.4s | 625,504 B | 1,800 |
| 60초 1080×1920 60fps | 21.5s | 1,045,217 B | 3,600 |

30초와 60초 케이스는 Gameplay 장면이 12초 소재보다 길어 남는 구간이 검은 화면으로
출력되는 상태다. 그럼에도 프레임 수와 컨테이너 길이는 정확히 유지된다.

## UI Verification

데스크톱 뷰포트 스크린샷을 확인했다.

- `artifacts/module-3a/editor-empty-1440x900.png` — 업로드 전 상태, 렌더 버튼 비활성
- `artifacts/module-3a/editor-loaded-1440x900.png` — 소재 적용 후 편집 상태
- `artifacts/module-3a/editor-loaded-1280x720.png` — 최소 지원 뷰포트, 가로 overflow 없음

레이아웃은 상단 헤더, 좌측 소재, 중앙 미리보기, 우측 장면 속성, 하단 타임라인이며
중첩 카드·hero·장식용 gradient는 사용하지 않았다. 타임라인 클립 폭은 시간 비율과
정확히 일치하도록 `flex: 0 0 %`로 배치해 경계 핸들 위치와 어긋나지 않는다.

## Acceptance Criteria

- [x] 애플리케이션 서버 요청 없이 로컬 영상 업로드
- [x] 같은 소재가 세 장면에 적용
- [x] 15 / 30 / 60초 기본 장면 길이 일치
- [x] 경계 드래그 시 전체 길이 유지와 1초 최소 보장
- [x] 장면별 Trim In / Out이 원본 길이로 제한
- [x] Scale / X / Y가 9:16 Player에 반영
- [x] 타임라인에서 seek와 장면 선택
- [x] 실제 편집 MP4의 렌더 · 취소 · 다운로드
- [x] capability 오류가 조치 가능한 문구로 노출
- [x] object URL과 활성 렌더 리소스 해제
- [x] 기존 단위 테스트 유지
- [x] 신규 도메인·UI 동작에 대한 테스트 추가
- [x] production build 성공
- [x] evidence와 PDCA 상태 갱신

## Limitations and Residual Risks

1. 세션 한정이다. 새로고침하면 소재와 편집 상태가 사라진다. 저장·복구는 module-3 범위다.
2. 동일 소재를 세 장면이 각각 디코딩한다. 캐시 최적화는 이후 모듈로 미뤘다.
3. 소재가 장면보다 짧으면 경고만 표시하고 남는 구간은 검은 화면으로 출력된다.
4. 소재에 오디오 트랙이 없으면 출력에 AAC 트랙이 없을 수 있다. 오디오 믹스는 module-6 범위다.
5. Remotion 상업 라이선스 승인은 여전히 배포 전 gate로 남아 있다. 배포는 수행하지 않았다.
6. 번들 경고(1.2 MB index chunk, mediabunny encoder chunk)는 module-2에서 이어진 상태다.
7. `SecondsField`는 입력 중 커밋 방식이라 두 숫자 입력 사이를 1ms 단위로 전환하면
   blur 리렌더와 값 설정이 경합할 수 있다. E2E는 `fillField` 헬퍼로 포커스를 정리한다.

## Reproduction

```bash
npm install
npm run generate:editor-fixture
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 4173
npx playwright test
POC_MATRIX=smoke npm run benchmark:render
```

MP4와 스크린샷은 로컬 생성 artifact이며 기본적으로 Git 추적에서 제외한다.
