# 2026-08-27 — kv-ai-designation 핸드오프 (Design 착수)

> 다음 세션이 이 문서 하나로 맥락을 복원할 수 있도록 남긴다. 갱신: Plan 승인(D-A01~D-A10 확정) 시점.

## 현재 상태 — 브랜치 `claude/kv-ai-designation-plan-0a6o43`

| 단계 | 상태 | 커밋 |
|---|---|---|
| P0 스파이크 — 지정 기술 후보 4종 실측 | ✅ | `3ff94d0` · 증거 [p0-designation-spike](../03-analysis/kv-ai-designation.p0-designation-spike.md) · 하네스 `artifacts/kv-ai-p0/` |
| Plan 초안 (D-A01~D-A10 제시) | ✅ | `3ff94d0` |
| 결정 — 요청자 확인 8건 + 구현 결정 2건 | ✅ | `53a590e` · `b952909` · `06d7379` · [Plan §1.5.1](../01-plan/features/kv-ai-designation.plan.md) |
| Plan **Approved** 승격 (v0.3.0) | ✅ | `06d7379` |
| **Design 문서** | ⏸ **차단** — 아래 "착수 전 차단 조건" 두 개 |
| M0 실소재 정확도 게이트 | ⏸ | 요청자 키비주얼 대기 |
| M1~M5 | — | 미착수 |

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
| D-A10 | 게이트 기준은 **키비주얼을 받은 뒤 M0에서 함께 정한다** (이전 사이클 D-05과 같은 절차) |

## P0 실측 요약 — 숫자의 출처는 [p0-designation-spike](../03-analysis/kv-ai-designation.p0-designation-spike.md)

| 후보 | IoU (불꽃/캐릭터/광구) | warm | 무게 |
|---|---|---|---|
| **MediaPipe v1** (magic_touch) | **0.979 / 0.837 / 0.984** | **0.55~0.65초** | **17.2MB** |
| MediaPipe v2 | 0.984 / 0.854 / 0.986 | 9.4초 | 40.3MB |
| 플러드 필 (모델 없음) | 0.901 / **0.170** / 0.468 | 1~146ms | 0MB |
| EfficientDet-Lite0 (자동 후보) | 박스 IoU 0 / 0.093 / 0.916, 라벨은 `cup`·`mouse` | 190~282ms | 13.2MB |
| **밝은 영역** (자동 후보, 모델 없음) | **박스 IoU 0.849 / 0.003 / 0.929** | **1~7ms** | **0MB** |

닫힌 제약 셋:

- **마스크는 프로젝트 파일에 들어간다** — 전해상도 RLE 0.9~3.5KB. 상한치 구성
  (슬롯 8 × 오브젝트 8)에서 224KB로 `MAX_PROJECT_FILE_BYTES`(1MB) 안이다.
- **정적 Pages 제약은 통과** — COOP/COEP 없이 같은 속도(573/553/646 vs 554/583/542ms).
- **임계값은 공짜 노브** — 확신도 필드 재이진화만으로 캐릭터 IoU 0.837 → 0.918.
  기본값을 0.5로 두면 안 된다(윤곽이 뚜렷할수록 낮은 임계값이 낫다).

## 착수 전 차단 조건 — 둘 다 이 컨테이너에서 못 푼다

| # | 무엇 | 왜 막혔나 | 풀리면 |
|---|---|---|---|
| 1 | **`magic_touch` 모델의 재배포 권리** | `ai.google.dev` 이그레스 차단. D-A03이 모델을 우리 도메인에서 서빙하기로 정했으므로 질문이 "써도 되나"에서 **"다시 배포해도 되나"**로 올라갔다. 런타임(`@mediapipe/tasks-vision`)은 Apache-2.0 확인됨 | Design 착수. 불가하면 **D-A03만** 되돌린다(모델을 핀된 MediaPipe 경로에서) — 코드 영향은 어댑터의 URL 한 줄 |
| 2 | **요청자의 실제 키비주얼 5장 이상** | 컨테이너에 실소재가 없다. P0의 정확도는 **그린 픽스처**에서 나온 값이라 절대 정확도의 근거가 못 된다 | M0 착수 → "수정 없이 승인되는 비율"과 여유값 기본값 확정(D-A10) |

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

## 다음 세션 프롬프트 (복사용 — 실제 키비주얼 5장 이상 첨부와 함께)

```
/bkit:pdca design kv-ai-designation

kv-ai-designation의 Design과 M0을 진행합니다. 먼저 읽어주세요:
- docs/00-history/2026-08-27-kv-ai-designation-handoff.md (현재 상태·차단 조건)
- docs/01-plan/features/kv-ai-designation.plan.md (D-A01~D-A10 확정, §1.5.2가
  D-A03의 함의)
- docs/03-analysis/kv-ai-designation.p0-designation-spike.md (기술 선택의 근거)

브랜치 claude/kv-ai-designation-plan-0a6o43에 Plan·증거가 커밋돼 있습니다
(HEAD 06d7379, src 무변경).

1. 차단 조건 확인: magic_touch 모델이 재배포 가능한지 (모델 카드/라이선스).
   불가하면 D-A03만 "모델은 핀된 MediaPipe 경로에서"로 되돌리고 진행.
2. 첨부한 키비주얼로 M0 — artifacts/kv-ai-p0/ 하네스를 실소재에 돌려
   "수정 없이 승인되는 비율"과 여유값 기본값을 실측하고, D-A10의 기준을
   같이 정해주세요. 미달이면 Plan §5의 완화 순서대로 범위를 재조정.
3. 통과 시 Design 문서 — 지정 형태 유니온의 정확한 스키마(D-A05), 마스크
   RLE 인코딩과 이미지→프레임 매핑 함수 시그니처(D-A04·A06), ObjectDesignator
   포트 계약, 지정 세션의 상태 모델. 그다음 M1.
```
