# 2026-08-27 — kv-ai-designation 핸드오프 (Design 착수)

> 다음 세션이 이 문서 하나로 맥락을 복원할 수 있도록 남긴다. 갱신: Plan v0.4.0 — D-A01~D-A10 확정 + 소재 규모(4장·2~3회 반복) 반영.

## 현재 상태 — 브랜치 `claude/kv-ai-designation-plan-0a6o43`

| 단계 | 상태 | 커밋 |
|---|---|---|
| P0 스파이크 — 지정 기술 후보 4종 실측 | ✅ | `3ff94d0` · 증거 [p0-designation-spike](../03-analysis/kv-ai-designation.p0-designation-spike.md) · 하네스 `artifacts/kv-ai-p0/` |
| Plan 초안 (D-A01~D-A10 제시) | ✅ | `3ff94d0` |
| 결정 — 요청자 확인 8건 + 구현 결정 2건 | ✅ | `53a590e` · `b952909` · `06d7379` · [Plan §1.5.1](../01-plan/features/kv-ai-designation.plan.md) |
| Plan **Approved** 승격 (v0.3.0) | ✅ | `06d7379` |
| 소재 규모 반영 (v0.4.0) — 4장·2~3회 반복, 판정 방법 변경, 라이선스 강등 | ✅ | 이 브랜치 최신 |
| **Design** (v0.2.0 **Confirmed**) | ✅ | `660cdce` + §12 확인 · [design](../02-design/features/kv-ai-designation.design.md) — §12.1에 확인 결과 |
| M1·M2 (스키마·도메인·드로잉) | ⏭ **바로 착수** | 관문 없음. **M0을 기다리지 않는다** — 실소재 정확도에 의존하는 것이 없다 |
| M0 실소재 정확도 게이트 | ⏸ | 요청자 키비주얼 **4장** 대기 |
| M3~M5 | — | 미착수 |

`main`은 `12f2034`(kv-object-animation 완료 병합)이고 이 브랜치는 그 위에서
docs만 추가했다 — `src` 무변경, 유닛 618 그린.

## 이 사이클이 무엇인가

kv-object-animation이 지정을 **드래그 사각형**까지 배송하고 AI 경로를 다음
사이클로 미뤘다(그 Plan D-01·D-02). 사이클 종료 시점에 요청자가 두 가지를 더
요청했고([report §5](../04-report/kv-object-animation.report.md)), 이 사이클이 그 둘이다:

1. **클릭 하나로 캐릭터 같은 오브젝트를 지정** → 온디바이스 세그멘테이션 + 마스크
2. **이펙트를 걸 만한 오브젝트를 AI가 먼저 제안** → 밝은 영역 검출

관통하는 원칙 하나: **모델은 스키마를 만드는 도구이고, 렌더의 입력이 아니다.**
확정된 마스크는 값으로 굳어 저장되므로 렌더·배치·JSON 내보내기가 모델 없이
돌고, 모델이 실패해도 프로젝트는 무손상이다(Plan §1.2).

## 확정된 결정 10건 — 원본은 [Plan §1.5.1](../01-plan/features/kv-ai-designation.plan.md)

| # | 결정 |
|---|---|
| D-A01 | 클릭→마스크 **와** 자동 후보 제안 둘 다. 자동 후보는 모델이 아니라 밝은 영역 검출 |
| D-A02 | MediaPipe Interactive Segmenter **v1**(magic_touch). v2·SAM 계열 추가 스파이크는 하지 않는다 |
| **D-A03** | 런타임·모델을 **둘 다 배포본에 담아 외부 호스트 0**. 기본 제안(모델은 CDN)에서 변경된 유일한 항목 — 함의는 Plan §1.5.2 |
| D-A04 | 전해상도 이진 마스크의 **RLE(base64)** — 구현 결정으로 확정 |
| D-A05 | 마스크는 **지정의 형태** — `region`이 `{shape: 'rect' \| 'mask'}` 유니온. 이펙트 `kind`는 그대로 |
| D-A06 | **이미지 정규 좌표** + 그릴 때 `objectFit` 매핑 — 구현 결정으로 확정 |
| D-A07 | 수정 수단은 **여유값 슬라이더 + 추가/제외 클릭**. 픽셀 브러시는 범위 밖 |
| D-A08 | 오브젝트 모션(줌)은 **다음 사이클**. "확대 전용이면 구멍이 없다"는 관찰만 입력으로 남긴다 |
| D-A09 | 외부 vision API 경로를 **만들지 않는다** |
| D-A10 | 게이트 기준은 **키비주얼을 받은 뒤 M0에서 함께 정한다**. 소재가 4장이므로 판정은 비율이 아니라 **유형 커버리지** — Plan §4.1.1 |

