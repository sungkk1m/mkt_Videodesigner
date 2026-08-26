# kv-object-animation — M0 결정론 캔버스 스파이크

> **Feature**: kv-object-animation
> **Date**: 2026-08-26
> **Question**: `useCurrentFrame` 구동 + 시드 고정 캔버스 이펙트 레이어(파티클·글로우)가 `@remotion/web-renderer`의 인코딩 프레임에 결정론적으로, 카메라 transform을 추종하며 도달하는가 (Design §4.3)
> **Verdict**: **PASS 5/5 — `useLayoutEffect` 드로잉 채택. `delayRender` 선회 불필요. M1 착수 가능.**

---

## 1. 무엇을 돌렸나

Design §3(닫힌 식 파티클·주기 글로우)과 §4(transform 공유 캔버스)의 후보
구현을 스파이크 로컬로 두고, 카메라 수식은 실제 도메인(`rectToTransform`·
`lerpKvRect`·`withKvRoundTrip`)을 임포트해 1080×1920 텍스처 픽스처 위에서
30fps·90프레임을 렌더했다. 이펙트는 레퍼런스 모닥불 배치를 모사: 파티클
방출 영역 rect(0.30, 0.55, 0.40×0.20) + 글로우 점(0.5, 0.62)·반경 0.18.

| 항목 | 값 |
|---|---|
| 출력 | 1080×1920 · 30fps · 90프레임 · vp9/webm (이 컨테이너에 H.264 없음 — 판정은 코덱 독립) |
| 래스터화 경로 | **자체 래스터라이저** (`nativeHtmlInCanvas: false`) — 블러 스파이크와 같은 경로 |
| 렌더 | a1/a2(이펙트 on, 시드 42) 2.5/2.3초 · off 2.6초 · cam(왕복 줌 on) 4.5초 · camoff 2.8초 |
| 드로잉 시점 | `useLayoutEffect` — 커밋 직후 동기 드로잉, 게이트 ⑤가 스냅샷 도달을 판정 |

## 2. 판정 — `node artifacts/kv-obj-m0/verify.mjs`

| 게이트 | 결과 | 수치 |
|---|---|---|
| ① 결정론 — 같은 시드 2회 렌더 | PASS | **webm 파일이 sha256 비트 동일**, 디코드 프레임 최대 차 0.000 |
| (전제) 이펙트가 실제로 보인다 | PASS | 글로우 창 on/off 평균 차 10.5/255 |
| ③ 격리 — 도달 범위 밖 무변화 | PASS | 상단(y<0.30)·하단(y>0.85) 띠 최대 차 **0.080** — 코덱 노이즈 수준 |
| ⑤ 순수 함수 단독 드로잉(스크럽 등가) = 인코딩 프레임 | PASS | f10/f45/f80 최대 평균 차 **0.48**/255 (허용 3) |
| ④ 카메라 추종 — 글로우 중심의 예측 위치 | PASS | 중심 y 0.620(f0, 예측 0.620) → **0.643**(정점, 예측 0.644) |

부가 관측: 글로우 펄스가 45프레임 주기로 반복(창 밝기 스윙 6.9, 주기 반복
오차 0.45) — 주기 함수가 인코딩까지 그대로 살아 있다.

## 2.1 렌더 비용 — 이 경로에서 이펙트는 사실상 공짜다

블러의 교훈(소프트웨어 경로 프레임당 1.25초)과 정반대다:

| 구성 | 시간 | 읽기 |
|---|---|---|
| 이펙트 on (a1/a2) vs off | 2.5/2.3초 vs 2.6초 | 카메라 정지 상태에서 이펙트 비용은 **측정 오차 이하** (≈0ms/프레임) |
| 카메라 on: cam vs camoff | 4.5초 vs 2.8초 | transform이 걸린 캔버스의 래스터화가 **≈19ms/프레임** — 1회 측정이라 상한 참고치 |

블러가 비쌌던 이유(전면 픽셀 컨볼루션)와 달리 파티클 32개 + radial gradient
1개는 드로잉 양 자체가 작다. 게이트 확정은 예정대로 실기기 재측정(D-05, M5).

## 3. 함의

- **Design §4.2 확정**: `useLayoutEffect` 동기 드로잉이 렌더러 스냅샷에
  도달한다. `delayRender` 선회 불필요.
- **D-03의 구조 실증**: 해시 기반 닫힌 식은 렌더 2회를 비트 동일하게 냈다 —
  증분 시뮬레이션 없이 스크럽·재렌더 동일성이 성립한다(게이트 ①+⑤가 SC2·SC3의
  컨테이너 판정).
- **D-04의 구조 실증**: transform 문자열 공유만으로 이펙트가 카메라 수식의
  예측 위치에 정확히 실린다(게이트 ④가 SC4의 컨테이너 판정).
- 첫 실행에서 pageerror "Failed to fetch" 2건이 잡혔으나 계측 재실행에서
  재현되지 않았다(favicon 404·Remotion 라이선스 경고뿐). 판정은 전부 산출물
  기준이라 영향 없음 — M2 통합 후 E2E에서 재관찰.
- 남은 검증은 실기기(M5): 네이티브 `html-in-canvas` 경로 + H.264에서 같은
  판정, 비용 재측정.

## 4. 재현

```bash
npm run dev -- --host 127.0.0.1 --port 4173   # 별도 셸
node artifacts/kv-obj-m0/run.mjs               # → out/{a1,a2,off,cam,camoff}.webm + pure-*.png
node artifacts/kv-obj-m0/verify.mjs            # 게이트 5줄 + info 2줄
```

픽스처가 없으면 먼저 생성한다 (ffmpeg는 `node_modules/ffmpeg-static`):

```bash
ffmpeg -f lavfi -i "testsrc2=size=1080x1920:rate=1:duration=1" \
  -vf "eq=brightness=-0.25:saturation=0.6" -frames:v 1 artifacts/kv-obj-m0/out/tex.png
```

다른 포트/실기기 Chrome은 `KV_OBJ_M0_URL`·`KV_OBJ_M0_CHROME`으로 지정한다.

## Version History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 0.1.0 | 2026-08-26 | 김성권 / Claude | 최초 작성 — 자체 래스터라이저 경로 5/5 PASS, 비용 ≈0~19ms/프레임 |
