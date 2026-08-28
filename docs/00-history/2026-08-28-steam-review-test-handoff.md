# steam-review 검증 인수인계 (2026-08-28)

새 세션에서 이 파일을 읽고 아래 "붙여넣을 프롬프트"부터 시작한다.

---

## 붙여넣을 프롬프트

```
docs/00-history/2026-08-28-steam-review-test-handoff.md 를 읽고,
§2 검증 체크리스트를 순서대로 실행해서 steam-review 템플릿 구현을 독립 검증해줘.

전제:
- 구현은 로컬 main의 최근 5커밋(1f94ef2 · eab4e2a · 6b274b3 · 119f397 · 48704db)에 있다.
- 아직 origin/main에 푸시하지 않았고, 로컬 main은 origin/main보다 15커밋 뒤처져 있다.
  그 15커밋은 failure 템플릿이며 같은 공용 파일을 건드린다 — §3 참조.
- 병합·푸시·브랜치 이동은 절대 하지 말고, 검증만 한 뒤 결과를 보고해줘.

각 항목은 "통과/실패 + 근거(명령 출력 또는 file:line)"로 답하고,
내가 이전 세션에서 주장한 수치(테스트 683, Match Rate 95%, Batch 12종 20.01s,
렌더 2.7배)를 그대로 믿지 말고 직접 재측정해서 대조해줘.
```

---

## 1. 무엇이 만들어졌나

스팀 상점 페이지 목업 UA 영상 템플릿. `template` 판별자에 `steam-review` arm 1개를
추가해 기존 파이프라인(4언어 카피 · 3규격 렌더 · Batch · 자동 저장)을 승계했다.
20초 고정, 4언어 × 3규격 = 12개 MP4가 산출물.

| 문서 | 경로 |
|---|---|
| Plan | `docs/01-plan/features/steam-review.plan.md` |
| Design | `docs/02-design/features/steam-review.design.md` |
| Analysis (Check 결과) | `docs/03-analysis/steam-review.analysis.md` |
| 레퍼런스 대조 캡처 | `docs/03-analysis/assets/steam-review/compare-{16x9,9x16,1x1}-5s.png` |

| 커밋 | 범위 |
|---|---|
| `1f94ef2` | M1+M2 — 상수 · 스키마 arm · 명령 · projectStore / domain/steamreview 4모듈 · 아바타 4장 |
| `eab4e2a` | M3 — 컴포지션 8종 · 렌더 계약 · Player 배선 |
| `6b274b3` | M4 — 애셋 패널 · 인스펙터 · CopyPanel 분기 · 전환 안내 |
| `119f397` | M5 — §3.6 렌더 차단 · E2E · ✱Do 문구/색/좌표 실측 보정 |
| `48704db` | Check — 분석 문서 · 12종 Batch 실증 · 단일 렌더 게이트 |

**신규 파일**: `src/domain/steamreview/{layout,reviews,scroll,assets}.ts` ·
`src/domain/editor/steamReviewCommands.ts` · `src/compositions/SteamReviewComposition.tsx` +
`src/compositions/steamreview/*` (7 컴포넌트 + 아바타 4장) ·
`src/features/editor/{SteamReviewAssetPanel,SteamReviewInspector}.tsx` ·
`src/features/editor/useSteamReviewAssets.ts` · `tests/e2e/steam-review.spec.ts`

**공용 계층 변경(회귀 위험 지점)**: `MIN_SECTION_COUNT` 2→1 + `KV_MIN_SLOTS=2` 신설(D-1) ·
`DURATION_PRESETS` 튜플은 **건드리지 않고** `durationPresetSchema`에 `z.literal(20)` 추가(D-2)

---

## 2. 검증 체크리스트

### 2.1 정적 검증

```bash
npm ci
npx tsc -b
npm test
npm run build
```

기대: 타입체크 무출력 · 유닛 683 passed / 48 files · 빌드 성공.
**직접 세어서 이전 주장(683)과 대조할 것.**

### 2.2 회귀 (기존 4템플릿이 안 깨졌는가)

```bash
npx playwright test tests/e2e/timeline-axis.spec.ts tests/e2e/persistence-recovery.spec.ts
```

추가로 코드에서 직접 확인:
- `src/domain/editor/constants.ts` — `DURATION_PRESETS`가 `[15, 30, 60]` 그대로인가
- `durationPresetsForTemplate('three-scene'|'day1'|'kv-loop')` → `[15,30,60]`, `'day1-quad'` → `[15,30]`
- kv-loop 슬롯 하한이 여전히 2인가 (`KV_MIN_SLOTS` 소비처 4곳: schema · project setKvCount · KvLoopAssetPanel · 테스트)

### 2.3 E2E 스모크

```bash
npx playwright test tests/e2e/steam-review.spec.ts
```

2건 통과 기대. 두 번째 테스트는 ko × 3규격 실렌더(약 1.5분) 후
ffprobe로 20.0s · 해상도 · h264+aac를 검증한다.

### 2.4 실기기 편집 흐름

```bash
npm run dev
```

브라우저에서:
1. 템플릿 드롭다운 → `스팀리뷰` 선택 → 전환 다이얼로그에 **"20초로 바뀝니다"** 안내가 뜨는가
2. 확인 후: 길이 프리셋 버튼이 **20초 하나만** 노출되는가 / 타임라인에 경계 핸들이 **없는가**
3. 소재 탭: 게임플레이 영상(`tests/fixtures/steam-gameplay-22s.mp4`) · 키아트
   (`tests/fixtures/steam-keyart.png`) · 썸네일 4장(`tests/fixtures/kv-{1..4}.png`) 업로드
