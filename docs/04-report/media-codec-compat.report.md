# Media Codec Compatibility — Completion Report

> **Status**: **Complete**
>
> **Project**: mkt_videodesigner
> **Version**: 0.2.1
> **Author**: 김성권 / Claude
> **Completion Date**: 2026-08-15
> **PDCA Cycle**: #3 (browser-video-mvp → day1-template 이후)
> **Match Rate**: **100%** (Check 98% → Act 이후 100%)

---

## 1. Executive Summary

### 1.1 Project Overview

| Item | Content |
|------|---------|
| Feature | media-codec-compat — 업로드 거부 메시지의 정직성과 업로드·렌더 판정 일치 |
| Start Date | 2026-07-28 (Plan v0.1.0) |
| End Date | 2026-08-15 (Plan 개정 → Do → Check → Act → Report) |
| Duration | 실작업 2일 (2026-08-01 구현, 08-15 개정·완주). Day1 사이클과 병행하느라 사이에 공백 |
| PRD | 없음 (`/pdca pm` 미실행) |
| Design | **없음 — 사용자 결정으로 생략**. 구현 선행 후 Plan을 실측에 맞춰 개정하는 역순 진행 |

### 1.2 Results Summary

```
┌─────────────────────────────────────────────┐
│  Completion Rate: 100%                       │
├─────────────────────────────────────────────┤
│  ✅ Complete:      6 / 6 FR                  │
│  ✅ Success Crit:  5 / 5 SC                  │
│  ✅ Gap resolved:  3 / 3 (Critical 0)        │
│  ⏳ Next cycle:    2 items                   │
└─────────────────────────────────────────────┘
```

### 1.3 Value Delivered

| Perspective | Content |
|-------------|---------|
| **Problem** | Chrome이 디코딩 못 하는 영상을 올리면 **에러가 나지 않았다.** 컨테이너는 파싱되고 크기만 0x0으로 보고돼서, 검증 코드가 "영상 트랙이 있는 파일을 선택하세요"라는 거짓 안내를 띄웠다. 파일에는 영상 트랙이 있다. 사용자는 없는 문제를 찾아 헤맸다. |
| **Solution** | 실패 경로에서만 ISO-BMFF sample-entry fourcc를 직접 읽어 실제 코덱명을 담은 에러를 낸다 ([codecTag.ts](../../src/infrastructure/media/codecTag.ts), 266줄). 성공한 업로드는 비용 0. 영상·오디오 양쪽에 동일 정책. |
| **Function/UX Effect** | 거부 메시지가 `MPEG-4 Part 2 (DivX·Xvid) (mp4v)` / `ALAC (Apple Lossless) (alac)`처럼 파일의 정체를 알려준다. HEVC(mp4·mov·10bit)·VP9·AV1·VP8은 변환 없이 올라가고, **셋은 렌더까지 E2E로 잠겼다.** |
| **Core Value** | 소재 준비에서 **막히는 이유를 알 수 있게** 했다. 그리고 업로드 판정과 렌더 판정이 갈라지는 회귀를 자동 감시한다 — 편집을 끝낸 뒤 렌더에서 실패하는 상황이 실제 방어 대상이었다. |

### 1.4 Success Criteria Final Status

> 근거는 Check·Act 세션에서 **재현·재실행**한 것이다 (Do 문서 인용 아님).

| # | Criteria | Status | Evidence |
|---|----------|:------:|----------|
| SC1 | HEVC mp4 업로드 → 렌더 → `ffprobe` 통과 | ✅ Met | [media-codec-compat.spec.ts:45](../../tests/e2e/media-codec-compat.spec.ts) — 출력 `h264 / 1080×1080` |
| SC2 | mp4v가 코덱명 포함 에러로 거부, "영상 트랙이 있는 파일" 문구 없음 | ✅ Met | 동 spec `:88` — 긍정·부정 단언 양쪽 |
| SC3 | 기존 유닛 287 · E2E 30 무회귀 | ✅ Met | 유닛 **296** / E2E **32 + 1 skip**. 기존 케이스 실패 0 |
| SC4 | AV1 mp4와 VP8 WebM이 업로드를 통과하고 MP4까지 렌더된다 | ✅ Met | 동 spec `:45` 루프 — Act에서 렌더까지 강화 |
| SC5 | 디코딩 불가 오디오가 코덱명 포함 에러로 거부 | ✅ Met | 동 spec `:105` + 라이브 앱 실측 문구 |