## `magic_touch`가 정확히 무엇인가

D-A02가 고른 모델이다. 측정으로 확인한 것만 적는다.

| 항목 | 값 |
|---|---|
| 정체 | `magic_touch.tflite`, 6,227,884바이트. Google이 MediaPipe 모델 스토리지의 **버전 고정 경로**에서 배포 |
| 하는 일 | MediaPipe **Interactive Segmenter** 태스크의 모델. 입력 = 이미지 + 관심 지점(점·스크리블·박스), 출력 = 그 지점 오브젝트의 마스크. 즉 "클릭 → 마스크" 자체 |
| 출력 | 이진 카테고리 마스크 + [0,1] 확신도 필드 두 벌, **입력과 같은 1080×1920** |
| 접근 | v1은 `InteractiveSegmenterLegacy` 클래스로만. 현행 `InteractiveSegmenter`는 v2 `.task` 번들(30.5MB)을 요구한다 |
| 라이선스 | 런타임(`@mediapipe/tasks-vision` npm)은 Apache-2.0 **확인됨**. 모델 가중치 라이선스는 별개 문서이고 미확인 |

이름 그대로 "요술 터치" — 클릭 한 번으로 오브젝트를 뽑는 UX를 위한 모델이다.
기술적으로 병목인 곳은 없다(측정한 후보 중 가장 좋다). 라이선스가 화제가 된
것은 **오직 D-A03이 자기 호스팅을 골랐기 때문**이고, 그 처리는 위 표의 1번이다.

## P0 실측 요약 — 숫자의 출처는 [p0-designation-spike](../03-analysis/kv-ai-designation.p0-designation-spike.md)

| 후보 | IoU (불꽃/캐릭터/광구) | warm | 무게 |
|---|---|---|---|
| **MediaPipe v1** (magic_touch) | **0.979 / 0.837 / 0.984** | **0.55~0.65초** | **17.2MB** |
| MediaPipe v2 | 0.984 / 0.854 / 0.986 | 9.4초 | 40.3MB |
| 플러드 필 (모델 없음) | 0.901 / **0.170** / 0.468 | 1~146ms | 0MB |
| EfficientDet-Lite0 (자동 후보) | 박스 IoU 0 / 0.093 / 0.916, 라벨은 `cup`·`mouse` | 190~282ms | 13.2MB |
| **밝은 영역** (자동 후보, 모델 없음) | **박스 IoU 0.849 / 0.003 / 0.929** | **1~7ms** | **0MB** |

닫힌 제약 셋:

- **마스크는 프로젝트 파일에 들어간다** — 전해상도 RLE 0.9~3.5KB. 실사용
  최대(슬롯 4 × 오브젝트 8)에서 **112KB**, 스키마 상한(슬롯 8)에서도 224KB로
  `MAX_PROJECT_FILE_BYTES`(1MB) 안이다. **루프 반복은 저장 비용이 0** —
  `loopCount`는 같은 슬롯을 다시 보여주는 것이고 마스크를 늘리지 않는다.
- **정적 Pages 제약은 통과** — COOP/COEP 없이 같은 속도(573/553/646 vs 554/583/542ms).
- **임계값은 공짜 노브** — 확신도 필드 재이진화만으로 캐릭터 IoU 0.837 → 0.918.
  기본값을 0.5로 두면 안 된다(윤곽이 뚜렷할수록 낮은 임계값이 낫다).

