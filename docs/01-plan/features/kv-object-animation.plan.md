# Key Visual Object Animation Planning Document

> **Summary**: 정적 키비주얼 위의 오브젝트를 AI 또는 사용자가 직접 지정하고, 지정한 오브젝트에 애니메이션 이펙트를 걸어 레퍼런스의 마지막 층을 재현한다
>
> **Project**: mkt_videodesigner
> **Version**: 0.1.0
> **Author**: 김성권 / Claude
> **Date**: 2026-08-26
> **Status**: Draft — kv-loop-reference-motion의 M4·M5 완료가 선행 조건

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | kv-loop-reference-motion이 레퍼런스의 카메라·컷·블러를 재현한 뒤에도, 레퍼런스에는 마지막 한 층이 남는다: 떠다니는 불티, 불꽃 글로우의 펄스 — [실측](../../03-analysis/kv-loop-reference-motion.reference-measurement.md) §3에서 확인된, 정적 원화 위에 오브젝트별로 따로 걸린 애니메이션이다. 카메라 워크로는 원리적으로 닿지 않는다. |
| **Solution** | 키비주얼 위에 **오브젝트를 지정**하고(AI 제안 또는 사용자가 직접), 지정한 오브젝트/영역에 **이펙트를 배정**한다(파티클 방출, 글로우 펄스, 라이트 스윕 등). 이펙트는 결정론적 캔버스 레이어로 그려져 미리보기와 렌더가 같은 프레임을 낸다. |
| **Requester's framing** | "오브젝트를 AI 혹은 제가 직접 지정하여 효과를 주는 게 최종 목표" — 2026-08-26 요청자 확인. 지정의 두 경로가 요구사항의 일부다. |
| **Core Value** | 영상팀이 AE에서 하던 오브젝트 애니메이션을 브라우저 안으로 가져오면, 루핑 파이프라인의 마지막 외주 의존이 사라지고 언어별 배치 렌더의 이점이 이펙트까지 확장된다. |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 레퍼런스와의 남은 체감 차이가 이 층 하나로 수렴한다 (reference-measurement §3). 카메라·컷·블러는 이미 재현됐다 |
| **WHO** | 사내 UA Manager·마케터. 검수자는 영상팀 디자이너 |
| **CONSTRAINT** | 이 앱의 약속: 업로드 소재는 서버로 가지 않는다(README). AI 지정도 온디바이스가 기본이어야 하고, 외부 API는 명시적 옵트인으로만 |
| **METHOD** | kv-loop-reference-motion과 같은 방식 — 스파이크로 렌더 경로를 먼저 실증하고, 수치 게이트로 판정하며, 기본값은 발명하지 않고 레퍼런스에서 실측한다 |
| **RISK** | ① 파티클의 무작위성 — `Math.random()`은 미리보기와 렌더가 다른 프레임을 낸다. ② 캔버스 레이어의 렌더 비용 — 북엔드 블러의 교훈(소프트웨어 경로에서 프레임당 1.25초)이 있다. ③ AI 지정의 모델 크기·정확도 |

---

## 1. Overview

### 1.1 무엇을 만드는가

한 키비주얼 슬롯에 **이펙트 오브젝트 목록**이 생긴다. 오브젝트 하나는
"어디에(영역 또는 점) + 무엇을(이펙트 종류) + 어떻게(세기·색·밀도)"다.

지정의 두 경로:

| 경로 | 동작 | 근거 |
|---|---|---|
| **직접 지정** | 미리보기 위에서 영역을 드래그하거나 점을 찍는다. kv-motion-effects의 드래그 사각형 UX(`KvMotionOverlay`)가 전례이자 재사용 후보 | 확실하고, 모델 없이 동작한다 |
| **AI 지정** | 이미지에서 이펙트를 걸 만한 오브젝트(불, 광원, 하늘, 캐릭터 무기 등)를 감지해 후보로 제안하고, 사용자가 승인·수정한다 | browser-video-mvp Design의 "Optional intelligence — Beta 객체 감지"(미구현으로 남아 있던 자리)가 이 기능의 예약석이다. **AI는 제안까지만, 확정은 항상 사용자**로 두면 실패해도 직접 지정 경로가 남는다 |

### 1.2 이펙트 후보 — 레퍼런스에서 실측된 것부터

| 이펙트 | 레퍼런스 근거 | 구현 스케치 |
|---|---|---|
| 파티클 방출 (불티·반딧불·눈) | reference-measurement §3의 점 궤적 | 지정 영역에서 결정론적 시드로 방출, 캔버스에 프레임 함수로 드로잉 |
| 글로우 펄스 | §3의 방사형 halo | 지정 점 중심의 radial-gradient 레이어, 주기적 opacity/scale |
| 라이트 스윕 | 레퍼런스엔 없으나 UA 소재 관행 | `mask-image` + gradient — kv-motion-effects §1.2.2에서 렌더러 지원 실측됨 |

