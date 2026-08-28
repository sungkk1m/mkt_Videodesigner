# steam-review Plan — 스팀 상점 페이지 목업 템플릿

> **Summary**: 화면 전체가 스팀 상점 페이지처럼 생긴 UA 영상 템플릿을 추가한다.
> 상점 UI(타이틀·태그·설명·리뷰)는 템플릿이 그리고, 그 안의 영상 자리에서
> 업로드한 게임플레이가 20초 재생된다. 레퍼런스: `Desktop/reference`의
> 언더다크 스팀 영상 12종 (4언어 × 3규격).
>
> **Project**: mkt_videodesigner
> **Feature key**: `steam-review`
> **Author**: 김성권 / Claude
> **Date**: 2026-08-28
> **Status**: Draft — 제품 결정 4건 사용자 확정 (2026-08-28)

---

## Executive Summary

| 관점 | 내용 |
|---|---|
| **Problem** | "스팀 리뷰" 포맷 UA 영상(상점 페이지 목업 + 게임플레이 + 리뷰 소셜프루프)은 현재 외부 편집 툴에서 언어 4종 × 규격 3종 = 12개를 손으로 만든다. 게임플레이 소재나 문구가 바뀔 때마다 12개를 전부 다시 뽑아야 한다. |
| **Solution** | `template` 판별자에 `steam-review` arm을 추가한다. 스팀 상점 UI 셸(타이틀·태그 4개·스토어 설명·리뷰 목록·썸네일 줄)은 컴포지션이 그리고, 게임플레이 영상·키아트 이미지·썸네일 4장·문구만 업로드/입력받는다. 리뷰 문구와 프로필 사진은 4언어 고정 내장. |
| **Function/UX Effect** | 템플릿 선택기에 5번째 항목이 생긴다. 영상 1개(+언어별 교체), 이미지 5장, 문구 몇 줄만 넣으면 기존 Batch가 4언어 × 3규격 12개 MP4를 뽑는다. 길이는 20초 고정이라 타임라인 조작이 사실상 없다. |
| **Core Value** | 이미 검증된 파이프라인(4언어 카피 · 3규격 렌더 · Batch · 자동 저장)에 "상점 페이지 목업"이라는 새 소재 문법을 얹는다. 새로 만드는 것은 **정적 UI 셸과 좌표 3벌**뿐이고, 영상 디코드 부담은 three-scene과 같은 1개다. |

---

## Context Anchor

| Key | Value |
|---|---|
| **WHY** | 스팀 리뷰 포맷은 리뷰 소셜프루프가 훅인 검증된 소재인데, 12개 산출물을 손으로 만들고 있다. 문구·소재 교체 비용이 반복 실험을 막는다. |
| **WHO** | UA 매니저(본인). 기존 4개 템플릿 사용자와 동일. |
| **RISK** | ① 텍스트가 많은 UI라 규격 3벌의 좌표·타이포가 레퍼런스와 어긋나기 쉽다 ② 고정 리소스(리뷰·프로필)를 레퍼런스에서 추출하는 품질 ③ 시간축 최소 구간 수(2)와 이 템플릿의 1구간이 충돌 ④ 20초가 기존 15/30/60 프리셋 밖이다. |
| **SUCCESS** | 4언어 × 3규격 12개 MP4가 Batch로 나오고, 레퍼런스 영상과 육안 대조로 레이아웃이 일치하며, 기존 4템플릿 테스트에 회귀가 없다. |
| **SCOPE** | 스키마 arm 1개 · 고정 리소스 내장 · 컴포지션 1개(레이아웃 3벌) · 애셋 패널/인스펙터. 기존 템플릿 동작 무변경. |

---

## 1. Overview

### 1.1 레퍼런스에서 확인한 사실

`C:\Users\superplanet-market\Desktop\reference` — ffprobe와 프레임 추출로 직접 확인.

