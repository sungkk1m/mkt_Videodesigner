# Module 2 Evidence — kv-loop Schema and Domain

> **Feature**: `key-visual-looping`
> **Scope key**: `module-2`
> **PDCA phase**: Do
> **Date**: 2026-08-22
> **Status**: Implemented and verified — unit 470/470, build pass
> **Base**: module-1 (`d9b3fff`)

Design Ref: §3.2 Template Settings · §3.3 Copy · §3.4 Invariants · §4.1 cycle.ts
· §4.2 assets.ts · §4.3 guards · §11.3 Session Guide module-2.

---

## 1. Scope Delivered

| Design Ref | Item | 결과 |
|-----------|------|------|
| §3.2 | `kvSlotSchema` · `kvLoopSettingsSchema`, 판별 유니온 3번째 arm | Done |
| §3.3 | `copy.kvLoopDisclaimer` optional 추가 | Done |
| §3.4 D-01 | `cyclesOf()` + 사이클 인지 총 길이 불변식 | Done |
| §3.4 D-02 | `slots.length === sections.length` 검사 | Done |
| §3.4 D-06 | `refineKvLoop`에서 9:16 강제 (`selectedRatios`·`selectedRatio`) | Done |
| §3.1 | `expectedSectionIds(settings, sectionCount)` — `kv-${i}` arm | Done |
| §4.1 | `kvloop/cycle.ts` — `cycleTotalMs`·`kvLoopCycleDurations`·`kvLoopSegments` | Done |
| §4.2 D-05 | `kvloop/assets.ts` — `resolveKvSet`·`resolveKvTitle`, 셋 단위 `en` 폴백 | Done |
| §4.3 | `kvLoopCombination`(FR-L07)·`kvLoopMissingImages`(FR-L13) | Done |
| §11.3 | `constants.ts` 상한·기본값, `types.ts` 렌더 프롭, `project.ts` 명령·`buildKvLoopProps` | Done |
| — | `projectFile.ts` 루핑 arm (가져오기 시 참조를 missing으로) | Done (설계에 없던 필수 작업, §4) |

**마이그레이션 없음**을 유지했다. `schemaVersion`은 2, `migrate.ts`는 손대지 않았다.

---

## 2. 설계 결정이 코드에서 어디에 있는가

| 결정 | 위치 |
|------|------|
| D-01 사이클 인지 불변식 | `schema.ts` `superRefine` — `cyclesOf(settings)`가 다른 두 템플릿에서 1이므로 그들의 검사는 문자 그대로 동일하고, 메시지도 `cycles === 1`에서 기존 문장을 그대로 낸다 |
| D-02 장수의 단일 출처 | `kvLoopSettingsSchema.slots` 길이 검사 + `buildKvLoopSections`가 `kvLoopCycleDurations`의 길이로 두 배열을 함께 만든다 |
| D-03 누적 반올림 | `kvLoopSegments`만. `allocateSceneFrames`는 손대지 않았다 (module-1 회귀선 유지) |
| D-04 slots/images 분리 | 스키마에서 분리, `buildKvLoopProps`가 렌더 시점에만 합친다 |
| D-05 셋 단위 폴백 | `resolveKvSet` — 자기 셋에 1장이라도 있으면 자기 셋. 슬롯 단위 혼합 경로가 코드에 없다 |
| D-06 9:16 강제 | `refineKvLoop` + `switchTemplate`의 진입 보정. `renderSettingsSchema`는 안 좁혔다 |
| Plan L5 (오버레이 부재 정상) | `resolveKvTitle`이 null을 정상 반환하고, `kvLoopMissingImages`가 오버레이를 세지 않는다 |

---

## 3. Tests

424 → **470** (+46). 기존 424건은 값 하나도 바꾸지 않았다.

### `cycle.test.ts` (14)

| 검사 | 범위 |
|------|------|
| 균등 분할 + 잔여 1ms씩 앞쪽 배분 | 15초·7장 = `[2143×6, 2142]`, 합 15,000 |
| 사이클 합 = `preset/loopCount` | 프리셋 3 × 반복 4 × 장수 7 = **84 조합 전수** |
| 프레임 총합 = `preset × fps` | 위 84 × fps 2 = **168 조합 전수** |
| **SC3** 대응 구간 차이 ≤ 1프레임 | 같은 168 조합 전수, 장수별로 각각 |
| **D-03** 비정수 사이클 | 15초·30fps·4회·3장(사이클 112.5프레임) → 전 구간이 37 또는 38, 합 450 |
| 구간 사이 빈틈 없음 | `fromFrame`이 직전 구간의 끝과 일치 |
| **FR-L07/SC7** | 15초·8장·2회 차단 + 메시지에 `0.94초`·`30초로 올리`·`반복을 1회로 줄이` 포함 |
| 대안이 실제로 성립하는 값 | 30초·8장·4회 → "반복을 **3**회로" (한 단계 줄이는 것으로는 부족한 경우) |
| 가드가 최소 1초와 일치 | 84 조합 전수에서 `perKvMs >= MIN_SCENE_MS`와 판정 일치 |

### `assets.test.ts` (12)

폴백 행렬 4가지(자기 셋 / en 상속 / 둘 다 없음 / en 자기 자신), **D-05 부분 채움은 en에서 끌어오지 않음**, 요청 개수에 맞춘 크기 조정(초과·부족 양쪽), 타이틀 폴백과 부재, `kvLoopMissingImages`의 SC5(오버레이 0개여도 0) · FR-L13(1장이면 1) · 상속 셋 계산 · 타 템플릿 0.

