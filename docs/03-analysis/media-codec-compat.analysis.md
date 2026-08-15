# Media Codec Compatibility — Check Analysis

> **Project**: mkt_videodesigner
> **Feature**: media-codec-compat
> **Version**: 1.0
> **Author**: 김성권 / Claude
> **Date**: 2026-08-15
> **Baseline**: [Plan v0.2.0](../01-plan/features/media-codec-compat.plan.md) — Design 문서 없음 (사용자 결정으로 생략)
> **Match Rate**: **100%** (Check 98% → Act 이후 100%)

> **검증 원칙**: 이 문서의 근거는 전부 이 Check 세션에서 **재실행·재현**한 것이다. Do 단계의 주장이나 커밋 메시지를 인용하지 않는다. Day1 사이클 회고 §6.1에서 이 방식이 유일한 Important 결함을 열어준 것으로 기록됐다.

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 업로드 거부 메시지가 거짓이면 사용자는 해결할 수 없는 문제를 쫓는다. 업로드 기준과 렌더 기준이 갈라지면 편집을 끝낸 뒤 렌더에서 실패한다 |
| **WHO** | UA 마케터 — 아이폰 촬영본, 화면녹화, 출처 불명 mp4 |
| **RISK** | 브라우저 코덱 지원은 버전마다 움직인다. 정적 화이트리스트를 쓰면 Chrome이 앞서갈 때마다 뒤처진다 |
| **SUCCESS** | 거부 메시지가 코덱명을 담는다 · 업로드 통과 = 렌더 통과가 E2E로 잠긴다 · 기존 H.264 경로 무회귀 |
| **SCOPE** | 영상·오디오 업로드 검증 경로의 에러 안내와 테스트 커버리지. 트랜스코딩 범위 밖 |

---

## 1. Strategic Alignment

Design 문서가 없으므로 Plan이 최상위 근거다.

| 질문 | 판정 | 근거 |
|------|:----:|------|
| Plan이 정의한 핵심 문제(거짓 에러 메시지)를 실제로 해결했는가 | ✅ | mp4v·ALAC 두 경로 모두 실측 문구에 코덱명이 들어간다 (§2 SC2·SC5) |
| 판정을 런타임에 위임한다는 원칙(§2.1)을 지켰는가 | ✅ | 코덱 게이트가 코드에 없다. `CODEC_LABELS`는 **라벨 조회일 뿐 게이트가 아니며**, 미등록 태그는 `코덱 'xxxx'`로 축퇴한다 — 거부 여부를 바꾸지 않는다 |
| 폐기한 접근(WebCodecs 이관·Mediabunny 대체)을 실제로 도입하지 않았는가 | ✅ | `src` 전체에 `isConfigSupported`·`mediabunny` 참조 0건 |
| 범위 밖(트랜스코딩)을 침범하지 않았는가 | ✅ | ffmpeg.wasm·서버 호출 없음. 번들 변화 없음 |

**전략적 불일치 없음.**

---

## 2. Success Criteria 평가

> 전부 이 세션에서 재실행했다.

| # | 기준 | 판정 | 근거 (재현) |
|---|------|:----:|------|
| SC1 | HEVC mp4 업로드 → 렌더 → `ffprobe` 통과 | ✅ Met | `npx playwright test` — [media-codec-compat.spec.ts:32](../../tests/e2e/media-codec-compat.spec.ts) 통과. 출력 MP4가 `h264 / 1080×1080` |
| SC2 | mp4v가 코덱명 포함 에러로 거부되고 "영상 트랙이 있는 파일" 문구가 안 나온다 | ✅ Met | 동 spec `:91` 통과. `MPEG-4 Part 2` + `mp4v` 확인, 부정 단언 포함 |
| SC3 | 기존 유닛 287 · E2E 30 무회귀 | ✅ Met | 유닛 **296 / 29 files**, E2E **32 passed + 1 skipped**. 기존 케이스 실패 0 |
| SC4 | AV1 mp4와 VP8 WebM이 업로드를 통과한다 | ✅ Met | 동 spec `:81` 2케이스 통과 |
| SC5 | 디코딩 불가 오디오가 코덱명 포함 에러로 거부된다 | ✅ Met | 동 spec `:108` 통과. 라이브 앱 실측 문구: `Chrome이 이 음성의 ALAC (Apple Lossless) (alac)를 디코딩하지 못합니다.` |

**Success Rate: 5/5 (100%)**

### 2.1 검증 커맨드 재실행 결과

```
npx tsc -b --force    exit 0
npm test              29 files / 296 tests   passed
npm run build         built in 178ms         passed
npx playwright test   32 passed, 1 skipped    (1.6m)
```

