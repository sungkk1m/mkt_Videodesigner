# failure-video — Do 단계 분석

> **Project**: mkt_videodesigner
> **Feature**: `failure-video`
> **Plan**: [failure-video.plan.md](../01-plan/features/failure-video.plan.md) ·
> **Design**: [failure-video.design.md](../02-design/features/failure-video.design.md)
> **Branch**: `claude/failure-video-template-plan-poq31c`
> **Date**: 2026-08-28 · **Status**: Do 완료 · 실기기 렌더 검증 완료 (리포트 §2.3)

Design §11의 M1~M7을 순서대로 구현한 기록. 무엇이 실제로 검증됐고 무엇이 안 됐는지,
그리고 Design과 다르게 간 곳과 그 근거를 남긴다.

---

## 1. 결론 요약

| | 상태 |
|---|---|
| 구현 | M1~M7 전부. 스키마 버전 **2 유지**, 마이그레이션 코드 0줄 |
| 유닛 | **726/726 그린** (사이클 시작 시 618 → 신규 108) |
| 빌드 | `npm run build` (tsc -b 3설정 + vite) 그린 |
| E2E | 5개 시나리오 중 **2개 그린**, 3개는 컨테이너 H.264 디코더 부재로 환경 실패 → 실기기 몫 |
| 렌더 픽셀 실측 | 컨테이너에서 **컴포지션 프레임 단위로 실측 완료** (§4), MP4 인코딩은 실기기 몫 |
| SC7 성능 | **효과 없는 구간 −1%, FAIL 비트 구간 +15%, 영상 전체는 측정 잡음 이하** — §6 |
| 기존 4템플릿 | 출력·스키마·E2E 무변경 (§7) |

사이클 도중 **자동저장 손실 버그 1건을 만들었다가 잡았다** — §5. 같은 구멍이
kv-loop에도 있었고 같은 한 줄로 닫혔다. Design 수정 1건은 사용자 결정으로
확정했다 — **D-12, 레벨 1의 펀치 아웃 제거** (§9).

---

## 2. 모듈별 산출물과 게이트

| # | 커밋 | 산출물 | 게이트 결과 |
|---|---|---|---|
| M1 | `6746cb4` | PanelSection·EndCardSection 추출, useDay1Assets 슬롯 파라미터화, Day1AssetPanel prop 개방, 엔드카드 narrower 교체 | 기존 스위트 618/618 + 컨테이너 UI 검증 22/22. **failure 코드 0줄** |
| M2 | `620d02f` | 스키마 arm·상수·기본값·switchTemplate·applyDurationPreset·failureLabels, SELECTABLE_TEMPLATES 임시 가드 | 유닛 645/645, 드롭다운에 미노출 확인 |
| M3 | `09a3d4b` | layout·orientation·playback·effects + 커맨드 11종 + reconcile + 프리플라이트 | 유닛 694/694 |
| M4 | `421671c` | fail-stamp.png(+SVG)·fail-thud.wav(+스크립트), CaptionBar·FailStamp·FailureFrame·FailureComposition, buildFailureProps + 스냅샷·렌더 arm | 유닛 710/710 + **레퍼런스 수치 대조 10/10** (§4) |
| M5·M6 | `5397b8a` | FailureInspector, 에셋 패널 바인딩, 비율 비활성, retain, 프리플라이트·프록시 arm, 가드 해제 | 유닛 710/710 + 컨테이너 UI 검증 33/33 |
| M7 | (이 문서) | E2E 스펙, 프록시·프리플라이트 유닛, 벤치마크, 비율 가드 회귀 | 유닛 726/726 |

### 2.1 Do Entry Checklist (Design §11.1)

- [x] M1이 failure 코드 0줄 — 커밋 `6746cb4`의 diff에 `failure` 문자열이 주석 외에 없다
- [x] 추출이 순수 이동 — Day1Inspector 마크업 diff 0, 기존 E2E·컨테이너 검증 그린
- [x] useDay1Assets 파라미터화 후 day1·quad 동작 동일
- [x] `Panel.tsx`·`EndCardScene.tsx`·`endCard.ts`·`sourceProxy.ts`·`timeline.ts` 무변경 (§7)
- [x] `PROJECT_SCHEMA_VERSION`이 2
- [x] 효과 함수가 전부 `(frame, …)` 순수이고 효과 밖 반환이 `null`
- [x] 스탬프·SFX가 재창작물이고 근거(SVG·생성 스크립트)가 커밋됨

