# Module 5 Evidence — E2E and Integration

> **Feature**: `key-visual-looping`
> **Scope key**: `module-5`
> **PDCA phase**: Do
> **Date**: 2026-08-22
> **Status**: **작성 완료 · 실행 미검증.** 이 환경에서는 Playwright를 돌릴 수 없다
> **Base**: module-4 (`aacd3ae`)

Design Ref: §8.2 E2E 표 · §4.1 Definition of Done (SC1~SC9).

---

## 1. 정직한 상태 표시부터

**이 스펙은 한 번도 실행되지 않았다.** 원격 컨테이너에 시스템 Chrome이 없고
(`playwright.config.ts`가 `channel: 'chrome'`), H.264 픽스처를 만들 `ffmpeg`도 없다.
확인할 수 있었던 것은 여기까지다.

| 확인 | 결과 |
|------|------|
| `npx tsc -b` (스펙 포함 타입체크) | ✅ 통과 |
| `npx playwright test --list tests/e2e/kv-loop.spec.ts` | ✅ 8건 발견 (파싱·구조 정상) |
| 실제 실행 | ❌ 불가 |

따라서 **SC1~SC9의 판정은 사용자 디바이스에서의 실행에 달려 있다.** 첫 실행에서
선택자나 타이밍 문제로 실패할 수 있고, 그 수정은 정상적인 다음 단계다 — 실패를
설계 결함으로 읽지 말 것.

---

## 2. 무엇을 어떻게 검증하는가

`tests/e2e/kv-loop.spec.ts`, 8건. 렌더 없는 6건 + 렌더 1건 + 옵트인 1건.

### 렌더 없는 검증 (빠름)

| 테스트 | 대응 |
|--------|------|
| 9:16 고정 + 2장 미만 차단 | FR-L14 · FR-L13 |
| 한 사이클만 편집 가능, 반복은 고스트 | FR-L06 · §6.4 |
| 불가 조합 비활성 + 30초에서 해제 | FR-L07 / SC7의 UI 쪽 |
| 가로 KV 경고와 `contain` 토글 | FR-L19 |
| 상속 배지 + 카피 탭은 고지문구 전용 + 글자수 힌트 | FR-L04 · FR-L11 · FR-L15 |
| Hook·나레이션 숨김, BGM만 남음 | Plan L9 |

### 렌더 1회로 SC1~SC5 (핵심)

**타이틀도 고지문구도 올리지 않은 프로젝트로 렌더한다.** 그 자체가 SC5이고, 같은
산출물에서 나머지를 읽는다.

| SC | 측정 |
|----|------|
| SC1 | `ffprobe` — 1080×1920 · h264 · aac · 14.8~15.2초 |
| SC2 | 각 홀드의 중간(0.94/2.81/4.69/6.56초)에서 중앙 200×200을 샘플링해 팔레트 4색 중 어느 KV인지 판정 |
| SC3 | 사이클 1과 사이클 2의 대응 시점(+7.5초) 색차가 채널당 12 이내 |
| SC4 | 경계 시점(1.875초) 프레임이 앞뒤 KV **양쪽과** 거리 20 이상 — 혼합이라는 뜻 |
| SC5 | 오버레이 0개 상태에서 렌더·다운로드가 완료된 것 자체 |

KV별 단색 팔레트가 이 측정의 전부다 — 화면의 색이 "지금 몇 번째 KV인가"를 말해주므로,
홀드 타이밍과 사이클 동일성을 프리뷰 DOM이 아니라 **출력 MP4에서** 판정할 수 있다.
`scripts/generate-editor-fixture.mjs`에 세로 4색(`kv-1`~`kv-4`)과 가로 1색
(`kv-landscape`) 스틸을 추가했다.

### 옵트인 (SC6)

`KV_LOOP_LOCALE=1`에서만 돈다. en 셋만 채우고 en·ja를 각각 렌더해 대응 프레임이 같은
KV인지 확인한다. 렌더 2회라 기본 실행에서 뺐다 — `DAY1_LONGFORM`·`RENDER_FPS_OUTPUT`과
같은 관례다.

### 여기서 다루지 않은 것

- **SC8 (기존 회귀)** — 기존 E2E 54건 전량이 그 판정이고, 이 스펙이 대신할 수 없다.
- **§8.2 시나리오 2의 불균등 홀드(1.9/2.4/2.3/3.1초)** — 경계 키보드 조작
  (`ArrowRight`, 100ms/1000ms 스텝)으로 맞출 수 있지만, 검증하지 못한 상태로 4번의
  드래그 시퀀스를 얹으면 실패 원인이 불분명해진다. 균등 홀드에서 SC2를 먼저 통과시킨
  뒤 추가하는 것이 순서다.

---

## 3. 실행 방법

```bash
# 1) 픽스처 (KV 스틸 5장 포함)
npm run generate:editor-fixture

# 2) 루핑만
npx playwright test tests/e2e/kv-loop.spec.ts

# 3) 렌더 없는 6건만 (빠른 확인)
npx playwright test tests/e2e/kv-loop.spec.ts -g "controls"

# 4) SC6까지
KV_LOOP_LOCALE=1 npx playwright test tests/e2e/kv-loop.spec.ts

# 5) SC8 — 기존 전량 회귀
npm run test:e2e
```

시스템 Chrome이 필요하다(`channel: 'chrome'`). 렌더 1건의 타임아웃은 10분으로 잡았다.

---

## 4. 사이클 종료를 위해 남은 것

| # | 항목 | 어디 |
|---|------|------|
| 1 | 루핑 E2E 8건 실행·수정 | 이 문서 §3 |
| 2 | 기존 E2E 54건 전량 통과 (**SC8**) | `npm run test:e2e` |
| 3 | 편집기 수동 통과 8단계 | module-4 evidence §4 |
| 4 | 루핑 MP4 수동 1회 + 레퍼런스 대조 | module-3 evidence §4 |
| 5 | `benchmark:render` 실측 (**NFR-L01·L02**, D-07) | module-3 evidence §4 |
| 6 | 불균등 홀드 E2E 추가 (§8.2 시나리오 2) | 위 §2 |

1~5가 끝나면 `/pdca check key-visual-looping`으로 Gap 분석을 돌리고 리포트를 쓰는
것이 이 저장소의 사이클 마감 순서다(2026-08 아카이브의 5개 사이클과 동일).

유닛은 **494/494**, 빌드 통과 상태로 넘긴다.