| 항목 | 확인 내용 |
|---|---|
| 산출물 | 4언어([KR]/[ENG]/[JP]/[CT]) × 3규격(가로 1920×1080 / 세로 1080×1920 / 정방 1080×1080) = 12개 MP4 |
| 사양 | 전부 **20.0초, 30fps**, H.264 + AAC 48kHz 스테레오 |
| 컨셉 | 스팀 상점 페이지 목업. UI 셸은 정지, 영상 슬롯에서 게임플레이 재생 |
| 언어별 차이 | 타이틀·태그·스토어 설명·리뷰 문구만 번역. 프로필 사진·레이아웃·아트 동일. JP도 타이틀은 영문 그대로 |
| 게임플레이 소스 | 언어 공통으로 보이나 **KR 영상에만 '확률형 아이템 포함' 자막이 영상 안에 박혀 있음** → 언어별 소스 교체가 필요한 실증 사례 |
| 엔드카드 | 마지막 ~2초의 "Under Dark" 로고 화면은 게임플레이 소스에 포함된 것. UI 셸은 그대로 유지됨 |
| 태그 | 목업 PNG 기준 4개. KR은 4번째가 `확률형 아이템 포함`, 그 외 언어는 `Play now`류 |
| 리뷰 목록 | 4건(프로필 사진 + 👍추천 + "기록상 N시간" + 코멘트 + ☆). **가로·세로는 고정, 정방형만 위로 스크롤 루프 애니메이션** |
| `TITLE_스팀리뷰` PNG | 언어별 UI 목업 2벌(2400×1256, 2160×2160). 산출 규격이 아니라 디자인 원본 — 고정 문구·태그의 추출 소스로 쓴다 |

**규격별 화면 구성** (레퍼런스 프레임 대조):

| 구성 요소 | 가로 16:9 | 세로 9:16 | 정방 1:1 |
|---|---|---|---|
| 타이틀 + 태그 칩 4개 | 좌상단 | 키아트 배너 아래 | 최상단 |
| 게임플레이 영상 | 좌측 대형(16:9) | 중앙(≈16:9) | 중앙(대형) |
| 썸네일 줄(재생버튼 오버레이) | 영상 아래 4장+스크롤바 | 영상 아래 3장 | 없음 |
| 가로형 키아트 이미지 | 우측 사이드바 상단 | 최상단 배너(와이드 crop) | 없음 |
| 스토어 설명 | 우측 사이드바 (타이틀 아래) | 없음 | 없음 |
| 리뷰 목록 | 우측 사이드바 하단, 고정 | 하단, 고정 | 하단, **스크롤 루프** |

### 1.2 현재 구조에서 무엇이 걸리는가

읽어서 확인한 사실만 적는다.

| 항목 | 현재 | steam-review에 쓸 수 있는가 |
|---|---|---|
| `templateSettings` | `template` discriminated union, 4 arm | **arm 하나 추가** — conventions §3.1 "Adding a template means two arms, not a schema change" |
| `LOCALES` | `['ko','en','ja','zh-TW']` (`constants.ts:143`) | **레퍼런스의 KR/ENG/JP/CT와 정확히 일치. 무변경** |
| `ASPECT_RATIOS` | `['9:16','1:1','16:9']` | **일치. 무변경** |
| `DURATION_PRESETS` | `[15,30,60]`, `durationPresetsForTemplate()`로 템플릿별 제한(day1-quad 선례) | **20 추가 필요.** 튜플에 20을 넣고 이 템플릿만 `[20]`으로 고정, 기존 템플릿은 `[15,30,60]` 유지 |
| `sectionsSchema` | `.min(MIN_SECTION_COUNT)` = 2 | **충돌.** 이 템플릿은 게임플레이 1구간뿐. §2.6에서 결정 |
| `MIN_SECTION_COUNT` 소비처 | `sectionsSchema.min`, `kvLoopSettingsSchema.slots.min` | 전역을 1로 낮추면 **kv-loop 슬롯 하한이 같이 풀린다** → kv-loop용 상수 분리 필요 (§2.6) |
| 언어별 미디어 슬롯 | kv-loop `images: z.partialRecord(locale, …)` + en 폴백 (`domain/kvloop/assets.ts`) | **같은 패턴 재사용** — 게임플레이 영상의 언어별 교체 |
| `localizedCopySchema` | 템플릿별 optional 블록(`day1Labels`, `kvLoopDisclaimer`) 선례 | **optional 블록 추가** — 타이틀·설명·태그. 마이그레이션 없음 |
| `audioMixSchema` | `originalVolume` + BGM + 덕킹 | **재사용** — 원본 영상 오디오 + BGM. 나레이션/TTS는 이 템플릿에서 노출 안 함 |
| 렌더/Batch/파일명 | 템플릿 무관, `TEMPLATE_FILE_SEGMENT` 맵 | **세그먼트 1개 추가** (`steamreview`) |
| 컴포지션 | 템플릿당 `{X}Composition.tsx` + 하위 폴더 | **동일 패턴** — `SteamReviewComposition.tsx` + `compositions/steamreview/` |
| 템플릿 전환 | 파괴적 전환 + 강제 변환 안내(day1-quad 60→30 선례) | **동일 패턴** — 전환 시 20초로 강제 + 안내 |
| 내장 정적 애셋 | `public/`에 favicon·poc-tone뿐. 이미지 내장 선례 없음 | **첫 사례.** 프로필 사진 4장 내장 (§2.4) |
| 아키텍처 테스트 | `src/test/architecture.test.ts`가 의존 방향 검사 | 신규 폴더도 자동 적용 — domain은 React/Remotion 임포트 금지 |