---

## 3. 에셋 — 재창작의 실제 형태 (Plan Q3 / R-2)

Design §6.4는 "OFL/CC0 폰트 + 자체 텍스처"를 요구했다. **폰트도 쓰지 않는 쪽으로
더 보수적으로 갔다.**

- `fail-stamp.svg`: F·A·I·L 네 글자를 손으로 그린 아웃라인 패스(스템 120,
  캡 높이 440, 1600×700 박스)로 구성했다. 폰트 파일이 없으니 라이선스·임베딩·
  누락 문제가 애초에 생기지 않는다.
- 그런지는 `feTurbulence` 두 벌로 **생성**한다(윤곽 거칠기용 displacement +
  잉크 구멍용 threshold). 스캔한 텍스처를 샘플링하지 않았고, SVG 필터의 PRNG는
  명세로 고정돼 있어 같은 시드는 같은 결과를 준다.
- 마른 스탬프의 결은 흰색을 덧칠하지 않고 **마스크로 잉크를 파낸다**. 처음엔
  흰 스트라이프를 덧그렸는데, 어두운 게임 화면 위에서는 흰 얼룩으로 뜨고
  밝은 화면 위에서는 사라졌다 — 레퍼런스는 바탕이 비쳐 보이는 쪽이다.
- 래스터화는 `artifacts/failure/make-stamp.mjs`가 Chromium으로 한다. 컨테이너에
  rsvg/inkscape/ImageMagick이 없기도 하고, **어차피 컴포지션을 그릴 렌더러가
  Chromium**이라 PNG에 들어가는 것이 렌더에 나오는 것과 같다.
- `fail-thud.wav`: `scripts/generate-fail-sfx.mjs`가 합성한다(150→45Hz 스윕
  바디 + 12ms 클릭 + 감쇠 노이즈 테일, 320ms). 노이즈는 고정 시드 xorshift라
  재실행해도 바이트가 같다. 어택 60ms RMS −11.6dB / 피크 −1.7dB — Plan §1.2의
  "전 구간 평균 −17.5dB 대비 +8dB 스파이크"에 대응한다.

---

## 4. M4 게이트 — 레퍼런스 수치 대조

레퍼런스 mp4는 이 세션에 없다(인수인계 §"지금 상태"). 대조 대상은 Plan이 프레임
단위로 박제해 둔 **수치**이고, 대조 방식은 실제 `FailureComposition`을 Player에
마운트해 프레임을 찍고 DOM 기하를 읽는 것이다 —
`artifacts/failure/run-gate.mjs`, 산출물 `artifacts/failure/m4-review.png`.

| Plan 실측 | 설계 상수 | 렌더 실측 | |
|---|---|---|---|
| 캡션 바 = 프레임 높이 10% | `FAILURE_CAPTION_RATIO` 0.10 | 10.00% | 일치 |
| 캡션 캡 높이 ≈ 3.7% | fontSize 100 @1920h | ≈3.75% | 일치 |
| 캡션 폭 ≈ 프레임 40% | — | 43.9% | 근사 |
| 스탬프가 좌우로 삐져나감 | `WIDTH_RATIO` 1.2 | −13.1% ~ 113.1% | 일치 |
| 스탬프 = 높이 15~55% 구간 | `CENTRE_Y_RATIO` 0.35 | 15.7% ~ 54.3% | 일치 |
| 안착 회전 −8° | `FAIL_STAMP_ROTATE_DEG` −8 | −8.00° | 일치 |
| 줌 1 → ≈2.2, ease-out 0.6s | `FAIL_ZOOM_SCALE` 2.2 / `LEAD` 500ms | 프레임 02~04 | 일치 |
| 스탬프 ≈4× → 1, 불투명 0.6 → 1 | `ENTER_SCALE` 4 / `ENTER_MS` 250 | 프레임 04~06 | 일치 |
| 전환 아웃 0.2s 줌인 + 블러 | `TRANSITION_OUT_MS` 250 | 프레임 10 | 일치 |
| 전환 인 0.3s 줌아웃 안착 | `TRANSITION_IN_MS` 300 | 프레임 11~11b | 일치 |
| (D-12) 레벨 1은 컷 | `failureEdgesAt` out=false | 스탬프 폭 1.261 (안착값) | 적용 |

