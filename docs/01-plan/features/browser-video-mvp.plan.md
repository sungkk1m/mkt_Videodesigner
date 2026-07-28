# Browser Video MVP Planning Document

> **Summary**: 사내 UA Manager와 마케터가 별도 서버 없이 Chrome에서 다국어 UA 영상을 편집하고 MP4로 출력하는 정적 웹 MVP
>
> **Project**: mkt_videodesigner
> **Version**: 0.1.0
> **Author**: 김성권 / Codex
> **Date**: 2026-07-27
> **Status**: Approved for Design

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 기존 `mkt_bannerdesigner`는 정적 배너의 다국어·다규격 자동화에는 적합하지만, UA 영상은 장면 구성·자막·음성·다규격 렌더링 때문에 여전히 편집 도구와 제작 인력에 크게 의존한다. 사내 데스크톱 외부에서도 설치나 별도 서버 없이 사용할 수 있는 영상 제작 흐름이 필요하다. |
| **Solution** | GitHub Pages에 배포하는 React 정적 웹 앱에서 Remotion Web Renderer로 영상을 렌더링하고, 교체 가능한 `TtsProvider` 구조에 Transformers.js와 Supertonic을 연결한다. `ko/en/ja`는 브라우저 TTS를 베타 제공하고 `zh-TW` 및 TTS 실패 환경은 WAV/MP3 업로드로 처리한다. |
| **Function/UX Effect** | 사용자는 3장면 기반 템플릿에서 15·30·60초, 9:16·1:1·16:9, 4언어 문구를 편집하고 Single 또는 최대 12개 Batch MP4를 생성한다. 기본 60fps, 진행률·예상 시간·취소·실패 재시도를 제공하며 결과는 완료되는 순서대로 저장한다. |
| **Core Value** | 서버·계정·업로드 비용 없이 UA팀이 로컬 소재를 보호하면서 반복 제작과 현지화 출력 시간을 줄인다. 영상·TTS 엔진을 어댑터로 격리하여 브라우저 기술과 모델이 바뀌어도 편집 데이터와 템플릿을 유지한다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | UA 영상의 다국어·다규격 반복 제작을 디자이너 및 서버 의존 없이 브라우저에서 자동화한다. |
| **WHO** | 사내 UA Manager와 마케터. 사내 데스크톱 외부의 최신 Chrome 환경도 포함한다. |
| **RISK** | 1080p 60fps 브라우저 렌더링의 시간·메모리 부담과 Supertonic 유지보수 종료 공지가 가장 큰 위험이다. |
| **SUCCESS** | 3장면 영상 1개를 편집·미리보기·MP4 출력하고, 4언어×3비율 최대 12개를 중단 없이 순차 생성하며 TTS 실패 시 업로드 음성으로 완료할 수 있다. |
| **SCOPE** | 정적 편집기 기반 → 렌더 PoC → 3장면 템플릿 → 브라우저 TTS 베타 → Single/Batch 최적화 순으로 진행한다. |

---

## 1. Overview

### 1.1 Purpose

`mkt_bannerdesigner`의 직접 입력, 실시간 미리보기, 다국어·다규격 Batch 출력 경험을 영상으로 확장한다. MVP는 완전한 비선형 편집기보다 UA 반복 제작에 필요한 고정 구조와 제한된 구간 편집에 집중한다.

### 1.2 Background

- 주요 사용자는 영상 편집 전문가가 아니라 캠페인 실행 속도를 중시하는 UA Manager와 마케터다.
- 결과물은 모바일 UA 채널에서 사용하는 짧은 영상이며, 한 원본을 여러 언어와 화면비로 빠르게 전개해야 한다.
- 운영 환경은 최신 Chrome으로 제한할 수 있고, 프로젝트와 미디어는 사용자 브라우저 안에서 처리한다.
- `@remotion/web-renderer`는 WebCodecs 기반 브라우저 렌더링을 제공하며 MP4의 기본 조합은 H.264/AAC다.
- Transformers.js는 ONNX 모델을 브라우저의 WebGPU 또는 WASM으로 실행하고 모델을 브라우저 캐시에 저장할 수 있다.
- Supertonic은 브라우저 WebGPU/WASM 예제를 제공하지만 `zh-TW`를 지원하지 않으며, 2026-07-23 공지 기준 오픈소스 저장소의 추가 공식 지원이 종료될 예정이다.

