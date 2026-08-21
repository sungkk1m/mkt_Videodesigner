# key-visual-looping — Plan·Design 핸드오프

> **작성**: 2026-08-21 · 김성권 / Claude
> **상태**: Plan ✅ · Design ✅ · **Do 미착수**
> **다음 작업**: `/pdca do key-visual-looping --scope module-1`
> **기준 커밋**: `origin/main` (`4f643dc feat(day1): open a panel lossless…`)

이 문서는 다른 디바이스에서 이어받기 위한 인수인계 노트다. 결정 사항과 설계는
Plan·Design에 있고, 여기에는 **그 문서에 없는 것**만 적는다 — 실측 베이스라인,
환경 확인 결과, 착수 직전 상태.

---

## 1. 무엇이 끝났나

| 단계 | 산출물 | 상태 |
|------|--------|:----:|
| Plan | [`docs/01-plan/features/key-visual-looping.plan.md`](../01-plan/features/key-visual-looping.plan.md) | ✅ 사용자 확정 결정 9건 (L1~L9) |
| Design | [`docs/02-design/features/key-visual-looping.design.md`](../02-design/features/key-visual-looping.design.md) | ✅ Option C 선택, 설계 결정 7건 (D-01~D-07) |
| Do | — | ⬜ **Checkpoint 4에서 사용자가 "문서만 올려달라"로 보류** |

레퍼런스 영상 6본은 `C:\Users\superplanet-market\Desktop\mkt_looping reference\`
(약 350MB, 저장소에 넣지 않음). 실측값은 Plan §1.2 표에 옮겨 놓았으므로 영상
없이도 설계를 따라갈 수 있다.

---

## 2. 실측 베이스라인 (`origin/main` 기준)

착수 전에 반드시 같은 값을 재현할 것. module-1은 **회귀 없음이 곧 완료**이므로
이 숫자가 판정 기준이다.

```bash
npm test        # 36 files / 415 tests passed, 실패 0     (2026-08-21 18:30 실측)
npm run build   # tsc -b (3 configs) + vite build 통과, 261 modules
```

| 항목 | 값 | 비고 |
|------|-----|------|
| 유닛 | **415** | Plan·Design 초안에 272로 적혀 있던 것을 실측값으로 정정함 |
| E2E | **54** (17 spec 파일) | 초안의 27도 정정함. 아래 §3 참고 |
| 옵트인 E2E | 2건 | `DAY1_LONGFORM`, `RENDER_FPS_OUTPUT` 환경변수 게이트 |

---

## 3. 환경 확인 결과 — E2E는 돌 가능성이 있다

`docs/03-analysis/day1-video.analysis.md` §e2e에 "브라우저가 막힌다"고 기록돼
있어 재확인했다. **그 기록은 Chromium 다운로드 차단 건이고, 현재 설정에는
해당하지 않는다.**

| 확인 | 결과 |
|------|------|
| `playwright.config.ts` | `channel: 'chrome'` — 시스템 Chrome을 쓴다 (다운로드 불필요) |
| 시스템 Chrome | ✅ `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| `ms-playwright` 캐시 | 없음 — 그러나 `channel: 'chrome'`이므로 무관 |
| E2E 미디어 픽스처 | ❌ 미생성. `npm run generate:editor-fixture` 필요 (gitignored) |

**아직 실제로 돌려보지는 않았다.** 54건에 실제 MP4 렌더가 포함돼 시간이 걸리고,
Checkpoint 4에서 보류됐기 때문이다. 다른 디바이스에서는 Chrome 경로가 다를 수
있으니 먼저 확인할 것.

---

## 4. main에서 발견한 설계 영향 사항

Plan·Design 작성은 `7673100`(당시 로컬 브랜치, main보다 2 커밋 뒤)에서 코드를
읽고 했다. `origin/main`으로 옮기며 재확인한 결과, **설계 전제는 모두 유지되지만
한 가지 유리한 변화가 있었다.**