---

## 3. Requirements 대조

| ID | 요구사항 | 판정 | 구현 지점 |
|----|----------|:----:|-----------|
| FR-M01 | HEVC 업로드·편집·렌더 | ✅ | 브라우저 지원. E2E가 회귀 감시 |
| FR-M02 | VP9·AV1·VP8 업로드 | ✅ | AV1·VP8 픽스처 + E2E. VP9는 `a2c1ff7` 시점 확인 |
| FR-M03 | 영상 디코딩 불가 시 코덱명 | ✅ | [codecTag.ts](../../src/infrastructure/media/codecTag.ts) + [probeMedia.ts:267,300](../../src/infrastructure/media/probeMedia.ts) |
| FR-M04 | 업로드 통과 = 렌더 통과 | ✅ | Check 시점 ⚠️ Partial(HEVC만 테스트) → **Act에서 AV1·VP8 렌더 E2E 추가로 해소** (§7) |
| FR-M05 | H.264 무회귀 | ✅ | 296 유닛 / 32 E2E |
| FR-M06 | 오디오 코덱명 | ✅ | [probeMedia.ts:209](../../src/infrastructure/media/probeMedia.ts), `readCodecTag(file, 'audio')` |

---

## 4. Gap 목록

Critical 0 · Important 0 · **Minor 3**

### Gap-1 (Minor) — Plan 문서가 사라진 파일을 가리킨다

Plan §1.3과 §6 R2가 `videoCodecTag.ts`를 링크하는데, 이 파일은 `83f7dd3`에서 `codecTag.ts`로 개명됐다. **이번 사이클이 스스로 만든 문서-코드 드리프트**다.

- 근거: `grep -rn "videoCodecTag" docs/01-plan/` → 2건 (line 68, 148)
- 영향: 링크가 깨진다. 기능 영향 없음

### Gap-2 (Minor) — FR-M04가 HEVC에서만 잠겨 있다

FR-M04는 "업로드를 통과한 파일은 렌더도 통과한다"인데, 렌더까지 검증하는 E2E는 HEVC 1건이다. AV1·VP8은 업로드만 단언한다.

- **이 Check에서 직접 재현**: 라이브 앱에서 AV1 mp4 → `완료 · 2.5 MB`, VP8 WebM → `완료 · 2.6 MB`. **주장 자체는 참이다.**
- 영향: 참이지만 **무방비**다. 렌더 경로가 특정 코덱에서 깨져도 잡히지 않는다. SC4는 업로드만 요구하므로 SC 위반은 아니고, FR-M04에 대한 커버리지 부족이다

### Gap-3 (Minor) — Plan에 없는 설계 결정이 Do에서 생겼다

`readCodecTag`가 `hdlr` 핸들러 타입으로 트랙을 고르도록 바꾼 것은 Plan §6 R2("오디오까지 일반화 + 라벨 추가") 범위를 넘어선다. 기존 코드가 첫 `trak`을 무조건 집던 잠재 버그를 함께 고친 것이다.

- 판단 근거는 코드 주석과 유닛 테스트(`picks the track matching the requested kind`)에 남아 있으나 **Plan에 승인 기록이 없다**
- Day1 회고 §6.3이 "Do 중 미기재 결정이 생기면 그 자리에서 문서에 한 줄 추가"를 Try로 남겼는데, 이번에도 같은 패턴이 반복됐다

---

## 5. Match Rate

| 축 | 점수 | 근거 |
|----|:----:|------|
| Structural | 100 | 계획한 산출물 전부 존재 — `codecTag.ts`, 픽스처 3종, E2E 5케이스. 죽은 참조 0 (`videoCodecTag` 심볼 잔존 0건) |
| Functional | 100 | FR-M01~M06 구현 완료. placeholder·TODO 스캔 0건 |
| Contract | 100 | `ProbeMediaDependencies.readCodecTag` 시그니처가 두 호출자와 일치. 에러 shape(`details.codecTag`, `action.target`)이 영상·오디오 경로에서 대칭 |
| Runtime | 95 | 296 유닛 + 32 E2E 통과. **−5는 Gap-2** — AV1·VP8 렌더가 수동 재현으로만 확인됨 |

```
Overall = (100 × 0.15) + (100 × 0.25) + (100 × 0.25) + (95 × 0.35)
        = 15 + 25 + 25 + 33.25
        = 98.25 → 98%
```

**게이트 90% 통과.**

---

## 6. 결정 이행 확인