### 1.3 Related Documents

- Existing product: `docs/00-reference/mkt_bannerdesigner/README.md`
- Existing conventions: `docs/00-reference/mkt_bannerdesigner/CLAUDE.reference.md`
- Remotion Web Renderer: https://www.remotion.dev/docs/web-renderer
- Browser render API: https://www.remotion.dev/docs/web-renderer/render-media-on-web
- Transformers.js: https://github.com/huggingface/transformers.js
- Supertonic: https://github.com/supertone-inc/supertonic

---

## 2. Scope

### 2.1 In Scope

- [ ] GitHub Pages에서 동작하는 Vite + React + TypeScript 정적 웹 앱
- [ ] 최신 데스크톱 Chrome의 WebCodecs·WebGPU·WASM·OPFS 기능 감지와 사전 진단
- [ ] 구조 검증용 3장면 템플릿: Hook → Gameplay/Proof → CTA
- [ ] 장면 기본 길이 조절과 각 장면의 소스 영상 trim in/out, crop, scale, X/Y 위치 조절
- [ ] 전체 길이 프리셋 15초·30초·60초와 장면 길이 합계 검증
- [ ] 출력 화면비 9:16(1080×1920), 1:1(1080×1080), 16:9(1920×1080)
- [ ] 영상당 Hook 문구 1개와 선택형 보조 문구 1개
- [ ] `ko/en/ja/zh-TW` 4언어 직접 입력과 언어별 폰트 자동 선택
- [ ] 자막을 기본 TTS 원고로 사용하고 언어·장면별 내레이션 원고 override 제공
- [ ] `UploadedAudioProvider`를 정식 경로로 지원
- [ ] `TransformersJsSupertonicProvider`를 `ko/en/ja` 베타 경로로 지원
- [ ] 언어별 기본 음성 자동 선택과 사용 가능한 Supertonic 음성 프리셋 선택
- [ ] 생성 음성이 장면 길이를 초과할 때 경고하고 문구 또는 장면 길이 수정을 유도
- [ ] Single 미리보기와 MP4 개별 출력
- [ ] Batch에서 선택한 언어×화면비 조합을 최대 12개까지 순차 출력
- [ ] Batch 진행률, 현재 항목, 남은 항목, 예상 시간, 취소, 실패 항목 재시도
- [ ] 기본 60fps, 선택 30fps
- [ ] MP4/H.264/AAC 출력과 실행 환경별 codec capability check
- [ ] 현재 작업의 로컬 저장, IndexedDB 미디어/TTS 캐시, 설정 중심 JSON 내보내기·가져오기
- [ ] GitHub Actions 또는 정적 빌드 결과를 통한 GitHub Pages 배포

### 2.2 Out of Scope

