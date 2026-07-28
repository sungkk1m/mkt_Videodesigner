# Media Codec Compatibility Planning Document

> **Summary**: 렌더러는 디코딩할 수 있는데 업로드 단계에서 거부되는 mp4를 받아들이도록 검증 경로를 교정한다
>
> **Project**: mkt_videodesigner
> **Version**: 0.1.0
> **Author**: 김성권 / Claude
> **Date**: 2026-07-28
> **Status**: Draft — Day1 사이클과 분리해 진행
> **분리 사유**: 모든 템플릿에 공통 영향을 주는 변경이라 Day1 구현과 섞으면 회귀 범위가 커진다 (사용자 결정)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 업로드 검증이 `<video>` 엘리먼트의 `loadedmetadata`로만 판정한다. 그런데 Chrome의 `<video>`와 WebCodecs는 지원 코덱이 다르다. **HEVC mp4는 렌더러가 디코딩할 수 있는데 업로드에서 거부된다** — 아이폰 촬영본과 화면녹화 mp4가 여기 걸린다. 사용자에게는 "정상적인 mp4인데 안 올라간다"로 보인다. |
| **Solution** | 검증 기준을 실제 렌더 경로와 같은 WebCodecs로 옮긴다. `VideoDecoder.isConfigSupported()`로 판정하고, `<video>`는 메타데이터 추출 용도로만 남기거나 Mediabunny로 대체한다. 디코딩 불가 코덱(mp4v 등)은 코덱명을 명시한 에러로 안내한다. |
| **Function/UX Effect** | 아이폰·화면녹화 mp4를 변환 없이 바로 올린다. 거부되는 경우에도 "H.264로 변환하세요"라는 뭉뚱그린 문구 대신 실제 코덱명과 사유가 나온다. |
| **Core Value** | 소재 준비 단계의 마찰을 없앤다. 업로드 가능 여부가 렌더 가능 여부와 일치하게 되어, 편집을 다 끝낸 뒤 렌더에서 실패하는 상황도 함께 사라진다. |

---

## 1. Background — 실측 근거

2026-07-28 Chrome에서 직접 측정했다.

| 코덱 | `VideoDecoder.isConfigSupported` | `<video>.canPlayType` | 현재 결과 |
|------|:-------------------------------:|:---------------------:|-----------|
| H.264 (avc1) | ✅ | `probably` | 정상 |
| **HEVC (hvc1)** | **✅** | **`no`** | **오거부** ← 문제 |
| VP9 (vp09) | ✅ | — | 사실상 오거부 |
| AV1 (av01) | ✅ | — | 사실상 오거부 |
| VP8 | ✅ | — | 사실상 오거부 |
| MPEG-4 Part 2 (mp4v) | ❌ | `no` | 정거부 (변환 필요) |

거부 지점은 [probeMedia.ts:31](../../../src/infrastructure/media/probeMedia.ts:31) `loadMetadataFromVideoElement`이고, 실패 시 [probeMedia.ts:283](../../../src/infrastructure/media/probeMedia.ts:283)에서 "H.264 MP4로 변환한 뒤 다시 업로드하세요"를 띄운다. 이 문구는 HEVC의 경우 **사실과 다르다** — 변환 없이도 렌더된다.

---

## 2. Scope

### 2.1 In Scope

- 업로드 검증을 WebCodecs 기준으로 교정 (영상). HEVC·VP9·AV1·VP8 mp4 수용
- 컨테이너에서 코덱 문자열을 읽어 판정 — Mediabunny(`@remotion/media` 의존성에 이미 포함)의 파서를 우선 검토
- 디코딩 불가 시 **실제 코덱명을 담은** 에러 메시지
- 업로드 가능 = 렌더 가능이 되도록 두 경로의 판정 기준 일치
- 오디오 업로드도 동일하게 점검

### 2.2 Out of Scope

| 항목 | 사유 |
|------|------|
| ffmpeg.wasm 브라우저 내 트랜스코딩 (mp4v 대응) | 번들이 수십 MB 늘어 정적 경량 앱 기조와 충돌. 실제 mp4v 소재가 나올 때 재검토 (사용자 결정) |
| 서버 사이드 변환 | 무서버 원칙 |

---

## 3. Requirements

| ID | 요구사항 | 우선순위 |
|----|----------|:--------:|
| FR-M01 | HEVC mp4를 업로드·편집·렌더할 수 있다 | Must |
| FR-M02 | VP9·AV1·VP8 영상을 업로드할 수 있다 | Should |
| FR-M03 | 디코딩 불가 파일은 실제 코덱명과 사유를 담은 에러를 낸다 | Must |
| FR-M04 | 업로드를 통과한 파일은 렌더도 통과한다 (판정 기준 일치) | Must |
| FR-M05 | 기존 H.264 경로는 회귀 없이 동작한다 | Must |

---

## 4. Success Criteria

| # | 기준 | 검증 |
|---|------|------|
| SC1 | HEVC mp4 픽스처로 업로드 → 렌더 → `ffprobe` 확인이 통과한다 | E2E |
| SC2 | mp4v 픽스처가 코덱명이 포함된 에러로 거부된다 | E2E |
| SC3 | 기존 유닛 164개·E2E 17개 통과 | 회귀 |

픽스처는 `ffmpeg`로 생성한다 (`-c:v libx265` / `-c:v mpeg4`).

---

## 5. Risks

| 위험 | 대응 |
|------|------|
| HEVC 지원이 하드웨어·OS별로 갈림 | `isConfigSupported`가 런타임 판정이라 안 되는 환경에서는 자동으로 거부된다. 정적 화이트리스트를 쓰지 않는 이유 |
| 메타데이터(길이·해상도) 추출 경로도 함께 바꿔야 함 | `<video>`로 못 여는 파일은 길이도 못 읽는다. Mediabunny 파서로 대체하는 것이 이 작업의 실제 핵심 |
| 기존 fingerprint·relink 로직 영향 | 파일 바이트 기반이라 코덱과 무관. 영향 없음 |

---

## 6. Next Steps

1. `/pdca design media-codec-compat` — Mediabunny 파서로 메타데이터를 뽑을 수 있는지 스파이크 후 설계
2. Day1 사이클과 독립적으로 진행 가능. 순서는 자유

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1.0 | 2026-07-28 | 최초 Plan. Chrome 코덱 지원 실측 결과 기반. Day1 사이클에서 분리. | 김성권 / Claude |