## 병렬로 풀 것 — 둘 다 Design을 막지 않는다

이전 판(v0.3.0)에서 이 둘을 "차단 조건"으로 세웠는데 **과대평가였다.** 정정한다.

| # | 무엇 | 왜 여기서 못 하나 | Design을 막지 않는 이유 |
|---|---|---|---|
| 1 | **`magic_touch` 모델의 재배포 권리** | `ai.google.dev` 이그레스 차단. D-A03이 모델을 우리 도메인에서 서빙하기로 정했으므로 질문이 "써도 되나"에서 **"다시 배포해도 되나"**로 올라갔다. 런타임(`@mediapipe/tasks-vision`)은 Apache-2.0 확인됨 | 스키마·좌표 매핑·포트 계약·UI 중 파일이 어디서 오는지에 의존하는 것이 **하나도 없다**. 어댑터가 경로를 **설정값**으로 받고 기본값을 Google 핀 URL(그 모델의 명시적 용도, 재배포 질문이 없는 경로)로 두면 그대로 진행된다. 확인되면 상수를 같은-오리진으로 바꾸는 것이 D-A03의 완성이고, 확인 전까지 커밋되는 바이너리는 없다 |
| 2 | **요청자의 실제 키비주얼 4장** | 컨테이너에 실소재가 없다. P0의 정확도는 **그린 픽스처**에서 나온 값이라 절대 정확도의 근거가 못 된다 | Design(스키마·함수 시그니처·포트)은 정확도와 무관하다. 막히는 것은 **M0 하나**다 |

## 주의사항

- **이 컨테이너의 제약** — ① GPU 없음(WebGL은 SwiftShader, WebGPU 어댑터 없음)
  이라 GPU 델리게이트 수치는 실기기 예측치가 아니다 ② `huggingface.co`·
  `cdn.jsdelivr.net` 차단(403) — transformers.js·SAM 계열은 탈락이 아니라
  **미실측**이다 ③ H.264 인코더 없음(기존 제약, 렌더 판정은 VP9로).
- **Playwright 브라우저 경로** — 설치본이 `chromium-1194`인데 Playwright 1.62는
  `1234`를 찾는다. 스파이크는 `KV_AI_P0_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`로 넘긴다.
- **소재는 서버로 보내지 않는다** — D-A09로 외부 API 경로를 아예 만들지 않기로
  했으므로 이 문장은 예외 없이 유지된다. 모델이 이미지를 받는 것이지 이미지가
  나가는 게 아니다.
- **`Math.random()` 금지** — 이전 사이클의 결정론 규약(D-03) 그대로. 마스크
  방출점도 `kvHash01(seed, i, k)` 색인으로 닫힌 식을 유지해야 한다(Plan §1.3).
- **지난 사이클 Design의 정정** — kv-object-animation Design §1.1-3에 전방
  포인터를 넣었다. "마스크는 새 `kind`"는 D-A05가 뒤집었다.
- `artifacts/kv-ai-p0/out/`은 gitignore다(99MB — 런타임·모델·픽스처).
  `node artifacts/kv-ai-p0/prepare.mjs`가 전부 다시 받는다.

## 스파이크 재현

```bash
node artifacts/kv-ai-p0/prepare.mjs        # 런타임·모델 → out/ (gitignored)
KV_AI_P0_CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  node artifacts/kv-ai-p0/run.mjs          # 헤더 없음/있음 두 벌 → out/results.json (약 11분)
node artifacts/kv-ai-p0/verify.mjs         # 표 출력
KV_AI_P0_CHROME=… node artifacts/kv-ai-p0/probe-mask.mjs   # 임계값 스윕
```

`KV_AI_P0_CHROME`을 시스템 Chrome으로 바꾸면 실기기 GPU 경로가 같은 스크립트로
재측정된다 — M0이 쓸 하네스가 이미 있다.