- 사용자 계정, 인증, 권한 관리, 클라우드 프로젝트 동기화
- 별도 API, 서버 렌더링, 렌더 팜, 데이터베이스
- 자동 번역과 LLM 기반 광고 카피 생성
- 음성 복제, 사용자 음색 학습, GPT-SoVITS 서버
- Supertonic이 공식 지원하지 않는 `zh-TW` 브라우저 생성형 TTS
- Premiere Pro 수준의 다중 트랙 타임라인, 자유 키프레임, 마스크, 컬러 그레이딩
- 사용자가 임의 개수의 장면이나 트랙을 추가하는 기능
- 모바일 브라우저, Safari, Firefox, Edge의 정식 지원
- 협업 댓글, 승인 워크플로, 캠페인·MMP 연동
- JSON 파일 내부에 대용량 원본 미디어 또는 음성 바이너리 포함
- 첫 템플릿의 최종 비주얼 확정과 다수 템플릿 제공. 3장면 구조의 비주얼은 Design 단계 브레인스토밍을 거친다.

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 앱 진입 시 Chrome·HTTPS·WebCodecs·H.264·AAC·WebGPU·OPFS 지원 여부를 검사하고 기능별 사용 가능 상태를 표시한다. | High | Pending |
| FR-02 | 사용자는 전체 길이를 15·30·60초 중 하나로 선택하고 기본 3장면의 길이를 조절할 수 있다. 장면 합계는 전체 길이와 항상 일치해야 한다. | High | Pending |
| FR-03 | 각 장면은 로컬 영상 또는 이미지를 받고 trim, crop, scale, X/Y를 화면비별로 독립 조정할 수 있다. | High | Pending |
| FR-04 | 기본 템플릿은 Hook, Gameplay/Proof, CTA 세 장면을 제공한다. Hook 카피 자동 작성은 하지 않으며 사용자가 입력한 Hook을 모션 장면으로 생성한다. | High | Pending |
| FR-05 | 영상당 Hook 1개와 선택형 보조 문구 1개를 지원하고, `ko/en/ja/zh-TW` 값을 독립 저장한다. | High | Pending |
| FR-06 | 언어별 폰트는 Pretendard(ko/en), Noto Sans JP(ja), Noto Sans TC(zh-TW)를 기본으로 하며 로드 실패 시 CJK-safe fallback을 사용한다. | Medium | Pending |
| FR-07 | 자막 텍스트를 내레이션 기본값으로 연결하되, 언어·장면별 TTS 원고를 별도로 수정할 수 있다. | High | Pending |
| FR-08 | `TtsProvider` 계약은 음성 생성 결과를 Blob URL, duration, sample rate, provider metadata로 반환하고 영상 템플릿은 공급자 구현을 알지 못해야 한다. | High | Pending |
| FR-09 | `UploadedAudioProvider`는 WAV/MP3 업로드, 미리듣기, 교체, 제거, 장면 연결을 지원하며 모든 언어의 fallback으로 동작한다. | High | Pending |
| FR-10 | Supertonic Provider는 `ko/en/ja`에서 모델 로드 진행률, 기본 음성, 프리셋 선택, 생성, 미리듣기, 재생성을 제공하고 Beta 배지를 표시한다. | High | Pending |
| FR-11 | `zh-TW`에서는 Supertonic 생성 버튼을 비활성화하고 음성 업로드 경로를 명확히 제공한다. | High | Pending |
| FR-12 | TTS 길이가 배정 장면을 초과하면 자동 배속·잘라내기 없이 초과 시간을 표시하고 렌더를 막는 검증 오류를 제공한다. | High | Pending |
| FR-13 | Single 모드는 현재 언어·화면비 결과를 실시간 미리보기하고 하나의 MP4로 출력한다. | High | Pending |
| FR-14 | Batch 모드는 선택된 언어×화면비 조합을 생성하며 한 프로젝트당 최대 12개 작업으로 제한한다. | High | Pending |
| FR-15 | Batch 렌더는 기본 순차 큐로 동작하고, 완료된 파일은 다음 작업을 기다리지 않고 즉시 저장한다. ZIP 생성은 하지 않는다. | High | Pending |
| FR-16 | Batch 작업은 진행률, 렌더 예상 잔여 시간, 취소, 실패 사유, 실패 항목만 재시작 기능을 제공한다. | High | Pending |
| FR-17 | 동일 언어 TTS는 화면비별로 다시 생성하지 않고 재사용하며, 모델·폰트·디코딩 미디어 캐시를 렌더 작업 간 재사용한다. | High | Pending |
| FR-18 | 렌더 출력은 MP4/H.264/AAC, 기본 60fps다. 사용자는 30fps로 변경할 수 있고 60fps 선택 시 예상 시간·메모리 경고를 확인한다. | High | Pending |
| FR-19 | 브라우저가 지원하면 Remotion의 `outputTarget: "web-fs"`를 사용해 대형 출력의 메모리 부담을 낮추고, 불가하면 ArrayBuffer fallback을 사용한다. | High | Pending |
| FR-20 | 프로젝트 자동 저장은 IndexedDB를 사용한다. JSON export는 문구·장면·타이밍·스타일·파일 메타데이터만 포함한다. | High | Pending |
| FR-21 | JSON import 후 생성 음성은 다시 생성하고 업로드 미디어·음성은 재선택하도록 누락 자산 목록을 보여준다. | High | Pending |
| FR-22 | 파일명은 `{prefix}_{duration}s_{ratio}_{lang}_{fps}fps.mp4` 규칙으로 생성한다. | Medium | Pending |
| FR-23 | 현재 렌더 중에도 앱이 완전히 멈춘 것으로 보이지 않도록 진행률과 취소 컨트롤을 유지한다. | High | Pending |
| FR-24 | 정적 빌드 결과는 GitHub Pages의 하위 경로에서도 asset URL과 라우팅이 정상 동작해야 한다. | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Compatibility | 최신 안정 Chrome 데스크톱에서 핵심 경로 통과 | macOS/Windows Chrome Playwright + 수동 codec 진단 |
| Rendering | 1080p 60fps MP4/H.264/AAC의 15·30·60초 Single 출력 가능 | 기준 장비별 실제 렌더 및 ffprobe 결과 |
| Batch Stability | 12개 작업을 순차 처리하며 탭 crash와 완료 파일 유실이 없어야 함 | 4언어×3비율 soak test |
| Performance | 동일 입력 재렌더에서 TTS·모델·미디어를 중복 로드하지 않고 항목별 시간·peak memory를 기록 | Performance API, Chrome Task Manager, 렌더 로그 |
| Responsiveness | 일반 편집 입력 반영 p95 100ms 이내, 렌더 중 취소 입력 1초 이내 수신 목표 | Performance marks + Playwright |
| Storage | 모델과 작업 캐시 용량을 표시하고 사용자 단위 삭제 기능 제공 | IndexedDB/Cache Storage/OPFS 검사 |
| Privacy | 원본 미디어·문구·음성이 별도 애플리케이션 서버로 업로드되지 않음 | Network panel 및 E2E 요청 allowlist |
| Resilience | WebGPU 실패 시 WASM 또는 업로드 음성으로 작업을 완료할 수 있음 | WebGPU disabled 테스트 |
| Accessibility | 주요 편집·렌더 컨트롤을 키보드로 사용할 수 있고 상태가 텍스트로 전달됨 | axe + 키보드 수동 테스트 |
| Maintainability | Remotion·Transformers.js·TTS 모델을 각각 어댑터 경계로 격리 | architecture test 및 import boundary 검사 |
| Deployment | 환경변수·비밀키 없이 정적 빌드 성공, GitHub Pages 새로고침 정상 | CI build + deployed smoke test |
| Licensing | Remotion 상업 사용 조건과 Supertonic 코드·모델 라이선스를 사내 사용 기준으로 확인 | 도입 전 라이선스 체크리스트 승인 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] Chrome capability check가 지원·제한·대체 경로를 정확히 표시한다.
- [ ] 구조 검증용 3장면 템플릿의 비주얼 브레인스토밍 결과가 Design 문서에 확정된다.
- [ ] 15·30·60초와 3개 화면비에서 장면 길이·trim·crop·텍스트가 정상 적용된다.
- [ ] 4언어 Hook·보조 문구가 독립 유지되고 화면비 전환 시 손실되지 않는다.
- [ ] `ko/en/ja` Supertonic TTS 생성과 `zh-TW` 업로드 음성 fallback이 동작한다.
- [ ] TTS 초과 길이가 렌더 전에 차단되고 수정 지점이 표시된다.
- [ ] Single MP4가 1080p, H.264/AAC, 기본 60fps로 생성된다.
- [ ] 최대 12개 Batch가 순차 완료되고 개별 파일이 완료 즉시 저장된다.
- [ ] Batch 취소와 실패 항목 재시도가 이미 완료된 파일에 영향을 주지 않는다.
- [ ] 프로젝트 자동 저장·복원과 설정 JSON round-trip이 동작한다.
- [ ] GitHub Pages 배포본에서 새로고침 후 앱과 정적 자산이 정상 로드된다.
- [ ] 라이선스 검토 결과가 문서화되고 필요한 Remotion 사용 조건을 충족한다.

