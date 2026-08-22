# Module 1 Evidence — Variable Length Time Axis

> **Feature**: `key-visual-looping`
> **Scope key**: `module-1`
> **PDCA phase**: Do
> **Date**: 2026-08-22
> **Status**: Implemented and verified — unit 424/424, build pass
> **Base commit**: `4f643dc` (`origin/main`) + `12a4ad5` (plan·design docs)

Design Ref: §3.1 Sections · §4.4 timeline.ts 일반화 · §11.3 Session Guide module-1.
This module ships **no new feature**, so no regression is the whole of done.

---

## 1. Baseline Reproduced

Handoff §2 asked for the same numbers before touching anything.

| 항목 | 핸드오프 기록 | 이 세션 실측 | |
|------|:-------------:|:------------:|:-:|
| 유닛 | 415 (36 files) | **415 (36 files)** | ✅ |
| 빌드 | pass | **pass** (261 modules) | ✅ |

---

## 2. What Changed

신규 파일 0. 6개 소스 파일 + 5개 테스트 파일.

| 파일 | 변경 |
|------|------|
| `domain/editor/constants.ts` | `SECTION_COUNT` 삭제(참조 0건 확인), `MIN_SECTION_COUNT = 2` · `MAX_SECTION_COUNT = 8` 추가 |
| `domain/editor/schema.ts` | `sectionsSchema` 튜플 → `z.array().min(2).max(8)`, `SECTION_IDS_BY_TEMPLATE` → `expectedSectionIds()`, `superRefine`에 구간 수 검사 추가 |
| `domain/timeline/timeline.ts` | `SceneDurationsMs` → `readonly number[]`, `BoundaryIndex` → `number`, 6개 함수 가변 길이 일반화 |
| `domain/editor/project.ts` | 불필요해진 `as Sections` 캐스트 3개 제거 (타입만) |
| `features/editor/Timeline.tsx` | `index as BoundaryIndex` 캐스트 제거 (타입만) |
| `features/editor/EditorWorkspace.tsx` | Day1 경계 읽기 `sections[0]`/`[1]`을 null-safe로 (타입만) |

`day1/playback.ts`는 손대지 않았다 — 3튜플 리터럴이 `readonly number[]`에 그대로 대입되므로
타입 추종이 필요하지 않았다.

### 구간 수를 무엇이 지키는가

튜플 스키마가 보장했던 "정확히 3개"가 사라졌으므로, 그 자리를 `superRefine`이 받는다.
길이를 **먼저** 검사하고 일치할 때만 id를 검사한다. 기존 두 템플릿의 입력 공간은
넓어지지 않는다 (Plan §5 1순위 위험 대응).

```
A three-scene project must have exactly 3 sections, received 2.
```

---

## 3. 회귀 없음의 증명 — 골든 대조

"3구간에서 변경 전과 동일한 값"이 module-1의 종료 조건이므로(Design §4.4), 리팩터링
**전** 구현으로 격자를 한 번 돌려 JSON으로 떠 놓고, 리팩터링 **후** 같은 격자를 다시 떠서
바이트 단위로 비교했다.

| 대상 | 케이스 수 | 격자 |
|------|:---------:|------|
| `moveBoundary` | **368** | 8개 duration 조합 × 경계 0·1 × 23개 위치 (음수·클램프 양단·소수점 2500.7 포함) |
| `allocateSceneFrames` | **16** | 같은 8개 조합 × 30·60fps (비정수 조합 `[2333, 9334, 3333]` 포함) |
| `sceneStartsMs`·`boundaryPositionsMs`·`sumDurationsMs` | 8 | 같은 8개 조합 |

**결과: 세 번 모두 완전 동일** (리팩터링 직후, 그리고 §5의 경계 가드를 넣은 뒤 재확인).

`allocateSceneFrames`는 D-03에 따라 **기존 "마지막 구간이 잔여 흡수" 규칙을 의도적으로
유지**한다. 누적 반올림은 module-2의 `kvloop/cycle.ts`에만 들어간다.

이 격자는 일회용 검증이고, 커밋된 회귀 테스트는 그중 대표값을 리터럴로 고정한 것이다
(`timeline.test.ts` — "moves a boundary to the same millisecond the three-tuple did",
"allocates the same frames the three-tuple did").