**Success Rate: 5/5 (100%)**

> Check 최초 판정은 FR-M04가 ⚠️ Partial(HEVC만 렌더 검증)이었다. "지금 모두 수정" 결정에 따라 Act에서 AV1·VP8 렌더 케이스를 추가해 닫았다.

### 1.5 Decision Record Summary

PRD·Design이 없어 **[Plan] 계층이 최상위**다.

| Source | Decision | Followed? | Outcome |
|--------|----------|:---------:|---------|
| [Plan v0.1.0] | 검증을 WebCodecs `isConfigSupported()`로 이관 | ⛔ 폐기 | Chrome 148에서 `<video>`가 이미 렌더 경로와 같은 답을 냄. 이관해도 얻는 게 없었다 |
| [Plan v0.1.0] | 메타데이터 추출을 Mediabunny로 대체 ("이 작업의 실제 핵심") | ⛔ 폐기 | **불가능.** mediabunny는 자기가 지원하는 코덱만 모델링해서 mp4v 파싱 중 throw — 정확히 이름이 필요한 그 파일에서 실패 |
| [Plan v0.1.0] | HEVC 오거부가 문제다 | ⛔ 전제 무효 | 재측정 결과 HEVC는 mp4·mov·10bit 전부 통과. 진짜 결함은 **거짓 에러 메시지**였다 |
| [Plan v0.2.0] | Design 생략, 구현 선행 후 Plan 개정 | ✅ | 설계 선택지가 없는 확장 작업이었다. 사후 Design은 코드 전사에 그쳤을 것 |
| [Plan v0.2.0] | 판정은 런타임 위임, 화이트리스트 없음 | ✅ | 코덱 게이트 0건. HEVC 지원이 **우리 코드 변경 없이** 생긴 것이 이 원칙의 증거다 |
| [Plan v0.2.0 §4] | 오디오 거부 픽스처는 측정해서 고른다 | ✅ | 첫 후보 ALAC이 그대로 거부됨. ac3·eac3 대체 불필요 |
| [Plan v0.2.0 §6] | 영상 경로를 리팩터하지 않는다 | ⚠️ 부분 편차 | 개명(D2)과 `hdlr` 매칭(D1)으로 영상 경로도 바뀌었다. 동작 회귀는 0이고 오디오 지원의 직접적 전제였다 |
| [Plan v0.2.1 §6.1 D1] | `hdlr` 핸들러 타입으로 트랙 선택 | ✅ | 첫 `trak`을 무조건 집던 잠재 버그 해소. 유닛 테스트로 고정 |
| [Plan v0.2.1 §6.1 D2] | `videoCodecTag.ts` → `codecTag.ts` 개명 | ✅ | 오디오도 읽으므로 기존 이름이 거짓이 됐다 |
| [Plan v0.2.1 §6.1 D3] | 코덱 라벨은 게이트가 아니다 | ✅ | 미등록 태그는 `코덱 'xxxx'`로 축퇴할 뿐 거부 여부를 바꾸지 않는다 |

**이 사이클의 특징은 폐기된 결정이 3건이라는 점이다.** 전부 Plan v0.1.0의 것이고, 전부 재측정으로 뒤집혔다.

---

## 2. Related Documents

| Phase | Document | Status |
|-------|----------|--------|
| PM | — | ⚪ 미실행 |
| Plan | [media-codec-compat.plan.md](../01-plan/features/media-codec-compat.plan.md) | ✅ v0.2.1 |
| Design | — | ⚪ **생략 (사용자 결정)** |
| Check·Act | [media-codec-compat.analysis.md](../03-analysis/media-codec-compat.analysis.md) | ✅ v1.1 (§7 Act 포함) |
| Report | 현재 문서 | ✅ |