4. 규격 9:16 / 1:1 / 16:9 전환 — 미리보기가 각각 배너·스크롤·사이드바 레이아웃으로 바뀌는가
5. 1:1에서 재생 → 리뷰 목록이 **위로 등속 스크롤**하고 이음새 없이 순환하는가
6. 카피 탭 → 한국어 4번째 태그가 `확률형 아이템 포함`으로 **잠겨(disabled) 있는가**,
   영어 탭에서는 편집 가능한가
7. 소재를 비운 상태에서 16:9 선택 → 렌더 버튼이 막히고 **키아트/썸네일 블로커 칩**이 뜨는가
8. 편집 후 **F5 새로고침** → 템플릿·카피·트림이 복구되고, 영상은 "다시 올려주세요 +
   기대 파일명" 안내가 뜨는가. 같은 파일 재업로드 시 트림이 보존된 채 차단이 풀리는가

### 2.5 레퍼런스 대조

`C:\Users\superplanet-market\Desktop\reference` 의 `[KR]251110_언더다크_스팀_{가로,세로,정방}.mp4`
와 `docs/03-analysis/assets/steam-review/compare-*.png` 를 대조.
소재는 픽스처(단색)라 다르고 **셸 구조만** 대조 대상:
요소 배치 · 리뷰 서브셋(16:9=4건, 9:16/1:1=3건) · 썸네일 개수(4/3/0) · 스크롤 위상.

### 2.6 Batch 12종 (선택 — 약 5.3분)

Batch 대화상자에서 4언어 × 3규격 전체 선택 후 실행.
12개 파일 전부 20.01s · 규격별 해상도 · h264+aac · 파일명
`{prefix}_steamreview_{locale}_{ratio}_20s_30fps.mp4` 인지 ffprobe로 확인.

---

## 3. 통합 상태 — 병합 전 반드시 읽을 것

로컬 `main`이 `origin/main`보다 **15커밋 뒤처져** 있고, 그 15커밋은 **`failure` 템플릿**이다.
양쪽이 같은 공용 파일에 각자 5번째 템플릿을 추가했으므로 병합 시 전부 충돌한다.

**겹치는 파일 15개**: `.gitignore` · `domain/editor/{constants,project,projectFile,schema,types}.ts` ·
`domain/render/fileName{,.test}.ts` · `features/editor/{EditorWorkspace,TemplateSelector,projectStore}.tsx/ts` ·
`features/editor/useRenderQueue{,.test}.ts` · `infrastructure/render/renderEditor.ts` ·
`test/fixtures/project.ts`

**병합 원칙**: 아래는 전부 `Record<TemplateKind, …>` 또는 판별 유니온이라
**양쪽 arm이 모두 남아야 컴파일된다.**

| 대상 | 필요한 최종 상태 |
|---|---|
| `TEMPLATE_KINDS` | `[…, 'kv-loop', 'failure', 'steam-review']` |
| `templateSettingsSchema` | failure arm + steamReview arm 둘 다 |
| `EditorSnapshot` | 두 arm 모두 |
| `TEMPLATE_FILE_SEGMENT` / `TEMPLATE_LABELS` / `TEMPLATE_LOSS` | 두 엔트리 모두 |
| `switchTemplate` / `buildEditorSnapshot` / `markSourceUnresolved` / `preflightIssues` / `createEditorRenderRequest` | 두 분기 모두 |

병합 후 반드시 `npx tsc -b && npm test && npm run build` 재실행.

**정리 옵션**(사용자 결정 필요, 아직 실행 안 됨):
로컬 main의 5커밋을 feature 브랜치로 옮기고 main을 origin/main에 맞추는 방법 —
```
git branch feat/steam-review          # 현재 5커밋을 브랜치로 보존
git reset --hard origin/main          # main을 원격 상태로 되돌림
git checkout feat/steam-review        # 이후 이 브랜치에서 rebase/merge 진행
```

---

## 4. 알려진 미해결 항목

| # | 항목 | 상태 |
|---|---|---|
| 1 | **NFR 성능 미달** | three-scene 대비 렌더 시간 **2.7배**(목표 1.5배). 절대치는 실시간 1.0배(20초 영상 → 20.1초). Plan NFR 수치를 실측 기준으로 재조정할지, 최적화 사이클을 별도로 뗄지 **사용자 결정 필요** |
| 2 | `steamReviewMissingAssets` 도메인 유닛 테스트 없음 | preflight 테스트가 간접 커버. Minor |
| 3 | `TemplateSelector`가 20초를 상수 대신 리터럴로 사용 | Minor |
| 4 | 태그 개수 4 · ko 잠금 인덱스 3 매직넘버 3중복 | `STEAM_REVIEW_TAG_COUNT` 신설 권고. Minor |
| 5 | 인스펙터가 키아트 규격 정책(`ratio !== '1:1'`)을 재구현 | `RATIOS_NEEDING_KEY_ART` export 공유 권고. Minor |

**설계 문서와 구현이 다른 지점(의도된 편차)**: 색 토큰 11종·리뷰 카드 구조·1:1 전용 `md`
카드·칩 치수는 module-5에서 레퍼런스 영상 프레임 실측으로 보정했다. Design 문서의
§4.2/§7 표는 초안 추정치이며 **갱신되지 않았다** — 코드가 최신 기준.
상세는 `docs/03-analysis/steam-review.analysis.md` §3 참조.

---

## 5. 다음 단계 후보

1. §3 통합 정리 (브랜치 이동 → failure 템플릿과 병합 → 전체 테스트)
2. NFR 성능 결정 (항목 1)
3. `/pdca report steam-review` — 완료 보고서