## 다음 세션 프롬프트 — 3단 분할 (복사용)

한 세션에 Design→M5를 넣으면 컨텍스트가 터진다. 분할 기준은 **무엇이 필요한가**다:
1단은 아무것도(모델·실소재·실기기 전부 불필요), 2단은 모델과 실소재, 3단은 실기기.
1단은 M0을 기다리지 않아도 된다 — 스키마·도메인·렌더는 정확도와 무관하다.

### 1단 — M1 + M2 (Design 초안은 이미 있음, 모델·UI 없음)

```
/bkit:pdca do kv-ai-designation

kv-ai-designation의 M1·M2를 진행합니다. Design은 v0.2.0 **Confirmed**이고
§12의 확인 항목도 닫혔으니(§12.1) **바로 구현으로 갑니다.** 모델·UI가 없는
층까지만 — 이 범위는 실소재 정확도와 무관하므로 M0을 기다리지 않습니다.

읽을 문서 (이 셋만, 컨텍스트 절약):
- docs/02-design/features/kv-ai-designation.design.md (설계 본문 — 이것이 주 문서)
- docs/00-history/2026-08-27-kv-ai-designation-handoff.md
- docs/01-plan/conventions.md
(Plan은 필요할 때 §4.1.1·§5만 열어보세요 — 설계가 이미 Plan을 흡수했습니다)

브랜치 claude/kv-ai-designation-plan-0a6o43 (Plan v0.4.0 Approved, src 무변경).
시작 전 npm install.

1) M1 — 스키마·상수·커맨드 + domain/kvloop/mask.ts, lightRegions.ts
   **글로우 필드 경로의 기계적 정정을 포함합니다** — effect.center/radius를 읽는
   네 곳이 effect.region.…이 됩니다(설계 §10의 M1 각주). 새 UI가 아니라 타입
   체크를 통과시키는 경로 변경이고, 값과 그리기 인수는 그대로입니다.
   단위 테스트로 판정: RLE 왕복 동일성, bbox 닫힌 식, 같은 (시드, 프레임)이
   같은 방출점, objectFit 매핑이 cover·contain × 종횡비 조합에서 정확,
   밝은 영역 검출이 알려진 입력에 알려진 박스.

2) M2 — 마스크 드로잉(KvEffectsCanvas) + KvScene 통합
   설계 §4.3의 artifacts/kv-ai-m2/ 하네스를 만들어 SC-A2(마스크 도달 범위 밖 무변화)와
   렌더 비용을 VP9로 실측(전례: artifacts/kv-obj-m0/). 글로우 흐림이 비싸면
   Plan §5의 "지정 시점에 한 번 구워 저장" 선회를 검토하고 수치를 문서에 남기세요.

지켜야 할 것:
- domain은 Remotion·DOM·모델 런타임을 임포트하지 않는다 (conventions §1)
- Math.random()/Date.now() 금지 — 마스크 방출점도 kvHash01 색인으로 닫힌 식
- 마스크 없는 기존 프로젝트는 프레임 단위로 동일 (FR-A13)
- 이 세션에서 모델·UI는 건드리지 않는다 (M3·M4의 몫)
- 설계를 발명하지 말고 따를 것 — 이미 쓰여 있다. 벗어나야 하면 먼저 말할 것
- 완료 기준: npm test + npm run build 그린, 하네스 수치 문서화, 커밋·푸시
```

### 2단 — M0 + M3 + M4 (실제 키비주얼 4장 첨부와 함께)