---

## 3. Completed Items

### 3.1 Functional Requirements

| ID | Requirement | Status | 구현 지점 |
|----|-------------|:------:|-----------|
| FR-M01 | HEVC 업로드·편집·렌더 | ✅ | 브라우저 지원. E2E가 회귀 감시 |
| FR-M02 | VP9·AV1·VP8 업로드 | ✅ | AV1·VP8 픽스처 + 렌더 E2E. VP9는 `a2c1ff7` 관찰 |
| FR-M03 | 영상 디코딩 불가 시 코덱명 | ✅ | `codecTag.ts` + [probeMedia.ts:267,300](../../src/infrastructure/media/probeMedia.ts) |
| FR-M04 | 업로드 통과 = 렌더 통과 | ✅ | 3코덱 전부 업로드→렌더→`ffprobe` (Act) |
| FR-M05 | H.264 무회귀 | ✅ | 296 유닛 / 32 E2E |
| FR-M06 | 오디오 코덱명 | ✅ | [probeMedia.ts:209](../../src/infrastructure/media/probeMedia.ts) |

**6/6 구현. placeholder 스캔 0건.**

### 3.2 Deliverables

| Deliverable | Location | 규모 |
|-------------|----------|------|
| fourcc 리더 | `src/infrastructure/media/codecTag.ts` | 266줄 |
| 리더 유닛 테스트 | `codecTag.test.ts` | 192줄 |
| 프로브 통합 | `probeMedia.ts` (영상 2경로 + 오디오 1경로) | 314줄 |
| 프로브 유닛 테스트 | `probeMedia.test.ts` | 210줄 |
| E2E | `tests/e2e/media-codec-compat.spec.ts` | 128줄 / 5케이스 |
| 픽스처 생성기 | `scripts/generate-editor-fixture.mjs` 확장 | AV1·VP8·ALAC 3종 추가 |

**코드 규모**: `a2c1ff7~1..HEAD` 기준 `src`·`tests`·`scripts` **6파일 +795 / −13줄**.

### 3.3 Quality Metrics

```
npx tsc -b            passed
npm test              29 files / 296 tests   passed
npm run build         passed (178ms)
npx playwright test   32 passed, 1 skipped   (1.6m)
```

| Metric | 목표 | 최종 | 변화 |
|--------|------|------|------|
| Match Rate | ≥ 90% | **100%** | 98% → 100% (Act) |
| Success Criteria | 5/5 | **5/5** | 4 Met + 1 Partial → 5 Met |
| Unit tests | 회귀 0 | **296** | 287 → 296 (+9) |
| E2E tests | 회귀 0 | **32 + 1 skip** | 30 → 33 (+3) |
| Critical / Important Gap | 0 | **0** | — |
| Minor Gap | 0 | **0** | 3 → 0 |

---

## 4. Incomplete Items

| 항목 | 사유 | 우선 |
|------|------|:----:|
| **VP9 픽스처·테스트** | FR-M02에서 유일하게 테스트가 없는 코덱. `a2c1ff7` 시점 관찰에만 의존한다 | 중간 |
| mp4v 트랜스코딩 (ffmpeg.wasm) | Plan §2.2 명시적 범위 밖. 번들이 수십 MB 늘어 정적 경량 앱 기조와 충돌 | 낮음 |

---

## 5. Lessons Learned

### 5.1 잘된 것 (Keep)

- **구현 중 재측정이 Plan 전제를 뒤집었고, 그걸 문서에 반영했다.** Plan v0.1.0의 근거 6줄 중 살아남은 건 mp4v 한 줄뿐이었다. 틀린 전제를 조용히 우회하지 않고 폐기 사유와 함께 남겨서, 같은 아이디어가 다시 나올 때 재검토 비용이 0이 된다.
- **Check가 라이브 앱으로 AV1·VP8을 실제 렌더해봤다.** 테스트가 통과한다는 사실만으로는 FR-M04의 커버리지 구멍이 보이지 않았다. 직접 돌려보니 "주장은 참인데 무방비"라는 정확한 진단이 나왔다.
- **Act가 테스트를 추가하지 않고 통합했다.** 업로드 전용 2건을 렌더 루프에 흡수시켜 케이스 수는 그대로 두고 커버리지만 늘렸다.
- **"화이트리스트를 들지 않는다"가 실제로 값을 했다.** HEVC 지원이 우리 코드 변경 없이 생겼다. 정적 목록을 유지했다면 Chrome이 앞서갈 때마다 뒤처졌을 것이다.