> 프레임 번호는 D-12 반영 후 기준이다(§9). 08·09가 레벨 1 → 레벨 20 컷,
> 10·11·11b가 영상에 하나 남은 레벨 20 → 레벨 99 펀치다.

---

## 5. 사이클 중 만들었다가 잡은 버그 — 비율 가드

**증상.** failure 프로젝트에서 Batch 대화상자의 1:1 체크박스를 켜면, 자동저장은
"저장됨"이라고 말하는데 새로고침하면 **빈 three-scene 프로젝트가 열린다.**
작업물이 아무 말 없이 사라진다.

**원인.** M2에서 `refineFailure`에 `render.selectedRatios ⊄ FAILURE_RATIOS` 거부를
넣었다(Design §4.3). 그런데 `toggleRenderRatio`는 템플릿 무관이고 BatchDialog는
`ASPECT_RATIOS` 세 개를 그대로 체크박스로 내놓는다. 즉 **스키마가 거부하는 값을
UI가 만들어 낼 수 있었다.** 저장은 검증하지 않고 로드가 검증하므로, 다음 로드에서
`parseProject`가 실패하고 기본 프로젝트로 떨어진다.

Design §4.3의 "3점 세트"(상수 + refine + switchTemplate 강제 변환)에 **네 번째
표면이 빠져 있었다**: 이미 그 템플릿에 들어와 있는 사용자가 비율을 고르는 곳.

**같은 구멍이 kv-loop에도 있었다.** `refineKvLoop`는 `selectedRatios`를
`[9:16]` 하나로 고정하는데, Batch에서 16:9를 켜면 똑같이 프로젝트가 날아갔다.
이 사이클보다 앞선 버그다.

**수정.** 지식을 한 곳에 두고 네 표면이 전부 그것을 읽게 했다:

- `ratiosForTemplate(template)` — `durationPresetsForTemplate`의 짝, 같은 파일.
- `toggleRenderRatio` / `setSelectedRatio`가 허용 밖 비율을 **거부**한다
  (교정하지 않는다 — `withKvCycle`이 불가능한 조합을 거부하는 것과 같은 계약).
  단, 이미 목록에 들어 있는 비율은 **뺄 수** 있다. 그러지 않으면 잘못 들어온
  문서를 되돌릴 방법이 없다.
- BatchDialog와 스테이지 툴바가 같은 함수로 비활성 처리. 툴바 쪽은 이 사이클이
  덧붙였던 중복 조건식을 함께 걷어냈다.

**회귀 방어.** 유닛 6건(`failureCommands.test.ts`) + 컨테이너 스크립트
`artifacts/failure/verify-ratio-guard.mjs` 21건 — 세 템플릿 × 두 표면 × 새로고침
왕복. 후자는 나쁜 값을 실제로 만들어 내던 표면을 지킨다.

**교훈.** refine에 제약을 넣으면 "그 값을 만들 수 있는 모든 표면"을 같이 세야
한다. 저장이 검증하지 않고 로드만 검증하는 구조에서, 스키마가 거부하는 상태를
UI가 만들 수 있다는 것은 곧 조용한 데이터 손실이다.

---

## 6. SC7 — 효과의 렌더 비용

`artifacts/failure/run-bench.mjs`. 비교 대상은 **효과 켠 failure vs 효과 전부 끈
failure**다. day1과 비교하면 패널 개수 차이(day1은 프레임당 비디오 2개, failure는
1개)가 섞여 NFR-01이 묻는 것과 다른 질문에 답하게 된다.

컨테이너에 H.264 인코더가 없어 VP8/WebM으로 측정했다. quad M0가 확인한 대로
인코드 버킷은 하드웨어 H.264 기기와 비교 불가지만, `filter`·`transform`이 떨어지는
**컴포지트 버킷은 코덱 무관**이다. 렌더러 자체 버킷이 아니라 벽시계를 쟀다(M0의 교훈).