### 4.2 Quality Criteria

- [ ] TypeScript strict mode, lint, unit tests, production build가 모두 통과한다.
- [ ] 핵심 도메인 로직의 단위 테스트 coverage 80% 이상을 달성한다.
- [ ] 4언어×3비율×3길이의 대표 조합 렌더 smoke matrix를 통과한다.
- [ ] 60초 60fps Single 및 12개 Batch 장시간 테스트에서 탭 crash가 없다.
- [ ] 기준 장비별 cold/warm TTS와 렌더 시간을 기록하고 다음 버전 비교 기준을 만든다.
- [ ] Batch 최적화에서 화면비별 TTS 재생성 0회, 모델 중복 초기화 0회를 확인한다.
- [ ] Network allowlist 외 애플리케이션 서버 요청이 없다.
- [ ] 실제 출력 파일의 codec, fps, duration, resolution을 자동 검사한다.

### 4.3 Performance Gate

절대 렌더 시간은 장비·브라우저·입력 codec에 크게 좌우되므로 Plan에서 임의 SLA를 확정하지 않는다. Design 시작 시 아래 PoC를 먼저 실행하고 기준 장비의 수치를 바탕으로 목표를 고정한다.

1. 15초 9:16 1080p60, 영상 1개 + 텍스트 모션 + AAC 오디오
2. 동일 구성의 30fps와 60fps 비교
3. 동일 언어 3비율 연속 렌더에서 캐시 재사용 여부 비교
4. 60초 9:16 1080p60 peak memory 측정
5. `web-fs`와 `arraybuffer` output target 비교
6. 순차 큐와 2개 병렬 큐 비교. 병렬은 속도 이득과 메모리 안정성이 모두 확인될 때만 채택

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 1080p 60fps 렌더가 일부 장비에서 지나치게 느리거나 메모리 부족 발생 | High | High | 사전 capability check, OPFS output, hardware acceleration 선호, 순차 큐, 30fps fallback, PoC 기반 경고 |
| 12개 Batch 결과를 Blob/ZIP으로 한 번에 유지하면 탭 crash 가능 | High | High | ZIP 제외, 한 항목씩 렌더·저장·참조 해제, OPFS 우선, 실패 항목만 재시도 |
| Supertonic 저장소 공식 지원 종료 | High | High | `TtsProvider` 격리, 버전·모델 revision 고정, 업로드 음성을 정식 fallback으로 유지, 대체 모델 교체 PoC 가능 구조 |
| `zh-TW` 브라우저 TTS 미지원 | Medium | Certain | 언어 선택 시 즉시 안내하고 WAV/MP3 업로드를 필수 경로로 제공 |
| WebGPU 미지원 또는 드라이버 오류 | Medium | Medium | WASM fallback, 진단 화면, TTS를 선택 기능으로 유지 |
| 첫 모델 다운로드가 느리거나 사내망에서 Hugging Face 차단 | High | Medium | 용량·진행률 표시, 브라우저 캐시, 재시도·timeout, 향후 승인된 정적 asset mirror 검토 |
| 생성 음성과 장면 길이 불일치 | High | High | 길이 사전 계산, 초과 렌더 차단, 자동 왜곡 금지, 해당 장면 바로가기 |
| 업로드한 원본 파일이 JSON 복원 후 누락 | Medium | High | 파일 메타데이터와 fingerprint 저장, 누락 자산 목록 및 재연결 UI |
| 사용자 입력 미디어 codec을 브라우저가 decode하지 못함 | High | Medium | 업로드 시 decode probe, 지원 포맷 안내, 렌더 전에 오류 차단 |
| Remotion 상업 라이선스 조건 불확실 | High | Medium | 구현 배포 전 회사 규모·사용 방식 기준 공식 라이선스 검토 및 필요 키/계약 반영 |
| GitHub Pages 하위 경로에서 worker/model/asset URL 오류 | Medium | Medium | Vite base path, 상대 asset URL, Pages preview E2E 검증 |
| 정적 호스팅이지만 외부 모델 CDN 의존으로 완전 오프라인이 아님 | Medium | High | “첫 다운로드 후 캐시 사용”을 명시하고, 완전 오프라인 번들은 별도 범위로 둔다 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `/Users/sungkkim/Desktop/mkt_videodesigner` | New project | 신규 정적 영상 편집기와 PDCA 문서 생성 |
| Browser storage | IndexedDB/Cache/OPFS | 프로젝트 설정, TTS, 모델, 렌더 임시 파일 저장 |
| GitHub Pages | Static hosting | 앱 shell과 정적 asset 배포 |
| Local media files | User-owned input | 브라우저 세션에서만 decode·render |
| `mkt_bannerdesigner` conventions | Reference | 4언어·Single/Batch·폰트 정책을 영상 프로젝트에 맞게 계승 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `mkt_bannerdesigner` | READ | 기존 README/CLAUDE 정책 참조 | 기존 프로젝트 수정 없음 |
| Browser storage | CREATE/READ/UPDATE/DELETE | 신규 `mkt_videodesigner` 앱 | 신규 origin 데이터만 영향 |
| GitHub Pages | DEPLOY | 신규 저장소의 `dist/` | 기존 배너 사이트와 독립 |
| Local media | READ | File API/Object URL | 원본 파일 수정 없음 |