```
/bkit:pdca do kv-ai-designation

kv-ai-designation의 M0·M3·M4를 진행합니다. 실제 키비주얼 4장을 첨부했습니다.

읽을 문서 (이 셋만):
- docs/00-history/2026-08-27-kv-ai-designation-handoff.md
- docs/02-design/features/kv-ai-designation.design.md
- docs/01-plan/features/kv-ai-designation.plan.md — §4.1.1, §5, §2.3

브랜치 claude/kv-ai-designation-plan-0a6o43 (Design·M1·M2 완료). npm install.

1) M0 — 실소재 정확도 게이트. 다른 무엇보다 먼저.
   artifacts/kv-ai-p0/ 하네스를 첨부한 4장에 돌려 Plan §4.1.1의 유형 커버리지
   표를 채우세요. 각 이미지에서 이펙트를 걸 만한 오브젝트를 짚고, 유형별로
   "클릭 한 번 / 여유값까지 / 추가·제외 클릭까지 / 못 짚음"을 기록합니다.
   여유값(임계값) 기본값도 여기서 실측으로 정합니다 — P0에서 캐릭터가 0.2에서
   가장 좋았으므로(0.837→0.918) 0.5로 두면 안 됩니다.
   → docs/03-analysis/kv-ai-designation.m0-real-asset-gate.md 로 쓰고, 기준을
     저와 함께 확정한 뒤 M3으로. 못 짚는 유형이 사각형으로도 안 되면 Plan §5의
     완화 순서로 범위를 재조정하고 멈춰서 확인받으세요.

2) M3 — ObjectDesignator 포트·어댑터
   src/infrastructure/vision/ 에 MediaPipe 어댑터. 로드·추론·취소(AbortSignal)·
   실패 폴백. 자산 경로는 설정값(shared/config/models.ts)이고 기본값은 Google의
   버전 고정 URL — 재배포 권리가 확인되면 같은-오리진으로 바꾸는 한 줄이 D-A03의
   완성입니다(Plan §2.3). 가짜 어댑터로 실패·취소 경로까지 단위 테스트.

3) M4 — UI
   클릭 지정, 자동 후보(밝은 영역) 목록, 여유값 슬라이더, 추가/제외 클릭,
   승인·거절. E2E는 지정 세션 상태와 **네트워크 관찰**까지 — SC-A9(AI 지정을
   누르기 전 모델 관련 요청 0건), FR-A12(소재가 어떤 요청에도 실리지 않음).

지켜야 할 것:
- 모델 로드가 실패해도 편집·렌더·저장이 동작한다 (SC-A8)
- 완료 기준: npm test + npm run build + npx playwright test 그린, 커밋·푸시
```

### 3단 — M5 실기기 게이트 + 리포트 (실기기 렌더 2벌 첨부와 함께)

```
/bkit:pdca check kv-ai-designation

kv-ai-designation의 M5 실기기 게이트를 진행합니다. 마스크 이펙트 on/off 두 벌의
실기기 렌더를 첨부했습니다(각 렌더 소요 시간은 본문에 적음).

읽을 문서:
- docs/00-history/2026-08-27-kv-ai-designation-handoff.md
- docs/01-plan/features/kv-ai-designation.plan.md — §4 (SC-A1~SC-A10)
- docs/03-analysis/kv-ai-designation.m0-real-asset-gate.md

1) SC-A1~SC-A10을 프레임 실측으로 판정. 방법 전례: artifacts/kv-obj-m5/ 의
   스캔·분석 파이프라인.
2) 통과 시 리포트(docs/04-report/kv-ai-designation.report.md) → main 병합 →
   Pages 원복(kv-object-animation.m5-runbook.md §5 절차). 미달 항목이 있으면
   원인 분해와 수정 커밋 후 재판정 준비까지.
3) 리포트 §5에 다음 사이클 입력을 남길 것 — D-A08(오브젝트 모션: 확대 전용이면
   구멍이 없다)과 magic_touch 재배포 권리의 최종 상태.
```

### 순서를 바꿔도 되는 경우

키비주얼 4장이 지금 준비돼 있다면 **2단의 M0만 먼저 떼어** 1단 앞에 돌리는 것도
좋다 — M0이 크게 미달이면 M1·M2도 범위가 달라지므로, 그 경우엔 헛일을 줄인다.
반대로 소재가 아직 없으면 1단은 그대로 진행해도 손해가 없다(스키마·도메인·렌더는
정확도와 무관).