### 1.3 렌더 경로 — 이미 실증된 것과 스파이크로 확인할 것

- `@remotion/web-renderer`는 `<canvas>` 요소를 래스터화한다 (kv-motion-effects
  Plan §1.2.2 — `instanceof HTMLCanvasElement` 분기 실측). 캔버스 파티클 레이어는
  렌더에 들어간다.
- **M0 스파이크로 확인할 것**: ① `useCurrentFrame` 구동 + 시드 고정 파티클이
  미리보기·렌더에서 프레임 단위로 동일한가(결정론), ② 캔버스 레이어의 프레임당
  비용 — 북엔드 블러처럼 경로에 따라 비쌀 수 있다, ③ 두 래스터화 경로의 일치.

### 1.4 AI 지정의 기술 후보 (결정 전 조사 항목)

| 후보 | 성격 | 제약 |
|---|---|---|
| 온디바이스 세그멘테이션 (경량 SAM 계열·ONNX Runtime Web / transformers.js) | 클릭 지점 → 마스크. 서버 전송 없음 | 모델 수십 MB 로드, WebGPU 유무에 따른 속도 |
| 온디바이스 감지 (경량 디텍터) | 자동 후보 박스 | "불꽃" 같은 게임 아트 클래스는 일반 모델 밖 — 정확도 검증 필요 |
| 외부 vision API (옵트인) | 정확도 높음 | 소재가 기기 밖으로 나간다 — 기본값 불가, 명시 동의 필요 |

**직접 지정이 먼저 완성되고, AI는 그 위의 가속기**라는 순서가 이 표의 결론이다.

### 1.5 Decisions Needed Before Design

| # | 질문 | 기본 제안 |
|---|---|---|
| D-01 | 1차 범위 — 직접 지정만 먼저인가, AI 제안까지인가 | 직접 지정 + 이펙트 2종(파티클·글로우)으로 한 사이클, AI 제안은 다음 |
| D-02 | 오브젝트의 스키마 표현 — 영역(rect/폴리곤)인가 마스크인가 | rect + 반경(점)부터. 마스크는 AI 지정과 함께 |
| D-03 | 결정론 — 시드를 어디에 두는가 | 오브젝트별 고정 시드(스키마에 저장), 프레임 번호가 유일한 시간 입력 |
| D-04 | 이펙트 레이어의 카메라 추종 — 왕복 줌과 함께 움직이는가 | 함께 움직인다(원화에 붙은 오브젝트이므로). `KvScene`의 transform 안쪽에 그린다 |
| D-05 | 성능 게이트 | kv-loop-reference-motion과 동일 방법: 스파이크에서 on/off 렌더 시간 비교, 실기기 재측정 |
| D-06 | 지정 UI의 위치 | 인스펙터 + 미리보기 오버레이 (KvMotionOverlay 관례) |

### 1.6 Related Documents

| Document | Relevance |
|---|---|
| [kv-loop-reference-motion.reference-measurement.md](../../03-analysis/kv-loop-reference-motion.reference-measurement.md) | §3 — 이 기능이 재현할 층의 실측 |
| [kv-loop-reference-motion.plan.md](kv-loop-reference-motion.plan.md) | §2.2 — 이 기능이 최종 목표로 기록된 곳 |
| [kv-motion-effects.plan.md](kv-motion-effects.plan.md) | §1.2.2 — 렌더러의 canvas/mask-image 지원 실측 |
| [kv-loop-reference-motion.m0-blur-spike.md](../../03-analysis/kv-loop-reference-motion.m0-blur-spike.md) | §2.1 — 경로 의존적 렌더 비용의 전례 |

---

## 2. Success Criteria (초안)

| SC | 판정 방법 |
|---|---|
| SC1 | 지정한 영역에서만 이펙트가 발생하고, 영역 밖 픽셀은 비트 동일 |
| SC2 | 같은 프로젝트를 두 번 렌더하면 프레임 단위로 동일 (결정론) |
| SC3 | 미리보기에서 스크럽한 프레임과 렌더된 같은 프레임이 일치 |
| SC4 | 이펙트가 왕복 줌과 함께 움직인다 (D-04) |
| SC5 | 이펙트 켠 렌더 시간이 끈 렌더 대비 실기기에서 정한 게이트 이내 |
| SC6 | 이펙트 없는 기존 프로젝트는 변경 전과 프레임 단위로 동일 |

---

## 3. Next Steps

1. kv-loop-reference-motion **M4·M5 완료가 먼저다** — 같은 실기기 검증 루프를
   이 기능도 타므로, 그 루프가 닫히는 것을 보고 시작한다
2. §1.5 결정 (특히 D-01 범위)
3. M0 스파이크 — 결정론 캔버스 레이어의 렌더 실증 (§1.3)
4. Design 문서

---

## Version History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 0.1.0 | 2026-08-26 | 김성권 / Claude | 최초 작성 — 요청자의 최종 목표 확인("AI 혹은 직접 지정")을 요구사항으로 옮김 |