### 1.3 왜 별도 템플릿인가

기존 어느 템플릿의 변형도 아니다. three-scene은 장면 전환 문법, day1 계열은 분할
대비 문법, kv-loop은 이미지 루핑 문법이다. steam-review는 "정적 UI 셸 + 영상 슬롯
1개" 문법으로, 공유할 수 있는 것은 시간축·카피·렌더 파이프라인 같은 공용 계층뿐이다.
arm 추가 방식은 day1-quad에서 검증된 경로이고 회귀 표면이 공용 상수 2개
(`DURATION_PRESETS`, 구간 수 하한)로 좁혀진다.

### 1.4 확정된 제품 결정

사용자 확인 완료 (2026-08-28). Design 단계에서 뒤집지 않는다.

| # | 결정 | 근거 |
|---|---|---|
| **Q1** | **출력은 기존 3규격 영상만** (16:9 · 9:16 · 1:1). 목업 PNG의 1200×628류 규격은 산출물이 아니다 | 레퍼런스 산출물이 3규격 12개. 새 캔버스 규격 추가는 범위 밖 |
| **Q2** | **길이 20초 고정.** 프리셋 선택 UI를 이 템플릿에서는 20초 하나만 노출 | 레퍼런스 전량 20.0초. day1-quad가 프리셋을 좁힌 선례(`durationPresetsForTemplate`)를 따른다 |
| **Q3** | **업로드 이미지 = 가로형 키아트 1장 + 썸네일 4장.** 엔드카드 별도 기능 없음(게임플레이 소스에 포함된 것으로 취급) | 사용자 선택. 키아트는 16:9 사이드바와 9:16 상단 배너 두 자리에 공용, 1200×628류 가로형 규격 상정 |
| **Q4** | **게임플레이 영상은 공통 1개 기본 + 언어별 교체 가능** | KR만 '확률형 아이템 포함' 자막이 박힌 소스를 쓰는 실사용 패턴. kv-loop `images` partialRecord 선례 재사용 |
| **Q5** | **태그는 언어별 4개 텍스트. KR은 4번째가 `확률형 아이템 포함`으로 잠김**(수정·삭제 불가), 1~3번째만 자유 입력. 그 외 언어는 4개 모두 자유 | 사용자 요구 "KR은 맨 마지막에 반드시 포함". 잠금이 실수를 구조적으로 막는다 |
| **Q6** | **리뷰 문구·프로필 사진·라벨 문자열(추천/기록상 N시간 등)은 4언어 고정 내장. 편집 UI 없음** | 사용자 요구 "수정 필요 없는 것". 레퍼런스 목업 PNG와 영상에서 추출 |
| **Q7** | **키아트·썸네일은 언어 공통 1세트** (언어별 분리 없음) | 레퍼런스 4언어가 동일 아트 사용을 프레임 대조로 확인. 언어별 분리는 Out of Scope |
| **Q8** | **스토어 설명은 언어별 텍스트, 16:9에서만 렌더** | 레퍼런스에서 설명이 보이는 규격은 16:9뿐 |
| **Q9** | **정방형 리뷰는 위로 스크롤 루프, 가로·세로는 고정** | 레퍼런스 프레임 대조로 확인(정방형만 t=8s→9s 사이 이동) |
| **Q10** | **썸네일 4장 전부 필수, 없으면 렌더 차단.** 규격별 표시 개수는 레이아웃이 결정(가로 4, 세로 3, 정방 0) | 빈 썸네일 칸이 나가는 소재는 쓸 수 없다 — Day1 FR-D03과 같은 정책 |
| **Q11** | **키아트는 16:9·9:16 렌더에 필수, 1:1만 렌더할 때는 불필요** | 키아트가 등장하지 않는 규격의 렌더를 막을 이유가 없다 |
| **Q12** | **UI 표기 `스팀리뷰`, 파일 세그먼트 `steamreview`** | 파일명 규칙 `{프로젝트}_{템플릿}_{언어}_{규격}_{길이}s_{fps}fps.mp4` 승계 |

