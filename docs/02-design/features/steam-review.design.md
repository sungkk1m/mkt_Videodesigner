# steam-review Design Document — 스팀 상점 페이지 목업 템플릿

> **Summary**: Plan의 Q1~Q12를 구현 가능한 좌표·데이터·파일 변경 목록으로 확정한다.
> 이 문서는 **자립적**이다 — 레퍼런스 재분석 없이 이 문서만으로 Do를 진행할 수 있도록
> 실측 좌표, 고정 문구 전문, 추출 crop 좌표를 모두 담았다.
>
> **Project**: mkt_videodesigner
> **Feature key**: `steam-review`
> **Author**: 김성권 / Claude
> **Date**: 2026-08-28
> **Status**: Design 완료 — 구조 C안(실용 균형) 사용자 확정, D-1~D-7 확정
> **Plan**: [steam-review.plan.md](../../01-plan/features/steam-review.plan.md)

---

## Context Anchor

| Key | Value |
|---|---|
| **WHY** | 스팀 리뷰 포맷은 리뷰 소셜프루프가 훅인 검증된 소재인데, 12개 산출물을 손으로 만들고 있다. 문구·소재 교체 비용이 반복 실험을 막는다. |
| **WHO** | UA 매니저(본인). 기존 4개 템플릿 사용자와 동일. |
| **RISK** | ① 텍스트 다량 UI의 규격별 좌표·타이포 어긋남 ② 고정 리소스 추출 품질 ③ 구간 하한(2)과 1구간 충돌 ④ 20초가 기존 프리셋 밖. |
| **SUCCESS** | 4언어 × 3규격 12개 MP4가 Batch로 나오고, 레퍼런스와 육안 대조로 레이아웃이 일치하며, 기존 4템플릿 테스트에 회귀가 없다. |
| **SCOPE** | 스키마 arm 1개 · 고정 리소스 내장 · 컴포지션 1개(레이아웃 3벌) · 애셋 패널/인스펙터. 기존 템플릿 동작 무변경. |

---

## 1. Overview

### 1.1 Design Goals

1. 레퍼런스 12종과 육안 대조로 구조적 차이가 없는 상점 페이지 셸.
2. 기존 템플릿 4종과 같은 골격(C안): domain 순수 모듈 + 컴포지션 + 패널/인스펙터.
3. 공용 계층 변경은 2건(프리셋 리터럴, 구간 하한)으로 봉쇄하고 각각 회귀 테스트를 붙인다.

### 1.2 확정 결정 (D-1 ~ D-7)

Plan §2.6의 열린 쟁점을 코드베이스 실사로 닫았다.