### `kvLoopCommands.test.ts` (19) · `projectFile.test.ts` (+1)

`switchTemplate` 진입(구간 id·홀드·loopCount·9:16 강제·공통 필드 보존), 3템플릿 왕복 + 각 단계 `parseProject` 통과, `applyDurationPreset` 15→30 재분배, 스키마 거부 4종(slots 불일치 · 규격 2개 · `selectedRatio` · 구간 id), 반쯤 채운 셋 허용, 오버레이 0개 허용, `buildKvLoopProps`(구간 8개·총 450프레임·슬롯 URL·SC5 빈 오버레이·고지문구 전달·크로스페이드 클램프 12/28프레임·타 템플릿 null), 루핑 프로젝트 JSON 왕복.

D-01의 사이클 불변식은 **모든 루핑 픽스처가 통과하려면 반드시 필요한** 검사다(사이클 7.5초 × 2회 = 15초). 곱셈을 빼면 19건 전부 실패한다.

---

## 4. Design에서 벗어난 지점

| # | 설계 | 구현 | 이유 |
|---|------|------|------|
| 1 | module-2가 `buildEditorSnapshot`에 `kv-loop` arm 추가 (§11.3, §8.1) | **module-3으로 이동** | `EditorSnapshot`에 arm을 넣으면 `renderEditor.ts`의 분기가 컴파일되지 않고, 그 arm은 가리킬 컴포지션(`KvLoopComposition`)이 있어야 성립한다. §2.1의 "arm 2개"는 원래 한 쌍이므로 컴포지션과 함께 module-3에서 넣는다. `buildKvLoopProps`는 이번에 완성·테스트했다 |
| 2 | `kvLoopCombination(...): Result<void>` (§4.3) | 그대로. 코드는 기존 `PROJECT_INVALID` 재사용 | §7의 "새 `AppErrorCode`를 만들지 않는다"를 지켰다. `action.target`은 `settings` |
| 3 | (설계에 없음) `projectFile.ts` 루핑 arm | 추가 | `markSourceUnresolved`가 판별 유니온을 3방향으로 다루지 않으면 컴파일되지 않는다. KV 이미지는 이 템플릿의 재생 필수 소재이므로 Day1 패널과 같은 규칙(가져오기 시 `missing`)을 적용하고, **타이틀 PNG도 함께 missing으로** 표시했다 — 해결되지 않을 참조를 available로 두면 그 발견이 렌더 시점으로 밀린다 |
| 4 | (설계 문구) 스키마 메시지 한국어 | 스키마 issue 메시지는 영어 | 이 파일의 기존 메시지 전부가 영어이고, 사용자에게는 `parseProject`가 한국어 `PROJECT_INVALID`로 감싸 전달한다. NFR-L05의 "사용자 메시지 한국어"는 §7 경로(가드 메시지)에서 지켰다 — `kvLoopCombination`은 한국어다 |
| 5 | (설계 문구) `xfadeFrames`를 컴포지션에서 클램프 (§5.1) | `buildKvLoopProps`에서 **전역 최솟값**으로 클램프 | 도메인에서 계산해야 단위 테스트가 가능하다. 인접 쌍별 클램프와의 차이는 구간 길이가 ±1프레임이므로 최대 반 프레임이고, 전역 최솟값이 항상 더 안전한 쪽이다 |

### 알려진 열린 지점 (module-4가 닫는다)

`applyDurationPreset`·`setKvLoopCount`류 명령은 `kvLoopCombination`을 **스스로 호출하지 않는다.** Plan L8이 "조용히 보정하지 말고 이유를 밝혀 차단"하라고 정했으므로, 60초 프로젝트를 15초로 내리는 식으로 조합이 깨지는 것을 막는 책임은 UI에 있다(§6.2 비활성 + 이유 표시). `switchTemplate`이 확인 다이얼로그를 caller에 맡기는 것과 같은 계약이다. module-4에서 프리셋 버튼과 반복 선택기 양쪽에 가드를 붙일 것.

---

## 5. 이 시점의 UI 상태 — 주의

`TEMPLATE_KINDS`에 `kv-loop`가 들어가면서 `TEMPLATE_LABELS`/`TEMPLATE_LOSS`가
`Record<TemplateKind, string>`이라 라벨을 함께 넣어야 컴파일된다. 그래서 **헤더 템플릿
선택기에 "키비주얼 루핑" 버튼이 이미 보인다.** 지금 그것을 고르면 프로젝트는 정상적으로
루핑으로 바뀌지만(스키마 통과, 9:16 강제), 컴포지션이 없어 미리보기·렌더가 3장면 빈
스냅샷으로 떨어지고 인스펙터·자산 패널도 없다.

module-3·4가 이어서 들어가기 전까지 이 브랜치를 사용자에게 배포하지 말 것.

---

## 6. 다음

`/pdca do key-visual-looping --scope module-3` — `KvLoopComposition.tsx`,
`kvloop/KvScene.tsx`·`TitleOverlay.tsx`·`DisclaimerBar.tsx`, `renderEditor.ts` arm,
그리고 **여기서 미룬 `buildEditorSnapshot` arm**. 종료 게이트는 D-07의 성능 실측
(`npm run benchmark:render`, NFR-L01·L02)이며, 실제 MP4 1회 수동 확인이 필요하므로
브라우저가 있는 디바이스가 필요하다.