---

## 2. 설계안 (Plan 수준 스케치 — 좌표·수치는 Design에서 확정)

### 2.1 레이아웃 3벌

캔버스는 규격별 픽셀 좌표(1920×1080 / 1080×1920 / 1080×1080)로 각각 잡는다.
day1의 `splitLayout(ratio)`처럼 `domain/steamreview/layout.ts`의 순수 함수가
각 요소의 rect를 반환하고, 컴포지션과 (필요 시) 편집 오버레이가 공유한다.

```
16:9 (1920×1080)                    9:16 (1080×1920)          1:1 (1080×1080)
┌────────────────────┬─────────┐    ┌─────────────────┐       ┌─────────────────┐
│ 타이틀              │ 키아트   │    │ 키아트 배너      │       │ 타이틀           │
│ [태그][태그][태그][태그]│─────────│    ├─────────────────┤       │ [태그]×4        │
├────────────────────┤ 타이틀   │    │ 타이틀           │       ├─────────────────┤
│                    │ 설명     │    │ [태그]×4        │       │                 │
│   게임플레이 영상    ├─────────┤    ├─────────────────┤       │  게임플레이 영상  │
│                    │ 리뷰     │    │ 게임플레이 영상   │       │                 │
│                    │ 리뷰     │    ├─────────────────┤       ├─────────────────┤
├────────────────────┤ 리뷰     │    │ 썸네일 ×3       │       │ 리뷰 (스크롤 ↑)  │
│ 썸네일 ×4 + 스크롤바 │ …       │    ├─────────────────┤       │ 리뷰            │
└────────────────────┴─────────┘    │ 리뷰 (고정)      │       └─────────────────┘
                                    │ 리뷰 …          │
                                    └─────────────────┘
```

### 2.2 스키마 스케치

```
steamReviewSettingsSchema = {
  template: 'steam-review',
  source: mediaReference | null,            // 공통 게임플레이 영상
  localeSources: partialRecord(locale, mediaReference),  // 언어별 교체 (Q4)
  trim: mediaTrim,                          // 공통 트림 (20초 창)
  transform: mediaTransform + 규격별 override,  // 영상 슬롯 프레이밍
  keyArt: { image: mediaReference | null, transform, overrides },  // Q3·Q7
  thumbnails: [mediaReference|null] ×4,     // Q10
}

localizedCopy.steamReview?: {               // optional — 타 템플릿 무영향
  title: copyText,                          // 예: "UnderDark : Defense"
  description: copyText,                    // 16:9 전용 (Q8)
  tags: [copyText ×4],                      // KR은 [자유,자유,자유,'확률형 아이템 포함'(잠김)] (Q5)
}
```

리뷰 데이터는 스키마에 넣지 않는다 — `domain/steamreview/reviews.ts`에 4언어
상수로 내장한다(Q6). 프로젝트 JSON에 실리지 않으므로 문구를 나중에 고쳐도
저장 문서 마이그레이션이 없다.

### 2.3 시간축

구간 1개 `[{id:'gameplay', label:'게임플레이', durationMs:20000}]`. 경계 드래그
대상이 없으므로 타임라인은 트림(20초 창 선택)만 의미가 있다. 정방형 리뷰
스크롤(Q9)은 구간이 아니라 프레임 시각 기반 애니메이션이다.

### 2.4 고정 리소스 내장 (첫 사례)

| 리소스 | 출처 | 형태 |
|---|---|---|
| 프로필 사진 4장 | 레퍼런스 목업 PNG에서 crop (표시 크기 대비 2배 해상도 확보 확인) | `public/steam-review/…png` |
| 리뷰 문구 4건 × 4언어 | 목업 PNG + 영상 프레임에서 판독 (JP·CT 리뷰 문구는 Do 단계에서 영상 프레임 추출로 확정) | `reviews.ts` 상수 |
| 라벨 문자열 (추천 / 기록상 N시간 / Recommended / hrs on record / 推薦 / …) | 동일 | `reviews.ts` 상수 |
| 👍 · ☆ · ▶ 아이콘, 배경 그라데이션 | 추출하지 않고 CSS/SVG로 재현 | 컴포지션 코드 |
| 폰트 | Steam의 Motiva Sans는 사유 폰트 — **내장하지 않는다.** 시스템 산세리프 스택(4언어 CJK 커버) | 컴포지션 코드 |