| 확인 항목 | main에서 |
|-----------|----------|
| `sectionsSchema` 3튜플 | ✅ 유지 (`schema.ts:214`) |
| `SECTION_COUNT = 3` 참조 0건 | ✅ 유지 (`constants.ts:12`) |
| `BoundaryIndex = 0 \| 1` | ✅ 유지 (`timeline.ts:12`) |
| `SceneDurationsMs` 3튜플 | ✅ 유지 (`timeline.ts:11`) |
| `Timeline.tsx`가 제네릭 | ✅ 유지 (`sections.map` 331, `boundaries.map` 363, 캐스트 364) |
| **`mediaTransformSchema.fit`** | ⚠️ **`z.literal('cover')` → `z.enum(MEDIA_FITS)` = `['cover','contain']`** |

마지막 항목이 유리한 변화다. day1-video의 "패널을 lossless로 열기" 작업이
`fit`을 넓혀 놨고, Design §3.2의 `kvSlotSchema.transform`이 이 스키마를
재사용하므로 **`contain`을 공짜로 상속받는다.** 비세로 KV 대응(FR-L19)이 단순
경고에서 "전체 보존 + 블러 배경" 토글이라는 실제 선택지로 승격됐고, Plan FR-L19와
Design §6.2를 그에 맞게 고쳐 두었다.

`main`의 2 커밋이 `schema.ts`·`project.ts`·`types.ts`를 건드렸으므로,
**module-1은 반드시 `origin/main` 최신 위에서 시작할 것.**

---

## 5. module-1 착수 요약

목표: **시간축을 3튜플에서 가변 배열(2~8)로 넓힌다. 신규 기능 0.**

신규 파일 0 · 수정 6 · 예상 ~90줄.

| 파일 | 변경 |
|------|------|
| `src/domain/editor/constants.ts` | `SECTION_COUNT` 삭제, `MIN/MAX_SECTION_COUNT` 추가 |
| `src/domain/editor/schema.ts` | `sectionsSchema` 튜플→배열, `SECTION_IDS_BY_TEMPLATE`→`expectedSectionIds()`, superRefine 길이 검사 |
| `src/domain/timeline/timeline.ts` | `SceneDurationsMs`→`readonly number[]`, `BoundaryIndex`→`number`, 6개 함수 일반화 |
| `src/domain/day1/playback.ts` | 타입 추종 |
| `src/features/editor/Timeline.tsx` | `index as BoundaryIndex` 캐스트 제거 (타입만) |
| `src/domain/editor/project.ts` | `buildSections`의 `as Sections` 캐스트 정리 (타입만) |

상세는 Design §3.1 · §4.4 · §11.3 module-1 행.

### 반드시 지킬 두 가지

1. **`allocateSceneFrames`의 "마지막이 잔여 흡수" 규칙을 바꾸지 말 것** (D-03).
   누적 반올림은 module-2의 `kvloop/cycle.ts`에만 적용한다. 기존 규칙을 건드리면
   기존 두 템플릿의 렌더 산출물이 1프레임 달라져 SC8 회귀 판정이 흐려진다.
2. **3구간 입력에 대해 `moveBoundary`가 변경 전과 동일한 값을 낼 것.**
   이것을 회귀 테스트로 고정하는 것이 module-1의 종료 조건이다.

### 종료 조건

```bash
npm test        # 415건 전부 통과 (+ 신규 회귀 테스트)
npm run build
```

E2E는 module-5로 묶는다.

---

## 6. 이어받는 절차

```bash
git fetch origin
git checkout claude/key-visual-looping-plan   # 이 문서가 있는 브랜치
git rebase origin/main                        # 최신 main 위로
npm install
npm test && npm run build                     # §2 베이스라인 재현 확인
```

그 다음 Claude Code에서:

```
/pdca do key-visual-looping --scope module-1
```

Design §11.4 Do Entry Checklist를 먼저 통과시킬 것.

---

## 7. 남은 미해결 사항 (Plan·Design에 기록됨)

| # | 내용 | 위치 |
|---|------|------|
| 1 | 레퍼런스 총 길이 16초·19초는 프리셋(15/30/60)에 없어 정확 재현 불가 | Plan L2 |
| 2 | 15초·30fps·4회는 사이클 112.5프레임 — 누적 반올림으로 흡수, SC3에서 ±1프레임 허용 | Design D-03 |
| 3 | 성능 스파이크를 Plan §4.3의 "Design 착수 전"에서 module-3 종료 게이트로 옮김 | Design D-07 |
| 4 | Option B(투영 계층)는 네 번째 템플릿이 또 구간 수를 벗어날 때 별도 사이클 | Design §10 |