### 6.3 Verification

- [ ] `mkt_bannerdesigner` 파일 및 배포 결과에 변경이 없음을 확인한다.
- [ ] 브라우저 저장소 삭제가 로컬 원본 파일을 삭제하지 않음을 확인한다.
- [ ] 앱의 네트워크 요청이 GitHub Pages, 승인된 폰트 CDN, Hugging Face 모델 asset으로 제한되는지 확인한다.
- [ ] 신규 저장소의 base path가 기존 GitHub Pages 프로젝트와 충돌하지 않는지 확인한다.

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Recommended For | Selected |
|-------|-----------------|-----------------|:--------:|
| **Starter** | 정적 배포, 브라우저 로컬 상태, 단일 사용자 도구 | 이번 MVP | ☑ |
| **Dynamic** | BaaS, 인증, 서버 데이터 | 향후 협업 기능 | ☐ |
| **Enterprise** | 마이크로서비스, 엄격한 계층·권한 | 현재 과도함 | ☐ |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| Build | Single HTML / Vite | Vite static build | Worker, WASM, 코드 분할, 테스트와 Pages base path 관리 필요 |
| UI | Vanilla / React | React + TypeScript | Remotion 컴포지션과 상태 기반 편집 UI 공유 |
| Video preview | Custom canvas / Remotion Player | Remotion Player | 미리보기와 출력 컴포지션의 동작 차이 최소화 |
| Video render | Server FFmpeg / Browser | `@remotion/web-renderer` | 별도 서버 없이 WebCodecs로 MP4 생성 |
| Output | ZIP / Individual | Sequential individual MP4 | 대형 ZIP의 메모리·대기 비용 제거 |
| Output storage | ArrayBuffer only / Adaptive | OPFS(`web-fs`) 우선 + ArrayBuffer fallback | 대형 60fps 결과의 peak memory 절감 |
| TTS runtime | Python server / Browser | Transformers.js/ONNX browser runtime | 정적 배포와 로컬 처리 유지 |
| TTS model | GPT-SoVITS / Supertonic | Supertonic Beta | `ko/en/ja` 브라우저 실행 가능, 공급자 교체 전제 |
| TTS fallback | None / Upload | WAV/MP3 upload | `zh-TW`, WebGPU 실패, 모델 장애를 모두 수용 |
| State | React Context / Zustand / Redux | Zustand 후보 | 편집·렌더 큐·캐시 상태를 단순하게 분리. Design에서 최종 선택 |
| Persistence | localStorage / IndexedDB | IndexedDB | Blob과 구조화 프로젝트 데이터 저장 |
| Validation | Manual / Zod | Zod | JSON import와 render props 계약 검증 |
| Testing | Vitest / Playwright | Vitest + Playwright | 도메인 로직과 Chrome 실제 렌더 경로 분리 검증 |
| Backend | Custom / Serverless / None | None | GitHub Pages 정적 배포 원칙 |

