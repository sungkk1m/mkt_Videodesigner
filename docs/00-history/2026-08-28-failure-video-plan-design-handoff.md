# failure-video 인수인계 — 2026-08-28

새 세션에서 이 사이클을 이어받을 때 필요한 것만 적었다. 전체 맥락은
[Plan](../01-plan/features/failure-video.plan.md) ·
[Design](../02-design/features/failure-video.design.md) ·
[Analysis](../03-analysis/failure-video.analysis.md)에 있다.

## 지금 상태

- 브랜치 `claude/failure-video-template-plan-poq31c`, 전부 푸시됨. PR 없음(요청되지 않음).
- PDCA: **Plan 완료 · Design 완료 · Do 완료(M1~M7)** — 남은 것은 실기기 렌더 검증과
  아래 "사용자 판단 대기" 1건.
- `npm test` 726/726 · `npm run build` 그린. 스키마 버전 **2 유지**, 마이그레이션 0건.
- 레퍼런스 영상(사용자 업로드 mp4, 360×640 @30fps, 50s)은 여전히 **이 저장소에 없다.**
  M4 게이트는 Plan §1.2/§1.4에 박제된 **수치**와 실제 컴포지션 프레임을 대조하는
  방식으로 통과했다(10/10) — Analysis §4, 산출물 `artifacts/failure/m4-review.png`.
- 사용자 확정 결정 4건(Q1-Q4)은 Plan §2에, 설계 결정 12건(D-0~D-11)은 Design §13에.
  **하나도 뒤집지 않았다.** Design과 다르게 간 5곳은 Analysis §8에 근거와 함께 있다.

## 남은 일

1. **실기기 렌더 검증** — 아래 "이 환경에서 막히는 것" 참조. `npx playwright test failure`
   5개 시나리오 중 2개는 컨테이너에서 이미 그린, 3개(업로드가 필요한 것)가 실기기 몫이다.
2. **사용자 판단 대기 1건** — FAIL 비트와 레벨 1 아웃고잉 펀치가 마지막 8프레임에서
   겹친다(영상 레이어 줌이 순간 4.4배). Design이 정의한 두 동작의 합성이라 사양대로
   구현했고 실제로 깨져 보이지도 않지만, 레퍼런스에는 없는 상태다.
   상세와 선택지는 **Analysis §9**.

## 이 사이클에서 나온 회귀 방어 (중요)

Do 도중 **자동저장 손실 버그를 만들었다가 잡았다.** 스키마 refine이 거부하는 비율을
Batch 대화상자가 만들어 낼 수 있었고, 저장은 검증하지 않으므로 다음 로드에서
프로젝트가 조용히 사라졌다. **같은 구멍이 kv-loop에도 있었다**(이 사이클 이전 버그).
`ratiosForTemplate` 한 함수로 네 표면이 같은 규칙을 읽게 해 닫았다 — Analysis §5.

> refine에 제약을 넣을 때는 **그 값을 만들 수 있는 모든 표면**을 같이 세야 한다.

## 이 환경에서 막히는 것 (day1-quad 인수인계에서 검증된 사실)

원격 컨테이너의 Chromium에 **H.264 인코더·디코더가 없다.** 저장소 픽스처가 전부
H.264라 업로드가 프로브 단계에서 실패한다. 우회로:

```bash
# ffmpeg/ffprobe를 PATH에 (npm 패키지; 컨테이너에 ffmpeg 없음)
mkdir -p /tmp/bin
node -e "const fs=require('fs');fs.writeFileSync('/tmp/bin/ffmpeg','#!/bin/sh\nexec '+require('ffmpeg-static')+' \"\$@\"\n');fs.writeFileSync('/tmp/bin/ffprobe','#!/bin/sh\nexec '+require('ffprobe-static').path+' \"\$@\"\n')"
chmod +x /tmp/bin/ffmpeg /tmp/bin/ffprobe && export PATH=/tmp/bin:$PATH

npm ci && npm run generate:editor-fixture
node artifacts/m0/make-sources.mjs            # VP9 소스 (컨테이너가 디코딩 가능)
npm run dev -- --host 127.0.0.1 --port 4173 &
```

VP9 소스로 컨테이너에서 돌릴 수 있는 검증 (전부 그린):

```bash
node artifacts/failure/verify-m1-extraction.mjs   # 추출이 순수 이동인가 (22건)
node artifacts/failure/verify-m5-ui.mjs           # 전환→업로드→문구→비율 토글 (33건)
node artifacts/failure/verify-ratio-guard.mjs     # 비율 가드 회귀 (21건)
node artifacts/failure/run-gate.mjs               # M4 레퍼런스 수치 대조 (10건 + 프레임 13장)
node artifacts/failure/run-bench.mjs              # SC7 성능
node artifacts/m1/verify-*.mjs                    # 기존 템플릿 무변경
npx playwright test --config artifacts/m1/playwright.container.ts failure  # 2/5 그린
```

에셋 재생성:

```bash
node artifacts/failure/make-stamp.mjs   # fail-stamp.svg → fail-stamp.png
node scripts/generate-fail-sfx.mjs      # fail-thud.wav (고정 시드, 바이트 동일)
```

## 실기기에서 할 것

```bash
npm ci
npm run generate:editor-fixture
npx playwright test failure     # SC2~SC5 픽셀 단언 포함 5개 전부
```

실패하면 코드 결함일 가능성이 높다 — 컨테이너에서 컴포지션 프레임까지는 이미
실측으로 맞춰 뒀으므로, 실기기에서 새로 확인하는 것은 사실상 "이 프레임들이
H.264 MP4로 그대로 구워지는가" 하나다.

## 리스크 정리 (상세: Plan §7, Analysis 해당 절)

| | 요지 | 결과 |
|---|---|---|
| R-1 | 방향 축 확산 | 훅 파라미터화 + 슬롯 키 인코딩으로 한정됨. day1 커맨드 15종 무변경 |
| R-2 | 스탬프 품질·라이선스 | 폰트조차 쓰지 않는 손그림 패스 + 생성 텍스처. Analysis §3 |
| R-3 | 2.2× 확대의 업스케일 | 상한 2.2 고정. 실기기 실소재에서 확인 필요 |
| R-5 | 컨테이너 코덱 부재 | 위 우회로로 대부분 대체 검증, MP4 픽셀만 실기기 |
| R-6 → D-11 | 구간 1 하한 | refine 대신 창 압축 + 인스펙터 힌트. 유닛으로 전수 확인 |
| — | 신규 | FAIL 비트 ↔ 펀치 전환 겹침 (Analysis §9, 사용자 판단 대기) |