---

## 4. Tests

415 → **424** (+9). 기존 415건은 값 하나도 바꾸지 않았다.

| 테스트 | 검사 |
|--------|------|
| 3구간 `moveBoundary` 8케이스 | 클램프 양단·소수점 포함, 튜플 구현과 동일한 밀리초 |
| 3구간 `allocateSceneFrames` 6케이스 | 비정수·최소값 케이스 포함, 동일한 프레임 |
| 3구간 starts·boundaries | `[0, 2000, 12000]` · `[2000, 12000]` |
| 경계 개수 | n구간 → n-1개 (2·4구간) |
| 총 길이 불변식 | 2·4·8구간 × 모든 경계 × 5개 위치에서 총합 유지 + 각 구간 ≥ 1초 |
| 인접 2구간만 이동 | 4구간에서 나머지 2개가 그대로 |
| 프레임 총합 | 2·4·8구간 × 30·60fps에서 `preset × fps` 정확히 일치 |
| 범위 밖 경계 | 마지막 쌍을 넘는 인덱스는 무변경 (§5) |
| 스키마 구간 수 | 총 길이는 맞고 개수만 2개인 three-scene 프로젝트 거부 |

마지막 스키마 테스트는 가드를 껐을 때 실제로 실패하는지 확인했다 (18 passed / 1 failed →
가드 복원 후 19 passed). 총 길이를 프리셋에 맞춰 두었기 때문에 개수 검사만이 유일한 위반이다.

---

## 5. Design에서 벗어난 지점

| # | 설계 | 구현 | 이유 |
|---|------|------|------|
| 1 | `expectedSectionIds(settings, sectionCount)` | `expectedSectionIds(template)` | module-1에는 `kv-loop` arm이 없어 `sectionCount`가 쓰이지 않는다. 죽은 파라미터를 미리 두지 않고, 장수에서 id를 만드는 arm이 생기는 module-2에서 넓힌다 |
| 2 | (없음) | `moveBoundary`에 범위 밖 경계 가드 | `BoundaryIndex`가 `0 \| 1`에서 `number`로 넓어져 "마지막 쌍을 넘는 인덱스"가 타입상 가능해졌다. 가드가 없으면 NaN duration이 프로젝트에 들어가 조용히 저장이 깨진다. 무변경 반환 + 테스트 1건 |
| 3 | (없음) | 테스트 5개 파일의 인덱스 접근 수정 | `noUncheckedIndexedAccess` 때문에 튜플이 배열이 되면서 `sections[0].durationMs`가 컴파일되지 않는다. 값을 바꾸지 않는 타입 수정만 했다 (`?.`, 코드베이스 관례인 `as` 캐스트, 합계는 `reduce`) |

---

## 6. E2E — 이 환경에서는 실행 불가

핸드오프 §5는 E2E를 module-5로 묶었고, 실제로 이 세션(원격 컨테이너)에서는 돌 수 없다.

| 필요 | 상태 |
|------|------|
| `channel: 'chrome'` (playwright.config.ts) | ❌ 시스템 Chrome 없음 (번들 Chromium만 존재) |
| `npm run generate:editor-fixture` | ❌ H.264/AAC 인코더가 있는 `ffmpeg` 없음 |

따라서 SC8의 E2E 절반은 **미검증**이다. 유닛 424건과 골든 대조가 이 모듈에서 확보한
회귀 방어선이고, E2E 54건 전량 통과는 시스템 Chrome이 있는 디바이스에서 module-5에
확인해야 한다.

---

## 7. 다음

`/pdca do key-visual-looping --scope module-2` — `kv-loop` 스키마 arm, `cyclesOf`,
`kvloop/cycle.ts`(누적 반올림), `kvloop/assets.ts`(en 폴백). module-2에서 함께 처리할 것:

- `expectedSectionIds`를 `(settings, sectionCount)`로 넓히고 `kv-${i}` arm 추가 (§5-1)
- `superRefine` 총 길이 검사에 `cyclesOf()` 적용 (D-01)
- `MAX_SECTION_COUNT`를 `slots`·`images` 상한으로 재사용 (§3.2)