### 7.3 Architecture Direction

```text
Static React App
├── Editor
│   ├── Project / locale copy
│   ├── Three-scene controls
│   ├── Aspect-specific transforms
│   └── Remotion Player preview
├── Render
│   ├── Capability probe
│   ├── Single render
│   ├── Batch queue
│   └── OPFS / download adapter
├── Audio
│   ├── TtsProvider
│   ├── TransformersJsSupertonicProvider (Beta)
│   └── UploadedAudioProvider
└── Persistence
    ├── IndexedDB project/cache
    └── JSON metadata import/export
```

설계 단계에서는 다음 3안을 비교한다.

- Option A: 한 화면·한 store 중심의 최소 구조
- Option B: editor/render/audio/persistence를 완전히 분리한 Clean Architecture
- Option C: feature 모듈과 provider 경계만 유지하는 Pragmatic Architecture

기본 추천은 Option C다.

---

## 8. Convention Prerequisites

### 8.1 Existing Project Conventions

- [ ] 프로젝트 전용 `CLAUDE.md`
- [ ] `docs/01-plan/conventions.md`
- [ ] ESLint configuration
- [ ] Prettier configuration
- [ ] TypeScript strict configuration
- [ ] 테스트 파일명과 fixture 규칙

신규 빈 프로젝트이므로 Design 또는 Do 시작 전에 확정한다. `mkt_bannerdesigner`의 다음 정책은 계승한다.