### 2.5 기본 카피 (언더다크 초기값)

새 프로젝트 생성 시 목업에서 추출한 언더다크 문구를 기본값으로 채운다 —
바로 렌더해서 레퍼런스와 대조할 수 있는 상태가 검증에도 유리하다.
타이틀 `UnderDark : Defense`(전 언어), KR 설명 "디펜스란, 최후의 최후까지
버티는 자가 이기는 거야. …", KR 태그 `전략 타워 디펜스 / 압도적 긍정적 게임 /
200만회+ 다운로드 / 확률형 아이템 포함` 등 — 전체 표는 Design §카피에서 확정.

### 2.6 열어 둔 설계 결정 (Design에서 확정)

| # | 쟁점 | 후보 | 잠정 권고 |
|---|---|---|---|
| D-후보1 | 구간 수 하한: `sectionsSchema.min(2)`와 1구간의 충돌 | (a) `sectionsSchema.min(1)` + superRefine이 템플릿별 개수 고정, kv-loop 슬롯 하한은 전용 상수 `KV_MIN_SLOTS=2`로 분리 (b) 더미 2구간 | **(a)** — 저장 문서는 전부 구간 ≥2라 파싱 무영향. (b)는 거짓 모델 |
| D-후보2 | `DURATION_PRESETS`에 20 추가 시 타입 파급(`EditorRenderConfig.durationPreset` 등) 범위 | 튜플 확장 vs 템플릿별 프리셋 타입 분리 | 튜플 확장 — 소비처가 리터럴 유니언을 그대로 넓게 받는지 Design에서 확인 |
| D-후보3 | 정방형 리뷰 스크롤의 속도·루프 방식 | 레퍼런스 프레임 정밀 측정 | 등속 + 이음새 없는 순환(리스트 2벌 이어 붙이기) |
| D-후보4 | 키아트 두 자리(사이드바 ≈1.9:1, 세로 배너 ≈3.7:1)의 crop 제어 | cover 고정 vs 자리별 transform | cover + 규격별 override(기존 `RatioTransforms` 문법) |
| D-후보5 | 언어별 소스의 트림 공유 | 공통 trim 1개(소스 길이가 다르면 검증은 어느 소스 기준인가) | 공통 trim, 검증은 가장 짧은 해석 소스 기준 |

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | 요구사항 | 우선순위 | 상태 |
|----|---------|---------|------|
| FR-01 | 템플릿 선택기에 `스팀리뷰` 항목이 생기고, 선택 시 파괴적 전환 규약(이름·오디오·렌더 설정 유지, 템플릿 설정 초기화)을 따른다 | High | Pending |
| FR-02 | 길이는 20초 고정. 다른 템플릿에서 전환하면 20초로 강제되고 전환 전에 안내가 뜬다 | High | Pending |
| FR-03 | 게임플레이 영상: 공통 슬롯 1개 + 언어별 교체 슬롯. 렌더 대상 언어마다 해석 가능한 소스(교체분 또는 공통분)가 있어야 하며, 없으면 해당 렌더 차단 | High | Pending |
| FR-04 | 가로형 키아트 이미지 1장 업로드. 16:9 우측 사이드바 상단과 9:16 최상단 배너에 렌더. 16:9·9:16 렌더에 필수(Q11) | High | Pending |
| FR-05 | 썸네일 4장 업로드, 재생버튼 오버레이와 함께 영상 아래 줄에 렌더(가로 4·세로 3·정방 0). 4장 미만이면 렌더 차단(Q10) | High | Pending |
| FR-06 | 게임 타이틀: 언어별 텍스트 입력, 3규격 전부 렌더 | High | Pending |
| FR-07 | 스토어 설명: 언어별 멀티라인 텍스트 입력, 16:9에서만 렌더 | High | Pending |
| FR-08 | 태그: 언어별 4개 텍스트. KR 4번째는 `확률형 아이템 포함` 고정·잠김 | High | Pending |
| FR-09 | 리뷰 4건(프로필·추천 아이콘·기록 시간·코멘트·별)이 언어별 고정 내장으로 렌더. 정방형은 위로 스크롤 루프, 가로·세로는 고정 | High | Pending |
| FR-10 | 게임플레이 영상 트림(20초 창)과 프레이밍(Scale/X/Y, 규격별 override) 편집 | Medium | Pending |
| FR-11 | 미리보기(Player)가 3규격 각각의 레이아웃을 실시간 반영 | High | Pending |
| FR-12 | Batch: 언어 × 규격 최대 12개 순차 렌더, 파일명 `{프로젝트}_steamreview_{언어}_{규격}_20s_{fps}fps.mp4` | High | Pending |
| FR-13 | 오디오: 원본 영상 오디오 볼륨 + BGM 믹스(기존 오디오 패널 재사용). 나레이션·TTS는 이 템플릿에서 노출하지 않음 | Medium | Pending |
| FR-14 | IndexedDB 자동 저장·복구, JSON 내보내기/가져오기 라운드트립 | High | Pending |
| FR-15 | 30/60fps, Fast/Standard/High 프로필 지원 (기존 렌더 파이프라인 승계) | Medium | Pending |

### 3.2 Non-Functional Requirements

| 분류 | 기준 | 측정 방법 |
|---|---|---|
| 성능 | 렌더 시간이 three-scene 동일 조건 대비 1.5배 이내 (UI 셸은 정적 DOM, 동시 디코드 1개) | 렌더 벤치마크 1회 측정·기록 |
| 시각 충실도 | 레퍼런스 12종과 규격별 육안 대조에서 구조적 차이 없음 | 프레임 캡처 대조 |
| 회귀 | 기존 4템플릿 유닛·E2E 테스트 전부 통과 | `npm test`, `npm run test:e2e` |
| 아키텍처 | `architecture.test.ts` 통과 — `domain/steamreview`는 React/Remotion 임포트 없음 | `npm test` |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] FR-01 ~ FR-15 구현
- [ ] `domain/steamreview` 순수 로직(레이아웃·스크롤·리뷰 데이터 폴백) 유닛 테스트
- [ ] 스키마 arm·카피 블록·명령 유닛 테스트 (기존 템플릿 테스트 관례 승계)
- [ ] E2E 렌더 스모크 1개 (실제 Chrome 렌더로 MP4 산출 확인)
- [ ] 레퍼런스 대조 캡처를 analysis 문서에 첨부

### 4.2 Quality Criteria

- [ ] `npm test` 전체 통과 (기존 테스트 회귀 0)
- [ ] `npm run build` 성공 (타입체크 포함)
- [ ] 저장 문서 마이그레이션 불필요 확인 (`PROJECT_SCHEMA_VERSION` 유지)

---

## 5. Risks and Mitigation

| 리스크 | 영향 | 가능성 | 완화 |
|---|---|---|---|
| 텍스트 다량 UI의 규격별 좌표·타이포 어긋남 | Medium | High | 좌표를 `layout.ts` 순수 함수로 모으고, 레퍼런스 프레임과 픽셀 대조를 Do 체크리스트에 포함 |
| `MIN_SECTION_COUNT` 완화가 kv-loop 하한을 푸는 회귀 | High | Medium | kv-loop 전용 상수 분리(D-후보1). kv-loop 스키마 테스트로 하한 고정 확인 |
| `DURATION_PRESETS` 튜플 확장의 타입 파급 | Medium | Medium | D-후보2에서 소비처 전수 확인 후 확정 |
| 고정 리소스 추출 품질(프로필 crop 해상도, JP/CT 리뷰 문구 판독) | Medium | Low | 목업 PNG가 2배 해상도라 crop 여유 확인됨. 문구는 영상 프레임 확대 추출로 검증 |
| 시스템 폰트 스택이 언어·환경별로 다르게 보임 | Low | Medium | Design에서 스택 고정(CJK 폴백 포함), 규격·언어별 캡처 대조 |
| 스팀 UI 모사 소재의 플랫폼 정책 리스크 | Low | Low | Valve 로고·상표는 렌더하지 않음(레퍼런스도 미포함). 소재 운용 판단은 사용자 몫으로 명시 |

---

## 6. Impact Analysis

### 6.1 변경 자원

| 자원 | 종류 | 변경 내용 |
|---|---|---|
| `constants.ts` | 공용 상수 | `TEMPLATE_KINDS`에 `steam-review`, `DURATION_PRESETS`에 `20`, `durationPresetsForTemplate` 분기, 섹션 순서 상수, (D-후보1 채택 시) 하한 상수 분리 |
| `schema.ts` | Zod 스키마 | `steamReviewSettingsSchema` arm, `localizedCopy.steamReview` optional 블록, superRefine 트림·소스 검증 분기 |
| `types.ts` | 배럴 | 타입 재수출, 라벨 상수 |
| `fileName.ts` | 렌더 | `TEMPLATE_FILE_SEGMENT['steam-review'] = 'steamreview'` |
| `projectStore.ts` + `domain/editor/steamReviewCommands` | 상태 | 신규 필드 명령, `switchTemplate` 20초 강제 |
| `TemplateSelector.tsx` / `EditorWorkspace.tsx` / `Timeline.tsx` | UI | 드롭다운 항목, 패널 배선, 1구간 타임라인 표시 |
| 신규: `domain/steamreview/` · `compositions/SteamReviewComposition.tsx` + `compositions/steamreview/` · `features/editor/SteamReview{AssetPanel,Inspector}.tsx` | 신규 | 순수 로직 / 컴포지션 / 편집 UI |
| `public/steam-review/` | 정적 애셋 | 프로필 사진 4장 (내장 첫 사례) |

### 6.2 기존 소비처

| 자원 | 소비처 | 영향 |
|---|---|---|
| `DURATION_PRESETS` | 프리셋 UI, `switchTemplate` 강제 변환, 스키마 refine, `EditorRenderConfig` 타입 | 값 추가 — 기존 템플릿은 `durationPresetsForTemplate`가 기존 3종만 노출하므로 동작 무변경. 타입 파급은 D-후보2에서 전수 확인 |
| `MIN_SECTION_COUNT` | `sectionsSchema.min`, `kvLoopSettingsSchema.slots.min` | **주의** — kv-loop 하한은 전용 상수로 분리해 2 유지 (D-후보1) |
| `localizedCopySchema` | 카피 패널, 프로젝트 파일, migrate | optional 블록 추가라 기존 문서 파싱 무변경 |
| `templateSettingsSchema` | projectStore, 렌더 큐, Batch, migrate | arm 추가 — 기존 arm 무변경 |
| `audioMixSchema` | AudioPanel, AudioLayer | 무변경 (재사용만) |

### 6.3 검증

- [ ] 기존 4템플릿 프로젝트 JSON이 무변경 파싱되는지 (스키마 테스트)
- [ ] kv-loop 슬롯 하한 2 유지 (D-후보1 회귀 테스트)
- [ ] 기존 렌더 큐·Batch 경로가 새 arm에서 durationPreset 20을 통과시키는지

---

## 7. Architecture Considerations

기존 프로젝트 구조·규약을 그대로 따른다. 신규 결정 없음.

| 결정 | 선택 | 근거 |
|---|---|---|
| 레이어링 | domain(순수) → compositions(Remotion) → features/editor(UI) → app(주입) | `architecture.test.ts`가 강제하는 기존 규약 |
| 상태 | Zustand `projectStore` 명령 패턴 | 기존 템플릿과 동일 |
| 스타일 | 컴포지션 인라인 스타일(px 좌표) + `editor.css` | 기존 컴포지션 관례 |
| 테스트 | Vitest + Playwright | 기존 스택 |

---

## 8. Out of Scope

- 1200×628 등 새 출력 규격 (Q1에서 제외 확정)
- 15/30/60초 등 20초 외 길이 (Q2)
- 리뷰 문구·프로필 사진 편집 UI (Q6 — 고정 내장)
- 키아트·썸네일의 언어별 분리 (Q7)
- 엔드카드 별도 슬롯 (Q3 — 게임플레이 소스에 포함된 것으로 취급)
- 나레이션·TTS 노출 (FR-13)
- 스크롤바·마우스 커서 등 상점 페이지의 인터랙션 연출 추가 (레퍼런스에 없는 것은 만들지 않는다)

---

## 9. Next Steps

1. [ ] Design 문서 작성 (`steam-review.design.md`) — D-후보 1~5 확정, 좌표 3벌, 고정 리소스 추출 목록, 기본 카피 표
2. [ ] Do — 구현 (모듈 분할은 Design §Session Guide에서)
3. [ ] Check — 레퍼런스 대조 + gap 분석

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-28 | 초안 — 레퍼런스 분석, 제품 결정 Q1~Q12 확정 | 김성권 / Claude |