| # | 결정 | 근거 (읽어서 확인한 사실) |
|---|---|---|
| **D-1** | `MIN_SECTION_COUNT`를 1로 낮추고, kv-loop 슬롯 하한은 신설 상수 `KV_MIN_SLOTS = 2`로 분리한다. steam-review의 구간 수는 superRefine에서 정확히 1로 고정 | `MIN_SECTION_COUNT` 소비처는 `sectionsSchema.min`과 `kvLoopSettingsSchema.slots.min` 두 곳(schema.ts). 저장 문서는 전부 구간 ≥2라 완화해도 파싱 무영향. kv-loop 하한만 상수 분리로 2 유지 |
| **D-2** | **`DURATION_PRESETS` 튜플은 건드리지 않는다.** `STEAM_REVIEW_DURATION_S = 20` 상수 신설, `durationPresetSchema`에 `z.literal(20)` 추가(→ `DurationPreset` = 15\|20\|30\|60), `SCENE_DURATION_PRESETS_MS`에 `20:` 엔트리 추가(Record가 컴파일 강제), `durationPresetsForTemplate` 반환 타입을 `readonly DurationPreset[]`로 바꾸고 steam-review → `[20]` | 튜플에 20을 넣으면 ① kv-loop `kvLoopCombination`의 `DURATION_PRESETS.find(candidate > preset …)` 오류 안내가 20초를 후보로 제시하게 되고 ② three-scene 프리셋 UI 노출 목록 계산에 영향. 리터럴 추가 방식은 두 소비처 모두 무변경 (cycle.ts:114, timeline.ts:21 확인) |
| **D-3** | 정방형 리뷰 스크롤: **위로 52px/s 등속**, 리스트를 2벌 이어 붙여 `offset = (52 × frameMs/1000) mod cycleHeight`로 순환 | 레퍼런스 2초 간격 프레임 y-상관 측정: 104px/2s, 상관계수 0.992. 프레임 시각 기반이라 미리보기·렌더 결정론 일치 |
| **D-4** | 키아트 crop은 cover 고정 + 기존 `ratioTransformsSchema` 문법으로 규격별 override (16:9 사이드바 2.0:1, 9:16 배너 3.48:1) | 두 자리의 종횡비가 달라 단일 crop으로는 한쪽이 어긋난다. 기존 문법 재사용으로 신규 개념 0 |
| **D-5** | trim은 공통 1개. 언어별 교체 소스는 superRefine에서 각각 `durationMs ≥ trim 창` 검증 | 레퍼런스의 언어별 소스는 길이 동일(20s). 언어별 trim은 편집 표면만 4배로 만든다 |
| **D-6** | KR 4번째 태그는 상수 `STEAM_REVIEW_KR_NOTICE = '확률형 아이템 포함'`으로 고정. superRefine이 `copy.ko.steamReview.tags[3] === 상수`를 강제하고, 명령·UI는 해당 칸을 잠근다 | Plan Q5 "반드시 포함" — 스키마 수준 강제가 실수를 구조적으로 차단 |
| **D-7** | 리뷰 배치 서브셋: **16:9 사이드바 = 리뷰 1·2·3·4 전부, 9:16 = 2·3·4 고정, 1:1 = 2·3·4 순환** | 레퍼런스 프레임 대조 — 장문 리뷰(#1)는 사이드바에만 등장, 세로·정방은 단문 3건 |

### 1.3 레퍼런스 실측 요약 (측정 방법 포함)

| 측정 | 방법 | 결과 |
|---|---|---|
| 영상 슬롯 rect | 프레임 10장 시간 변화량(std>12) 마스크의 행/열 밴드 | 세로 (32,499) 1016×571 · 가로 (101,209) 1088×612 · 정방 (32,206) 1016×571 — **세 규격 모두 16:9 슬롯** |
| 스크롤 속도 | 정방형 리뷰 영역 y-상관 (2초 간격) | 위로 52px/s |
| 색 | 픽셀 샘플 | §7.1 토큰 표 |
| 문구 | 목업 PNG + 영상 프레임 판독 | §6 전문 |

---

## 2. Architecture

### 2.1 Component Diagram (C안)

```
domain/steamreview/               ← 순수 (React·Remotion 임포트 금지)
├── layout.ts        3규격 rect 표 + 폰트 크기 (§7)
├── reviews.ts       고정 리뷰 데이터 4언어 + 라벨 포맷 (§6)
├── scroll.ts        정방형 스크롤 오프셋 (D-3)
└── assets.ts        언어별 소스 해석 폴백 (kvloop/assets.ts 패턴)

compositions/
├── SteamReviewComposition.tsx    ratio 분기 + 시간축
└── steamreview/
    ├── StoreHeader.tsx           타이틀 + 태그 칩 4개
    ├── KeyArtBanner.tsx          9:16 상단 배너
    ├── GameplaySlot.tsx          영상 슬롯 (trim·transform 적용)
    ├── ThumbStrip.tsx            썸네일 줄 + 재생버튼 + (16:9) 화살표·스크롤바
    ├── Sidebar.tsx               16:9 우측 칼럼 (키아트·타이틀·설명·리뷰)
    ├── ReviewList.tsx            리뷰 목록 (고정/스크롤 variant)
    ├── ReviewCard.tsx            카드 1장 (size variant: lg/sm)
    └── assets/avatar-{1..4}.png  내장 프로필 (import로 번들 — BASE_URL 무관)

features/editor/
├── SteamReviewAssetPanel.tsx     영상(공통+언어별) · 키아트 · 썸네일 4
└── SteamReviewInspector.tsx      트림 · 프레이밍 · 키아트 crop

domain/editor/steamReviewCommands.ts   명령 (§5.4)
```

리뷰 텍스트(domain)와 아바타 이미지(composition asset)는 분리한다 — domain은
파일 URL을 모른 채 `avatarKey`만 들고, 컴포지션이 key → import URL 매핑을 갖는다.

### 2.2 Data Flow — 렌더

```
EditorProject ──(renderConfig: template·locale·ratio·20s·fps)──▶ 렌더 큐
  templateSettings(steam-review) ─┐
  copy[locale].steamReview ───────┼─▶ SteamReviewComposition
  REVIEWS[locale] (내장) ─────────┘      ├─ layout(ratio) → rect들
                                         ├─ resolveSource(settings, locale) → 게임플레이
                                         └─ ratio==='1:1' ? scrollOffset(frame) : 0
```

미디어 프록시는 쓰지 않는다 — 동시 재생 영상 1개로 three-scene과 같은 경로다
(`panelProxies`는 Day1 계열 전용 그대로).

---

## 3. Data Model

### 3.1 스키마 arm

```ts
// schema.ts — Design Ref: §3.1
export const steamReviewSettingsSchema = z.object({
  template: z.literal('steam-review'),
  /** 공통 게임플레이 소스. 없으면 언어별 소스만으로도 렌더 가능(전 언어 충족 시). */
  source: mediaReferenceSchema.nullable(),
  /** Plan Q4 — 언어별 교체. 희소 허용(kv-loop images와 같은 정책). */
  localeSources: z.partialRecord(localeSchema, mediaReferenceSchema).default({}),
  /** 공통 트림 — 20초 창 (D-5). */
  trim: mediaTrimSchema,
  /** 영상 슬롯 프레이밍. 기존 문법 (base + 규격별 override). */
  transforms: ratioTransformsSchema,
  /** Plan Q3·Q7 — 가로형 키아트 1장, 언어 공통. */
  keyArt: z.object({
    image: mediaReferenceSchema.nullable(),
    transforms: ratioTransformsSchema, // D-4 — 자리별 crop 조정
  }),
  /** Plan Q10 — 4장 고정 슬롯. null = 미업로드(렌더 차단 사유). */
  thumbnails: z.array(mediaReferenceSchema.nullable()).length(4),
});
```

superRefine 추가 분기 (기존 arm들의 관례 위치):
- 구간 수 = 정확히 1, id `gameplay` (`expectedSectionIds` arm: `['gameplay']`)
- `durationPreset === 20` 강제 (day1-quad D-4의 프리셋 좁히기와 같은 방식)
- trim 창이 `source.durationMs` 안 (기존 three-scene 검증 승계)
- `localeSources[*].durationMs ≥ trim.endMs` (D-5)
- `copy.ko.steamReview`가 있으면 `tags[3] === STEAM_REVIEW_KR_NOTICE` (D-6)

### 3.2 카피 블록

```ts
// localizedCopySchema에 추가 — day1Labels·kvLoopDisclaimer와 같은 optional 관례
steamReview: z.object({
  title: copyTextSchema,
  description: copyTextSchema,           // 16:9 전용 렌더 (Plan Q8)
  tags: z.tuple([copyTextSchema, copyTextSchema, copyTextSchema, copyTextSchema]),
}).optional(),
```

### 3.3 공용 상수 변경 (전체 목록 — 이것 외 공용 변경 없음)

| 상수 | 변경 | 회귀 방어 |
|---|---|---|
| `TEMPLATE_KINDS` | `'steam-review'` 추가 | 기존 4종 무변경 |
| `STEAM_REVIEW_DURATION_S` | 신설 `= 20` | — |
| `durationPresetSchema` | `z.literal(20)` 추가 (D-2) | `DURATION_PRESETS` 튜플 무변경 확인 테스트 |
| `SCENE_DURATION_PRESETS_MS` | `20: [2000, 15000, 3000]` (타입상 필요 — three-scene은 20을 노출하지 않아 도달 불가) | three-scene 프리셋 노출 목록 무변경 테스트 |
| `durationPresetsForTemplate` | 반환 타입 `readonly DurationPreset[]`, `'steam-review'` → `[20]` | 기존 템플릿 `[15,30,60]`/`[15,30]` 유지 테스트 |
| `MIN_SECTION_COUNT` | `2 → 1` (D-1) | — |
| `KV_MIN_SLOTS` | 신설 `= 2`, `kvLoopSettingsSchema.slots.min`이 참조 | kv-loop 슬롯 1개 거부 테스트 |
| `STEAM_REVIEW_SECTION_ORDER` | 신설 `['gameplay']` | — |
| `STEAM_REVIEW_KR_NOTICE` | 신설 `'확률형 아이템 포함'` (D-6) | — |
| `TEMPLATE_FILE_SEGMENT` | `'steam-review': 'steamreview'` | — |

### 3.4 기본값 (프로젝트 생성·전환 시)

- `trim`: 0~20000ms, `transforms`: 기본 cover
- `thumbnails`: `[null, null, null, null]`
- 카피는 §6.3 언더다크 기본 카피로 채운다 — 바로 렌더해 레퍼런스와 대조 가능한
  상태가 검증에 유리 (Plan §2.5)

### 3.5 명령 (steamReviewCommands.ts + projectStore 액션)

| 명령 | 규칙 |
|---|---|
| `setSteamReviewSource(ref\|null)` | |
| `setSteamReviewLocaleSource(locale, ref\|null)` | |
| `setSteamReviewTrim(trim)` | 창 길이 = 20000ms 불변 |
| `setSteamReviewTransform(ratio\|base, t)` | |
| `setSteamReviewKeyArt(ref\|null)` / `setSteamReviewKeyArtTransform(…)` | |
| `setSteamReviewThumbnail(index 0..3, ref\|null)` | 범위 밖 인덱스 거부 |
| `setSteamReviewTitle(locale, text)` / `setSteamReviewDescription(locale, text)` | |
| `setSteamReviewTag(locale, index, text)` | **`locale==='ko' && index===3`이면 거부** (D-6) |

### 3.6 렌더 필수 소재 검증 (렌더 큐 구성 시 — Day1 필수 정책과 같은 위치)

| 조건 | 차단 메시지 대상 |
|---|---|
| 렌더 대상 언어 L에 `localeSources[L] ?? source` 없음 | 해당 언어 |
| 렌더 대상 규격에 16:9·9:16 포함 && `keyArt.image === null` | 해당 규격 (Plan Q11) |
| `thumbnails`에 null 존재 && 렌더 대상 규격에 16:9·9:16 포함 | 해당 규격 (Plan Q10 — 1:1은 썸네일 미표시라 통과) |

---

## 4. 고정 리소스 (§6과 함께 이 문서의 자립성 핵심)

### 4.1 아바타 추출 사양

원본: `C:\Users\superplanet-market\Desktop\reference\TITLE_스팀리뷰\한_TITLE_스팀리뷰_2400x1256.png`
(언어 무관 동일 아트 — 한 파일에서만 추출)

| 파일 | crop (x0,y0,x1,y1) | 인물 |
|---|---|---|
| `avatar-1.png` | (1246, 77, 1432, 263) | 파스텔 애니 걸 |
| `avatar-2.png` | (1246, 375, 1432, 561) | 후드 전사 |
| `avatar-3.png` | (1246, 673, 1432, 859) | 핑크헤어 게이머 |
| `avatar-4.png` | (1246, 971, 1432, 1157) | 코기 |

186×186px. 채도 블록 검출로 얻은 좌표라 ±10px 시각 보정 후 저장(✱Do).
저장 위치: `src/compositions/steamreview/assets/` — import로 번들되어
GitHub Pages 서브패스(BASE_URL) 문제가 없다.

### 4.2 색 토큰 (레퍼런스 픽셀 샘플 — 구현 시 스포이드 재확인 ✱Do)

| 토큰 | 값 | 용도 |
|---|---|---|
| `pageTop` | `#2D3B50` | 페이지 배경 그라데이션 상단 |
| `pageBottom` | `#1C2636` | 〃 하단 |
| `panel` | `#16202C` | 리뷰 카드 배경 |
| `chipBg` | `#0D3951` | 태그 칩 배경 |
| `chipText` | `#6FC2EF` | 태그 칩 텍스트 |
| `thumbBlue` | `#66C0F4` | 👍 아이콘, 정방형 카드 구분선(2px) |
| `thumbBox` | `#1E4460` | 👍 아이콘 박스 배경 |
| `title` | `#FFFFFF` | 타이틀·추천 라벨 |
| `bodyText` | `#DCE5EB` | 리뷰 본문·설명 |
| `mutedText` | `#7A8B99` | 기록 시간 |
| `starGray` | `#4A5A68` | ☆ 아이콘 |

👍·☆·▶ 아이콘과 그라데이션은 SVG/CSS로 그린다 — 추출하지 않는다.

### 4.3 폰트

Motiva Sans(스팀 사유 폰트)는 내장하지 않는다 (Plan §2.4). 스택:
`'Segoe UI', 'Malgun Gothic', 'Yu Gothic UI', 'Microsoft JhengHei UI', 'Noto Sans', sans-serif`
— 4언어 CJK 커버, 렌더 환경(데스크톱 Chrome) 기준. 자간 차이는 허용 오차.

---

## 5. 시간축

- 구간: `[{id: 'gameplay', label: '게임플레이', durationMs: 20000}]` — 경계 없음
- 트림: TrimStrip으로 소스에서 20초 창 선택 (기존 UI 재사용)
- 정방형 리뷰 스크롤은 구간이 아니라 프레임 시각 함수 (D-3):

```ts
// domain/steamreview/scroll.ts
export const SCROLL_SPEED_PX_PER_S = 52;           // 실측 (상관 0.992)
export const reviewScrollOffsetPx = (timeMs: number, cycleHeightPx: number) =>
  ((timeMs / 1000) * SCROLL_SPEED_PX_PER_S) % cycleHeightPx;
```

---

## 6. 고정 문구 전문 (reviews.ts + 기본 카피)

### 6.1 라벨

| locale | 추천 라벨 | 시간 포맷 |
|---|---|---|
| ko | 추천 | `기록상 {h}시간` |
| en | Recommended | `{h} hrs on record` |
| ja | おすすめ | `プレイタイム{h}時間` |
| zh-TW | 推薦 | `總時數{h}小時` |

### 6.2 리뷰 4건 (hours는 언어 공통)

| # | avatarKey | hours | ko | en | ja | zh-TW |
|---|---|---|---|---|---|---|
| 1 | avatar-1 | 56.9 | 취향저격! 타워, 아이템 조합해가면서\n스테이지 공략하다 보니 하루 3시간 삭제돼요..! | What I've been looking for!\nOnce you get the hang of the different towers\nand items you'll be playing for hours straight | 超絶おすすめ！\nタワー＆アイテムを合成してステージ攻略してた… | 完全把我的菜! 用塔和角色的組合來攻下關卡,\n一天的3小時就這樣不見了..! ✱Do재확인 |
| 2 | avatar-2 | 4.8 | 도파민!! 재밌어요!!! | Pure dopamine!! 10/10!! | 脳汁ドーパミン！最強ゲー！！ | 發瘋!! 也太好玩!! |
| 3 | avatar-3 | 6.4 | 얘를 이길 디펜스 게임이 없다 | No other game comes even close | ディフェンスゲーム好きでこれ知らんとか草 | 沒有比這個更頂的遊戲了 |
| 4 | avatar-4 | 203.4 | 결국 돌고돌아 언닥임 | The game that keeps you coming back for more | 何だかんだでこれが1番だわ | 玩來玩去還是這個最頂 |

배치 서브셋은 D-7: 16:9 = [1,2,3,4], 9:16 = [2,3,4], 1:1 = [2,3,4] 순환.

### 6.3 기본 카피 (언더다크 — 목업 추출)

**타이틀**: ko `언더다크 : 디펜스`, en/ja/zh-TW `UnderDark : Defense`

**태그** (4번째 ko는 D-6 잠금):

| locale | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| ko | 전략 타워 디펜스 | 압도적 긍정적 게임 | 200만회+ 다운로드 | 확률형 아이템 포함 🔒 |
| en | Tactical Tower Defense | Overwhelmingly Positive | +2 million downloads | Play now |
| ja | 戦略タワーディフェンス | 圧倒的な神ゲー | 200万+ダウンロード | 今すぐプレイ |
| zh-TW | 策略塔防遊戲 | 無負評的超讚遊戲 | 超過200萬次下載 | 馬上玩 |

**설명** (16:9 전용, `\n` 유지):

- ko: `디펜스란, 최후의 최후까지 버티는 자가 이기는 거야.\n그 어떤 적이 오더라도 포기하지 마.\n\n최후의 캠프를 방어하라!\n전략 인디게임 <언더다크:디펜스>`
- en: `Defense is all about tenacity and making it to the end\nDon't ever give up, no matter what\n\nDefend the final camp!\nTactical indie game <UnderDark : Defense>`
- ja: `ディフェンスなるもの…\n最後まで諦めない者が勝利するのだ！\nどんな敵でもネバーギブアップ\n\n基地を守り抜け！…` ✱Do재확인(마지막 줄이 목업에서 잘림 — JP 가로 영상 사이드바에서 판독)
- zh-TW: `堅持到最後的人才是防守遊戲的贏家\n絕對不要放棄\n\n守住最後的營地!\n策略獨立遊戲<UnderDark : Defense>`

---

## 7. 레이아웃 좌표 3벌 (`domain/steamreview/layout.ts`)

캔버스는 규격별 픽셀 좌표. 값은 레퍼런스 실측(±수 px)이고, Do에서 레퍼런스 프레임
오버레이 대조로 미세 보정한다(✱Do). rect는 `{x, y, w, h}`.

### 7.1 9:16 — 1080×1920

| 요소 | rect / 스타일 |
|---|---|
| 키아트 배너 | (0, 0, 1080, 310) cover |
| 타이틀 | x=32, y=318~388, 폰트 58 bold, `title` |
| 태그 행 | y=425~470, 칩 h=45, 좌 x=32, 칩 간격 14, 좌우 패딩 18, 라운드 4, 폰트 26 |
| 영상 슬롯 | (32, 499, 1016, 571) |
| 썸네일 줄 | y=1075~1275: 3장, w=331 h=200, gap 11, x=32 시작. 1번에 흰 테두리 4px(선택 상태), 1·2번에 ▶ 오버레이(반투명 원 96px) |
| 리뷰 목록 | y=1315 시작, 카드 [2,3,4] 고정. 카드 h=210, gap 25, x=50~1030 |
| 리뷰 카드(lg) | 아바타 120² at (x+16, y+20) · 👍박스 96² at (x+196, y+20) · 추천 폰트 34 · 시간 폰트 20 `mutedText` · 본문 폰트 30, y+150 · ☆ 32² 우상단 (x+930, y+28) |

### 7.2 16:9 — 1920×1080

| 요소 | rect / 스타일 |
|---|---|
| 타이틀 | x=100, y=55~115, 폰트 56 bold |
| 태그 행 | y=140~185, 칩 h=45, 좌 x=100 |
| 영상 슬롯 | (101, 209, 1088, 612) |
| 썸네일 줄 | y=835~985: 4장, w=258 h=150, gap 18, x=100 시작. 1번 선택 테두리, 1·2번 ▶ |
| 페이지네이션 행 | y=1000~1050: ◀ 칩 (100,1000,75,50) · 스크롤바 트랙 x=180~1105 h=50 (`panel`), 썸 x=180~320 (`chipBg` 밝게) · ▶ 칩 (1115,1000,75,50) |
| 사이드바 | x=1232~1890 (w=658) |
| ├ 키아트 | (1232, 207, 658, 328) cover — 2.0:1 |
| ├ 타이틀 | y=552~608, 폰트 44 |
| ├ 설명 | y=630~725, 폰트 26, 행간 36, `bodyText` |
| └ 리뷰 | y=740 시작, 카드 [1,2,3,4]. 카드 h≈165, gap 25 |
| 리뷰 카드(sm) | 아바타 72² · 👍박스 56² · 추천 폰트 26 · 시간 폰트 16 · 본문 폰트 26 (최대 2줄, 넘치면 말줄임) · ☆ 24² |

### 7.3 1:1 — 1080×1080

| 요소 | rect / 스타일 |
|---|---|
| 타이틀 | x=32, y=40~105, 폰트 58 |
| 태그 행 | y=140~185 (9:16과 동일 칩 스타일) |
| 영상 슬롯 | (32, 206, 1016, 571) |
| 리뷰 뷰포트 | y=788~1080 (h=292), overflow 클립 |
| 리뷰 목록 | 카드(lg, 9:16과 동일 내부) h=180, gap 35 → pitch 215. [2,3,4] 2벌 이어 붙임, cycle = 3×215 = 645px. `translateY(-reviewScrollOffsetPx(t, 645))`. 카드 사이 `thumbBlue` 2px 구분선 |

### 7.4 layout.ts 형태

```ts
export type SteamReviewLayout = { keyArtBanner?: Rect; title: TextSpec; tagRow: RowSpec;
  video: Rect; thumbStrip?: ThumbSpec; pagination?: PaginationSpec; sidebar?: SidebarSpec;
  reviews: ReviewAreaSpec };
export const steamReviewLayout = (ratio: AspectRatio): SteamReviewLayout => …
```
순수 데이터 — 컴포지션과 테스트가 공유한다.

---

## 8. Compositions

- `SteamReviewComposition.tsx`: `steamReviewLayout(ratio)`로 rect를 받고 요소를 배치.
  게임플레이는 `resolveSteamReviewSource(settings, locale)`(assets.ts, `en` 폴백은
  kv-loop과 달리 **공통 source가 폴백**)로 해석.
- `GameplaySlot`: 기존 `shared/SceneVideo` 재사용 가능 여부를 Do에서 우선 확인,
  프롭 계약이 다르면 얇은 전용 래퍼(트림 오프셋 + cover transform).
- `ReviewList` variant: `static`(선두 N장) / `scrolling`(2벌 + translateY).
- 오디오: 기존 `AudioLayer` 재사용 — 원본 볼륨 + BGM (Plan FR-13). 나레이션 미배선.
- 엔드카드 없음 — 게임플레이 소스가 20초를 다 채운다 (Plan Q3).

## 9. UI

- `TemplateSelector`: 드롭다운에 `스팀리뷰` 추가. 전환 다이얼로그 문구: 기존 파괴적
  전환 경고 + "길이가 20초로 변경됩니다" (day1-quad 60→30 선례).
- `SteamReviewAssetPanel`: ① 게임플레이 영상(공통) + 언어별 교체 4슬롯(접이식,
  비어 있으면 "공통 사용" 표시) ② 키아트 1슬롯 (권장 규격 안내: 가로형 1200×628 이상)
  ③ 썸네일 4슬롯.
- `SteamReviewInspector`: 트림(TrimStrip) · 영상 프레이밍(기존 필드) · 키아트 프레이밍.
- 카피(타이틀·설명·태그)는 기존 `CopyPanel`에 steam-review 분기 추가 — 언어 탭 관례
  승계. ko 태그 4번째 칸은 잠금 표시(🔒 + disabled).
- `Timeline`: 1구간이라 경계 핸들이 없어야 한다 — N구간 일반화가 1에서 깨지는지
  Do에서 확인.

## 10. Error Handling

| 상황 | 처리 |
|---|---|
| 필수 소재 미충족 렌더 시도 | §3.6 표의 사유로 렌더/Batch 진입 차단 (Day1 정책 승계) |
| 언어별 소스가 trim 창보다 짧음 | superRefine 거부 (D-5) — 업로드 시점에 인스펙터 경고 |
| ko 태그 4 조작 시도 | 명령 거부 + UI 잠금 (D-6) |
| 저장 문서(기존 템플릿) 파싱 | optional 카피 블록·arm 추가라 무영향 — 회귀 테스트로 고정 |

## 11. Implementation Guide

### 11.1 구현 순서

공용 상수(파급 2건)가 먼저, 그 위에 도메인 → 컴포지션 → UI → 검증. 각 모듈은
독립 커밋 가능 상태로 끝낸다.

### 11.2 파일 변경 목록

**신규 (12)**: `domain/steamreview/{layout,reviews,scroll,assets}.ts` ·
`compositions/SteamReviewComposition.tsx` · `compositions/steamreview/{StoreHeader,KeyArtBanner,GameplaySlot,ThumbStrip,Sidebar,ReviewList,ReviewCard}.tsx` ·
`compositions/steamreview/assets/avatar-{1..4}.png` ·
`features/editor/{SteamReviewAssetPanel,SteamReviewInspector}.tsx` ·
`domain/editor/steamReviewCommands.ts` (+ 각 테스트 파일)

**수정 (9)**: `constants.ts` · `schema.ts` · `types.ts` · `fileName.ts` ·
`project.ts`(빌더·전환) · `projectStore.ts` · `TemplateSelector.tsx` ·
`EditorWorkspace.tsx` · `CopyPanel.tsx`

### 11.3 Session Guide

**Module Map**

| scope | 내용 | 파일 | 예상 규모 |
|---|---|---|---|
| `module-1` | 도메인 기반: §3.3 공용 상수 전부, 스키마 arm(§3.1)·카피 블록(§3.2)·superRefine, types 배럴, fileName, project.ts 빌더·전환(20초 강제), 명령(§3.5)+projectStore, 회귀 테스트(D-1 kv-loop 하한, D-2 프리셋) | constants·schema·types·fileName·project·steamReviewCommands·projectStore + 테스트 | ~450줄 |
| `module-2` | 고정 리소스·순수 로직: 아바타 4장 crop(§4.1 좌표)→assets/, reviews.ts(§6 전문), layout.ts(§7), scroll.ts(§5), assets.ts 폴백 + 유닛 테스트 | domain/steamreview/* + 이미지 4장 | ~350줄 |
| `module-3` | 컴포지션: SteamReviewComposition + 하위 7개(§8), 3규격 렌더 트리, Player 미리보기 배선 | compositions/* + EditorWorkspace 미리보기 분기 | ~600줄 |
| `module-4` | 에디터 UI: TemplateSelector 항목·전환 다이얼로그, AssetPanel, Inspector, CopyPanel 분기(ko 태그 잠금), Timeline 1구간 확인 | features/editor/* | ~500줄 |
| `module-5` | 검증·마감: 렌더 큐 필수 소재 차단(§3.6), Batch 12종 확인, E2E 렌더 스모크, 벤치마크 1회 기록, 레퍼런스 대조 캡처, ✱Do 항목 3건(JP 설명·CT 리뷰1·색 스포이드·좌표 보정) 해소 | 렌더 경로 + tests/e2e | ~200줄 |

**권장 세션 분할** (세션마다 `/clear` 후 시작, Do 스킬이 이 문서 전체를 다시 읽는다):

| 세션 | 명령 | 완료 기준 |
|---|---|---|
| 1 | `/pdca do steam-review --scope module-1,module-2` | `npm test` 전체 통과 (신규 테스트 포함) |
| 2 | `/pdca do steam-review --scope module-3` | 미리보기 3규격 정상, `npm run build` 통과 |
| 3 | `/pdca do steam-review --scope module-4` | 편집 → 저장 → 복구 라운드트립 정상 |
| 4 | `/pdca do steam-review --scope module-5` → 이어서 `/pdca analyze steam-review` | 12종 Batch 성공 + 대조 캡처 |

**세션 공통 전제**: 레퍼런스 폴더 `C:\Users\superplanet-market\Desktop\reference`가
제자리에 있어야 한다 (module-2 아바타 crop, module-5 대조·✱Do 판독).

## 12. Test Plan

### 12.1 Unit (Vitest)

- `layout.ts`: 3규격 rect 스냅샷 — 영상 슬롯 3벌이 실측값과 일치
- `scroll.ts`: t=0 → 0, 순환(645px 주기), fps 무관 결정론
- `reviews.ts`: 4언어 × 4건 완전성, 라벨 포맷
- `assets.ts`: localeSources → source 폴백
- 스키마: arm 왕복 파싱, 기본값, ko 태그 4 강제(D-6), 구간 1 고정, preset 20 강제,
  언어별 소스 trim 검증(D-5)
- 명령: ko 태그 잠금 거부, 썸네일 인덱스 범위, trim 창 20초 불변
- 회귀: `durationPresetsForTemplate` 기존 3종 무변경, `DURATION_PRESETS` 튜플 [15,30,60] 그대로,
  kv-loop 슬롯 하한 2(D-1), 기존 4템플릿 픽스처 JSON 무변경 파싱

### 12.2 E2E (Playwright)

- 픽스처 영상·이미지로 steam-review 프로젝트 구성 → ko × 3규격 렌더 → ffprobe로
  20.0s·해상도·h264/aac 검증 (기존 E2E 관례)

## 13. Out of Scope

Plan §8 그대로. 추가: 스크롤바·화살표의 실제 동작(장식으로만 렌더 — 레퍼런스도 정지 장식).

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-08-28 | 초안 — 실측 좌표·고정 문구 전문·D-1~D-7 확정, C안 채택 | 김성권 / Claude |