- Single과 Batch 양쪽 지원
- `ko/en/ja/zh-TW` 직접 입력
- 언어별 폰트 자동 전환
- 공통 미디어와 언어별 카피 분리
- 사용자 데이터 손실을 막는 명시적 저장·복원

### 8.2 Conventions to Define/Verify

| Category | Current State | To Define | Priority |
|----------|---------------|-----------|:--------:|
| Naming | Missing | Components PascalCase, functions camelCase, feature IDs kebab-case | High |
| Folder structure | Missing | `features/editor`, `features/render`, `features/audio`, `lib`, `types` | High |
| State ownership | Missing | Project state와 transient render state 분리 | High |
| Provider contract | Missing | Video renderer, TTS, persistence interface | High |
| Error handling | Missing | 사용자 조치 가능한 typed error와 retryability | High |
| Import boundary | Missing | feature 간 직접 내부 import 금지 | Medium |
| Dependency version | Missing | Remotion 패키지 exact version 통일 | High |

### 8.3 Environment Variables Needed

없음. MVP는 비밀키와 애플리케이션 서버를 사용하지 않는다. GitHub Pages base path는 빌드 설정으로 관리한다.

모델 URL이나 revision은 공개 설정 파일에 고정하며 비밀값으로 취급하지 않는다. 외부 모델 CDN이 차단되는 환경을 위한 자체 asset mirror는 MVP 범위 밖이다.

### 8.4 Pipeline Integration

| Phase | Status | Document Location | Command |
|-------|:------:|-------------------|---------|
| Plan | Complete | `docs/01-plan/features/browser-video-mvp.plan.md` | `/pdca plan browser-video-mvp` |
| Design | Next | `docs/02-design/features/browser-video-mvp.design.md` | `/pdca design browser-video-mvp` |
| Do | Pending | Source + tests | `/pdca do browser-video-mvp` |
| Check | Pending | `docs/03-analysis/browser-video-mvp.analysis.md` | `/pdca analyze browser-video-mvp` |

---

## 9. Next Steps

1. [ ] Design 시작 전 첫 3장면 템플릿의 비주얼·모션 브레인스토밍
2. [ ] 3개 아키텍처 옵션 비교 후 Option A/B/C 선택
3. [ ] 15초 1080p60 브라우저 렌더 PoC와 기준 장비 benchmark
4. [ ] Supertonic `ko/en/ja` cold/warm load, 발음, 메모리 PoC
5. [ ] Remotion 및 Supertonic 모델의 사내 상업 사용 라이선스 검토
6. [ ] Design 문서와 세션별 구현 모듈 맵 작성
7. [ ] 구현 승인 후 프로젝트 scaffold 및 의존성 설치

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-07-27 | Initial Plan. Static browser render, 60fps default, provider-based TTS, sequential Batch optimization confirmed. | 김성권 / Codex |