### 5.2 개선할 것 (Problem)

- **Plan 없이 구현이 먼저 들어갔다.** `a2c1ff7`은 FR-M01/M03/M04를 구현하면서 Plan 전제가 틀렸다는 것도 같이 알아냈지만, Plan을 그때 고치지 않아 2주간 문서와 코드가 어긋난 채로 있었다.
- **`오디오 업로드도 동일하게 점검`이 산문에 묻혀 누락됐다.** Plan v0.1.0 §2.1의 마지막 줄이었고 요구사항 표에 없었다. **표에 없으면 빠진다.** FR-M06으로 승격하고 나서야 구현됐다.
- **Do 단계 미기재 결정이 또 나왔다 (Gap-3).** Day1 회고 §6.3이 "그 자리에서 문서에 한 줄 추가"를 Try로 남겼는데 **두 사이클 연속 같은 지점에서 걸렸다.** 습관으로 자리잡지 못했다는 뜻이다.

### 5.3 다음에 시도할 것 (Try)

- **Plan의 실측 표에 측정 날짜와 브라우저 버전을 필수로 넣는다.** v0.1.0이 "2026-07-28 Chrome에서 측정"이라고만 써서 버전이 없었다. 버전이 있었다면 재측정 시점이 더 빨랐을 것이다.
- **범위 항목은 전부 FR 표에 넣는다.** 산문 bullet은 구현 체크리스트가 되지 못한다.
- **미기재 결정을 Do 커밋 메시지가 아니라 Plan에 쓴다.** 커밋 메시지에 남기는 것까지는 두 사이클 다 했다. 문서에 옮기는 단계에서 실패한다 — 커밋 직전에 Plan diff가 있는지 보는 것을 조건으로 걸어본다.

---

## 6. Process Improvement Suggestions

| Phase | 이번 사이클 | 개선 제안 |
|-------|-------------|-----------|
| Plan | 실측 기반이었으나 버전 미기록으로 전제가 노후 | 측정 표에 브라우저 버전 필수 |
| Design | 생략 — 적절했다 | 설계 선택지가 없는 확장 작업에서는 유지 |
| Do | 구현이 Plan보다 먼저 들어감 | 구현 중 전제가 틀린 것을 알면 **그 커밋에서** Plan을 고친다 |
| Check | 재현 + 라이브 실행 — 이번 사이클 최고 수확 | 유지. "테스트 통과"와 "요구사항 충족"을 분리해서 보는 습관 |
| Act | 3건 전량 수정 후 재검증 | 유지 |

---

## 7. Changelog

### v0.2.1 (2026-08-15)

**Added:**
- 오디오 업로드 실패 시 코덱명 안내 — AAC·ALAC·AC-3·DTS·FLAC·Opus 등 라벨
- AV1 mp4 · VP8 WebM · ALAC m4a 픽스처와 생성 스크립트
- 코덱별 업로드→렌더→`ffprobe` E2E (HEVC·AV1·VP8)

**Changed:**
- `videoCodecTag.ts` → `codecTag.ts`. `readCodecTag(file, kind)`가 `hdlr` 핸들러 타입으로 트랙을 선택
- Plan을 Chrome 148 실측 기준으로 v0.2.0 개정 — 폐기된 접근 3건을 사유와 함께 기록

**Fixed:**
- 오디오·영상이 섞인 mp4에서 첫 `trak`을 무조건 읽어 영상 거부를 오디오 코덱명으로 설명하던 잠재 버그

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-08-15 | 완료 리포트. Match Rate 100%, SC 5/5, FR 6/6, Gap 3/3 해소. 검증 커맨드 4종 재실행. | 김성권 / Claude |