| 출처 | 결정 | 이행 | 결과 |
|------|------|:----:|------|
| [Plan v0.2.0] | Design 단계 생략 | ✅ | 설계 선택지가 없는 확장 작업이었다. 사후 Design은 코드 전사에 그쳤을 것 |
| [Plan v0.2.0] | WebCodecs 이관 폐기 | ✅ | 참조 0건 |
| [Plan v0.2.0] | Mediabunny 대체 폐기 | ✅ | 참조 0건 |
| [Plan v0.2.0 §4] | 오디오 거부 픽스처는 측정해서 고른다 | ✅ | 첫 후보 ALAC이 그대로 거부됨. ac3·eac3 대체 불필요 |
| [Plan v0.2.0 §6] | 영상 경로를 리팩터하지 않는다 | ⚠️ | `readVideoCodecTag` → `readCodecTag` 개명과 `hdlr` 매칭 도입으로 영상 경로도 바뀌었다. 다만 **동작 회귀는 없고**(mp4v E2E 통과) 오디오 지원의 직접적 전제였다. Gap-3에서 다룬다 |

---

## 7. Act — Gap 3건 해소

사용자 결정: "지금 모두 수정" (2026-08-15).

| Gap | 조치 | 검증 |
|-----|------|------|
| **Gap-1** | Plan §1.3 링크를 `codecTag.ts`로 교정. §6 R2 산출물 표기도 갱신 | `grep`상 깨진 링크 0건. 남은 `videoCodecTag` 언급 3건은 전부 개명 이력을 설명하는 서술이다 |
| **Gap-2** | HEVC 렌더 테스트와 AV1·VP8 업로드 테스트를 **하나의 렌더 루프로 통합**. 세 코덱 모두 업로드 → 1:1 렌더 → 다운로드 → `ffprobe`까지 간다 | 3케이스 전부 통과. 입력이 무엇이든 출력이 `h264 / 1080×1080`임을 단언. Check에서 수동 재현했던 사실이 이제 테스트로 잠겼다 |
| **Gap-3** | Plan에 **§6.1 "Do 단계에서 추가된 결정"** 신설, D1(hdlr 트랙 선택)·D2(개명)·D3(라벨은 게이트가 아님)을 근거와 함께 사후 승인 기록 | 문서 diff. SC4도 렌더까지 요구하도록 강화 |

### 7.1 Act 이후 재검증

```
npx tsc -b                                     exit 0
npm test                                       29 files / 296 tests   passed
npx playwright test media-codec-compat.spec.ts 5 passed  (21.7s)
npx playwright test                            32 passed, 1 skipped   (1.6m)
```

E2E 총 케이스 수는 33으로 동일하다 — 업로드 전용 2건이 렌더 3건 루프로 **흡수**되면서 케이스는 줄고 커버리지는 늘었다.

### 7.2 Act 이후 Match Rate

| 축 | Check | Act 후 | 변화 |
|----|:-----:|:------:|------|
| Structural | 100 | 100 | — |
| Functional | 100 | 100 | — |
| Contract | 100 | 100 | — |
| Runtime | 95 | **100** | Gap-2 해소 — AV1·VP8 렌더가 테스트로 고정됨 |

```
Overall = (100 × 0.15) + (100 × 0.25) + (100 × 0.25) + (100 × 0.35) = 100%
```

**FR-M04도 ⚠️ Partial → ✅ Met으로 바뀐다.** Requirements 최종: **6/6**.

---

## 8. 남은 한계 (알려진 상태)

- **VP9는 이번 사이클에서 재측정하지 않았다.** `a2c1ff7` 시점 관찰에 의존한다. 픽스처도 없다 — AV1·VP8과 달리 FR-M02에서 유일하게 테스트가 없는 코덱이다
- **fourcc 리더는 `hdlr`이 있는 파일만 다룬다.** ISO-BMFF 명세상 필수 박스이고 ffmpeg 산출물로 확인했지만, 손상 파일에서는 `알 수 없는 코덱`으로 축퇴한다 (거짓말보다 낫다는 판단)
- **오디오 "길이 불가" 분기는 코덱명을 붙이지 않는다.** 영상 경로도 동일하므로 비대칭은 아니다 (사용자 결정: 영상과 동일 수준)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-08-15 | Check 최초 분석. Match Rate 98%, SC 5/5, Gap 3건(전부 Minor). 검증 커맨드 4종 + AV1·VP8 렌더 수동 재현. | 김성권 / Claude |
| 1.1 | 2026-08-15 | Act 반영. Gap 3/3 해소 → Match Rate 100%, FR 6/6. §7 신설. | 김성권 / Claude |
