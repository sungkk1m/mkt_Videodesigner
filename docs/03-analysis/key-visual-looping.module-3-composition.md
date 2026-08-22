# Module 3 Evidence — Looping Composition and Render Branch

> **Feature**: `key-visual-looping`
> **Scope key**: `module-3`
> **PDCA phase**: Do
> **Date**: 2026-08-22
> **Status**: Code complete, unit 473/473, build pass — **성능 게이트(D-07)와 수동 MP4 1회는 브라우저 있는 디바이스에 남김**
> **Base**: module-2 (`1bfd19b`)

Design Ref: §5.1 KvLoopComposition · §5.2 KvScene · §5.3 오버레이 · §2.1 렌더 분기.

---

## 1. Scope Delivered

| Design Ref | Item | 결과 |
|-----------|------|------|
| §5.1 | `KvLoopComposition.tsx` — 구간 시퀀스, 크로스페이드, 오버레이, `FadeOut`, `AudioLayer` | Done |
| §5.2 | `kvloop/KvScene.tsx` — `Img` + Ken Burns + 페이드인 + `contain` 블러 배경 | Done |
| §5.3 | `kvloop/TitleOverlay.tsx`·`DisclaimerBar.tsx` — 부재 시 `null` | Done |
| §2.1 | `renderEditor.ts` 3번째 arm (`kv-loop-editor` → `KvLoopComposition`) | Done |
| §2.1 | **module-2에서 미룬** `EditorSnapshot`·`buildEditorSnapshot` arm | Done |
| §2.3 / D-07 | 성능 실측 (`npm run benchmark:render`) | **미실행 — §4** |

**신규 의존성 0건.** `Img`·`Sequence`·`interpolate`·`useVideoConfig` 모두 설치된 `remotion`에 있다.

---

## 2. 구현이 설계와 다른 점

| # | 설계 | 구현 | 이유 |
|---|------|------|------|
| 1 | `xfadeFrames`를 컴포지션에서 클램프 | module-2의 `buildKvLoopProps`가 이미 계산해 넘긴다 | 도메인에서 계산해야 테스트가 된다 (module-2 §4-5에 기록) |
| 2 | `KvScene`이 `objectFit: 'cover'` 고정 (§5.2 코드 스케치) | `slot.fit`을 그대로 따른다 | 스키마가 `fit`을 저장하고 FR-L19가 `contain`을 요구한다. 고정하면 스키마가 렌더가 무시하는 값을 갖게 된다 |
| 3 | (설계에 없음) 타이틀 기본 `fit`을 `contain`으로 | `DEFAULT_KV_LOOP_SETTINGS.title.transform.fit = 'contain'` | 오버레이는 여백을 가진 아트워크다. 로고를 잘라내는 것은 어떤 경우에도 의도가 아니다 |
| 4 | (설계에 없음) KV 2장 미만이면 플레이스홀더 | `KvLoopComposition`이 "키비주얼 이미지를 2장 이상 올려주세요" | `Day1Composition`이 패널 부재에서 하는 것과 같은 자리·같은 형태이고, FR-L13 프리플라이트와 같은 임계값이다 |

`contain` 블러 배경은 `SplitFrame`의 day1-video 구현을 정지 이미지에 맞춰 옮겼다 —
`Freeze`가 필요 없고(정지 이미지는 진행하지 않는다), 블러 반경은 패널 폭 대신
프레임 폭에 비례한다.

---

## 3. Tests

470 → **473** (+3). 컴포지션 자체는 이 저장소에 컴포넌트 테스트 관례가 없어(`.test.tsx` 0건)
렌더 경로의 배선만 테스트했다.

| 테스트 | 검사 |
|--------|------|
| `renderEditor.test.ts` | 루핑 스냅샷이 `kv-loop-editor` / `KvLoopComposition`으로 라우팅되고 `defaultProps === inputProps` |
| `renderEditor.test.ts` | **인코딩 설정이 3템플릿에서 동일** (기존 2템플릿 비교에 루핑을 추가) |
| `kvLoopCommands.test.ts` | `buildEditorSnapshot`이 루핑을 `template: 'kv-loop'`로 태그하고 구간 8개를 싣는다 (SC1의 코드 상 위치) |
| `kvLoopCommands.test.ts` | 타이틀 오버레이가 `contain`으로 열린다 |

---

## 4. 남긴 게이트 — D-07 성능 실측과 수동 MP4

Design §11.3의 module-3 종료 조건은 두 가지이고, **둘 다 이 환경에서 불가능하다.**

| 필요 | 상태 |
|------|------|
| 루핑 MP4 수동 1회 | ❌ 브라우저 렌더 경로. 게다가 KV 업로드 UI가 module-4에 있어 **module-4 이후에야 도달 가능** |
| `npm run benchmark:render` (NFR-L01·L02) | ❌ 같은 이유 (원격 컨테이너에 시스템 Chrome 없음) |

즉 module-3의 게이트는 순서상 module-4와 함께 확인해야 한다. 실측 시 확인할 것:

1. **NFR-L01** — 15초·9:16·Standard 루핑 렌더 시간이 동일 조건 3장면 기준선 이하.
   이미지 디코드가 비디오보다 싸므로 초과하면 구현 문제의 신호다. 초과 시 §2.3의 분기:
   Ken Burns의 `transform: scale()`이 매 프레임 리샘플을 유발하는지, 전환 구간에서
   이미지 2장이 동시 합성되는 비용인지 먼저 특정한다.
2. **NFR-L02** — KV 8장 × 4언어 = 32장을 올린 상태의 편집기 메모리. 초과 시 FR-L18
   다운스케일 캐시를 module-3 범위로 끌어온다.
3. 산출물을 레퍼런스 2본과 나란히 두고 Ken Burns 강도(기본 0.5)와 크로스페이드
   기본값(400ms)을 확정한다.

---

## 5. 다음

`/pdca do key-visual-looping --scope module-4` — `KvLoopAssetPanel`,
`KvLoopInspector`, 템플릿 선택기 안내, `Timeline` 반복 표시, 고지문구 입력,
`EditorWorkspace` 탭·규격 게이팅 **및 Player 분기**(§6.5). Player 분기가 들어가야
편집기 미리보기가 루핑을 보여준다 — module-3까지는 렌더 경로만 배선돼 있다.