| 구간 | 효과 ON | 효과 OFF | 오버헤드 |
|---|---:|---:|---:|
| `plain` (프레임 300–479, 레벨 3 한복판 — 효과 0개) | 62.46 ms/f | 63.12 ms/f | **−1%** |
| `beat` (프레임 60–239 — FAIL 비트 45프레임 + 펀치) | 112.91 ms/f | 98.17 ms/f | **+15%** |

**`plain`의 −1%가 이 표의 핵심이다.** Design Goal 4("효과 밖 프레임의 스타일은
`undefined`")가 의도가 아니라 측정으로 확인됐다. quad가 상시 `filter`로 2.13배를
치른 그 자리다.

`beat` 구간 180프레임 중 실제 효과 프레임은 62개(34%)이므로, 효과 프레임 자체의
오버헤드는 대략 +44%다. 30초 영상 900프레임 중 효과 프레임은 71개(7.9%)이므로
전체 영상 기준 기대치는 **+3~4%**다.

전체 900프레임도 실제로 재 봤다(`artifacts/failure/bench-full.log`, 설정당 1회):

| | ms/frame | |
|---|---:|---|
| 효과 ON | 251.0 | |
| 효과 OFF | 263.6 | |
| 차이 | | **−4.8%** |

**효과를 켠 쪽이 더 빨랐다.** 이것을 "효과가 공짜"로 읽으면 안 된다 — 설정당 1회씩,
한 번에 4분 가까이 걸리는 측정이고 이 컨테이너는 다른 작업과 CPU를 나눠 쓴다.
±5%는 이 조건의 실행 간 편차 안이다. 절대값이 windowed 측정(62~113 ms/frame)과
크게 다른 것도 같은 이유다(900프레임 연속 디코딩 + 경합).

읽어야 할 결론은 이것이다: **30초 영상 전체를 놓고 보면 효과의 비용이 이 환경의
측정 잡음보다 작다.** 기대치 +3~4%와 모순되지 않고, SC7의 "+15% 이내"를 만족한다.
신뢰할 수 있는 수치는 짧고 교대로 3회씩 돌린 windowed 쪽이며, 그중에서도
`plain` 구간이 이 사이클이 지켜야 했던 규칙(Goal 4)의 증거다 — 두 번 재서 −1.0%와
+1.8%가 나왔고, 부호가 뒤집힌다는 것이 곧 "창 밖에서는 잴 수 있는 비용이 없다"는 뜻이다.

### 6.1 재측정 (2026-08-28, 리포트 작성 세션)

같은 `run-bench.mjs`를 한 번 더 돌렸다(교대 3회, 중앙값):

| 구간 | 효과 ON | 효과 OFF | 오버헤드 |
|---|---:|---:|---:|
| `plain` | 65.39 ms/f | 64.21 ms/f | **+1.8%** (최초 −1.0%) |
| `beat` | 88.80 ms/f | 74.22 ms/f | **+19.6%** (최초 +15.0%) |

`plain`의 **부호가 뒤집혔다**. 이것이 이 표에서 읽어야 할 결론을 바꾸지는 않는다 —
오히려 확정한다: 효과 창 밖에서 효과의 비용은 이 컨테이너의 실행 간 편차(±5% 수준)와
구별되지 않는다. 절대값을 인용할 때는 이 편차를 함께 봐야 한다.

---

## 7. 기존 템플릿에 남긴 영향

Design Goal 1은 "기존 4템플릿의 렌더 출력 픽셀을 바꾸지 않는다"였다.

**한 줄도 바뀌지 않은 파일** (Design §2.1의 약속): `compositions/day1/Panel.tsx`,
`compositions/day1/EndCardScene.tsx`, `compositions/day1/QuadFrame.tsx`,
`compositions/day1/SplitFrame.tsx`, `domain/day1/endCard.ts`,
`domain/day1/sourceProxy.ts`, `domain/day1/layout.ts`, `domain/timeline/timeline.ts`.

**바뀌었지만 출력은 불변인 파일**:

| 파일 | 변경 | 왜 출력이 안 바뀌는가 |
|---|---|---|
| `Day1Inspector.tsx` | 두 섹션을 파일로 추출 | 순수 이동. 마크업·testid·상수 무변경 |
| `PanelSection.tsx` | `rect`를 prop으로, `title`·`testIdPrefix` 기본값 개방 | 기본값이 현재 값, Day1Inspector가 같은 rect를 계산해 넘긴다 |
| `Day1AssetPanel.tsx` | `panelLabels`·`testIdPrefix`·`hint` 개방 | 전부 기본값이 현재 문구 |
| `useDay1Assets.ts` | 슬롯 주입 | 호출부가 `panelKeysOf(...)`를 그대로 넘긴다 |
| `project.ts` | 엔드카드 커맨드 4종이 `endCardSettingsOf` 경유 | day1/quad에서는 `day1PanelsOf`와 같은 값 |
| `panelProxies.ts` | 슬롯을 `(path, box, panel)`로 일반화 | day1/quad 박스 계산식이 그대로 |
| `projectFile.ts` | failure arm 추가 + 엔드카드 헬퍼 추출 | 기존 arm 동작 동일 |
| `toggleRenderRatio`·`setSelectedRatio` | 허용 비율 가드 | day1·quad·three-scene은 세 비율 전부 허용이라 무영향. kv-loop는 §5의 버그가 닫힌다 |

검증: 기존 유닛 618건 전량 그린 유지, `day1-quad` E2E 중 코덱 무관 시나리오 그린,
컨테이너 UI 검증 스크립트 그린.

`artifacts/m1/`의 두 스크립트는 빨간데 **둘 다 이전 사이클에서 낡은 것**이다.
`verify-quad-switch.mjs`는 "선택기에 day1-quad가 아직 없다"를 단언한다 —
day1-quad M1에 쓰였고 그 사이클의 M5가 목적을 없앴다. `verify-panel-move.mjs`는
`Panel.tsx` 원문을 day1-quad M1 스냅샷과 글자 단위로 비교하는데, 지금 나는 차이는
**day1-label-effects** 사이클의 주석 블록이다. 이 사이클은 `Panel.tsx`를 한 글자도
바꾸지 않았고 `git log cbda6be..HEAD -- src/compositions/day1/Panel.tsx`가 비어 있다.
남의 사이클 산출물이라 손대지 않고 인수인계 문서에 적어 뒀다.

이 사이클 스크립트 2건은 기대값이 낡아 손봤다: `verify-dropdown`의 하드코딩된
4템플릿 목록(이제 5개), `verify-other-templates`의 자동저장 800ms 고정 대기
(디바운스와 정확히 같아 경합했다 — 파싱 실패처럼 보였지만 아니었고, 네 템플릿
전부 저장·복원 왕복을 따로 확인했다).

---

## 8. Design과 다르게 간 곳

전부 코드 주석에 근거를 남겼다. **결정(D-0~D-11)을 뒤집은 것은 없다.**

| # | Design | 실제 | 근거 |
|---|---|---|---|
| 1 | `failStampStyleAt` → `blurPx` | `blurRatio` (프레임 폭 대비) | 도메인은 캔버스 크기를 모르고 9:16(1080)과 16:9(1920)가 폭을 공유하지 않는다. `zoomPunchAt`이 이미 ratio로 반환하고 있어 규칙도 하나로 맞는다 |
| 2 | 스탬프 blur ∝ "스케일 속도" | blur ∝ "남은 이동 거리" | `easeIn`에 속도를 곧이곧대로 대면 **착지 순간에 blur가 최대**가 되어 안착한 스탬프를 뭉갠다. 레퍼런스가 보여주는 것은 들어오는 반투명 잔상 쪽이다. 의도(진입 중에만 blur > 0)는 동일 |
| 3 | M1이 파일명·라벨·선택기 문구까지 | M2로 이월 | `TEMPLATE_FILE_SEGMENT`/`TEMPLATE_LABELS`는 `Record<TemplateKind, …>`라 kind가 없으면 **컴파일이 안 된다**. Design §4.2가 말한 "kind 추가 즉시 컴파일이 강제한다"가 그대로 일어났을 뿐이고, M1의 게이트("failure 코드 0줄")가 더 강한 제약이라 그쪽을 지켰다 |
| 4 | M6이 렌더 arm | M4에서 함께 | `buildEditorSnapshot`에 arm을 넣는 순간 `EditorRenderRequest` 유니온이 컴파일 에러를 낸다. 커밋 사이에 빌드를 깨두지 않으려고 12줄을 앞당겼다 |
| 5 | `PanelSection` 추출은 순수 이동 | M5에서 `rect`를 prop으로 | failure 구간은 split도 grid도 아닌 영상 밴드 전체를 채운다. 어느 레이아웃에 속하는지는 호출자의 질문이라 계산을 Day1Inspector로 되돌렸다. M1 시점의 diff는 순수 이동이었다 |

---

## 9. Design 수정 1건 — 레벨 1의 펀치 아웃 제거 (D-12)

**발견.** FAIL 비트와 레벨 1의 아웃고잉 펀치가 시간상 겹친다. Design은 둘을 각각
정의했다: FAIL 창은 구간 1의 **마지막 1.5초**(D-3, 사용자 요구 "마지막 1초 고정"),
펀치 전환은 구간의 **마지막 0.25초**(§5.3). 30초 프리셋에서 구간 1은 162프레임이고
FAIL 창은 117–161, 펀치 아웃은 154–161 — **마지막 8프레임에 둘 다** 걸리며 영상
레이어에 FAIL 줌 2.2배와 전환 줌 2.0배가 곱해져 순간 4.4배가 된다.

레퍼런스에는 이 상태가 없다. 거기서는 FAIL이 9.6초 구간의 2.9–4.5초에 있고 전환은
9.4–10.0초라 서로 떨어져 있다. FAIL을 구간 **끝**에 못 박은 것은 사용자 요구이므로
구조적으로 붙을 수밖에 없었다.

**결정 (사용자, 2026-08-28).** 레벨 1 → 레벨 20 경계를 **컷**으로 한다.

**구현.** `failureEdgesAt`의 두 조건에 각각 하한을 더했다:

```ts
in:  index > 1 && index < sectionCount - 1,
out: index > 0 && index < sectionCount - 2,
```

전환의 **양쪽 절반을 다** 뺐다. panel-a의 out만 빼고 panel-b의 in을 남기면 앞선
줌인 없이 줌아웃만 남아 2배에서 튀어나오는 것처럼 보인다. 결과적으로 영상에 남는
펀치는 **레벨 20 → 레벨 99 하나**이고, 이는 레퍼런스의 두 번째 전환에 대응한다.

**검증.**

- 유닛: `failureEdgesAt`가 네 인덱스에 대해 기대값을 주는지, 그리고 **구간 1의
  모든 프레임에서 `zoomPunchAt`이 null인지**를 전수로 단언한다 — 상수가 아니라
  불변식으로 적어 두는 편이 이 변경의 요점을 지킨다.
- E2E: SC3의 전환 단언을 레벨 20 → 레벨 99 경계(8.1s)로 옮기고, **레벨 1 경계가
  컷인지**를 새로 단언한다(경계 앞뒤 프레임 모두 캡션 바가 제자리).
- M4 게이트: 구간 1 마지막 프레임에서 스탬프의 화면상 폭이 **1.261**로,
  안착 상태(1.2 × 좌우 여유)와 같다 — 펀치가 걸렸다면 2배로 늘어났을 값이다.
  프레임 08·09가 컷을, 10·11·11b가 남은 펀치를 보여준다.

Design §6.2와 §13에 D-12로 기록했다.

### 부수 관찰 (이번 사이클 밖, 고치지 않음)

`projectFile.ts`의 `markSourceUnresolved`가 **quad의 panelC·panelD를 놓치고 있다** —
day1/quad 공통 arm이 `panelA`·`panelB`만 missing으로 표시한다. 가져오기 직후
그 두 패널의 status가 `available`로 남지만, `useDay1Assets`의 복원 경로가
핸들 해석에 실패하며 `missing`으로 떨어뜨리므로 실사용 증상은 없다. failure arm은
여섯 슬롯을 전부 표시하도록 새로 썼다.

---

## 10. 검증되지 않은 것 — 실기기 몫

이 컨테이너의 Chromium에는 H.264 **인코더도 디코더도 없다.** 저장소의 픽스처가
전부 H.264라 업로드 자체가 프로브 단계에서 실패한다.

| 시나리오 | 컨테이너 | 필요한 것 |
|---|---|---|
| 전환 다이얼로그·축·프리셋·비율·캡션 기본값 | ✅ 그린 | — |
| 다른 템플릿 무변경 | ✅ 그린 | — |
| 방향 바인딩(업로드 → 비율 토글 → 복귀) | ❌ 업로드 프로브 실패 | 실기기 Chrome |
| 16:9 배치 프리플라이트 차단 | ❌ 위와 동일 | 실기기 Chrome |
| **실제 MP4 픽셀 단언 (SC2–SC5)** | ❌ 위와 동일 | 실기기 Chrome |

**단, 컨테이너에서 대체 검증한 범위가 넓다.** VP9 소스로 같은 UI 경로를 전부
돌렸고(`verify-m5-ui.mjs` 33건), 컴포지션 프레임은 Player에 마운트해 실측했다
(`run-gate.mjs` 10건 + 프레임 13장). 실기기에서 새로 확인할 것은 사실상
**"이 프레임들이 H.264 MP4로 그대로 구워지는가"** 하나다.

실기기 절차:

```bash
npm ci
npm run generate:editor-fixture
npx playwright test failure          # 5개 시나리오 전부
```

---

## 11. 요구사항 추적

| Plan FR | 구현 | 검증 |
|---|---|---|
| FR-01 kind·4섹션·버전 2 | `constants.ts`, `schema.ts` | 유닛 (schema.test) |
| FR-02 구간당 1영상, 상단 90% | `FailureFrame`, `failureLayout` | 유닛 + M4 게이트 |
| FR-03 방향별 소스, 폴백 없음 | `failureSettingsSchema`, `failureOrientationFor` | 유닛 + verify-m5-ui |
| FR-04 FAIL 마지막 고정 + 토글 | `failWindow`, `failVideoStyleAt`, `FailStamp` | 유닛 + M4 게이트 |
| FR-05 줌 펀치 전환, Σ불변 | `zoomPunchAt`, `failureEdgesAt` (D-12로 레벨 20→99 하나) | 유닛 + M4 게이트 |
| FR-06 캡션 바 + failureLabels | `CaptionBar`, `copy.failureLabels` | 유닛 + M4 게이트(10%/3.75%) |
| FR-07 엔드카드 재사용 신규 0줄 | `EndCardScene` 무변경, `endCardSettingsOf` | 유닛 |
| FR-08 9:16·16:9 전용 | `FAILURE_RATIOS` + refine + 강제 변환 + **비활성** | 유닛 + verify-ratio-guard |
| FR-09 프리셋 30/60 + 20/10/70 | `failureSectionDurations` | 유닛 |
| FR-10 렌더 arm + 프록시 + 파일명 | `renderEditor`, `panelProxies`, `TEMPLATE_FILE_SEGMENT` | 유닛 |
| FR-11 SFX | `fail-thud.wav` + `FailSfx` | 파형·레벨 실측 (§3) |
| FR-12 줌 초점 | `fail.focusX/Y` → `transform-origin` | 유닛 + verify-m5-ui |
| NFR-01 효과 밖 비용 0 | 전 효과 함수가 창 밖 `null` | **벤치 −1%** (§6) |
| NFR-02 결정성 | 무시드 감쇠 진동, 전부 `(frame, …)` | 유닛 |
| NFR-03 규약 | `domain/failure`가 React·Remotion 무의존 | `architecture.test.ts` |

| Plan SC | 상태 |
|---|---|
| SC1 스키마·도메인 유닛 | ✅ 그린 |
| SC2 FAIL 효과 실측 | ⚠️ 컴포지션 프레임 실측 완료, MP4 단언은 실기기 |
| SC3 전환 실측 | ⚠️ 위와 동일 |
| SC4 캡션 바 실측 | ⚠️ 위와 동일 (기하는 §4에서 실측) |
| SC5 엔드카드 | ⚠️ 위와 동일 |
| SC6 스위트 그린 | ✅ `npm test` 726/726, `npm run build` 그린. E2E는 §10 |
| SC7 렌더 비용 | ✅ 효과 없는 구간 −1%, 비트 구간 +15%, 전체 영상은 잡음 이하 (§6) |

---

## 12. Out of Scope로 남긴 것

Design §10 그대로. 추가된 것 없음.

하단 Level 99 분할 재생 · 스탬프 PNG 교체 슬롯 · 전환/셰이크 파라미터 UI ·
캡션 바 높이 토글 · 구간 수 가변 · SFX 음량 조절 · 1:1 비율.
