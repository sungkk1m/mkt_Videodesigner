# failure-video 인수인계 — 2026-08-28

새 세션에서 이 사이클을 이어받을 때 필요한 것만 적었다. 전체 맥락은
[Plan](../01-plan/features/failure-video.plan.md) ·
[Design](../02-design/features/failure-video.design.md)에 있다.

## 지금 상태

- 브랜치 `claude/failure-video-template-plan-poq31c`, 전부 푸시됨. PR 없음(요청되지 않음).
- PDCA: **Plan 완료 · Design 완료(Draft) — Do 대기.** 코드는 한 줄도 바뀌지 않았다.
- 레퍼런스 영상(사용자 업로드 mp4, 360×640 @30fps, 50s)은 컨테이너 세션의
  `/root/.claude/uploads/...`에 있었다 — **새 세션에는 없다.** 실측 결과(구간 구조·FAIL
  타이밍·전환·캡션 기하·오디오 스파이크)는 Plan §1에 수치로 박제해 뒀으므로 Do에는 원본이
  필요 없다. 스탬프 대조 스크린샷(M4 게이트)이 필요해지면 사용자에게 재업로드를 요청할 것.
- 사용자 확정 결정 4건(Q1-Q4)은 Plan §2에, 설계 결정 12건(D-0~D-11)은 Design §13에 있다.
  **뒤집을 때는 사용자 확인이 먼저다.**

## Do 착수 순서 (Design §11)

M1(공통 경로, failure 코드 0줄) → M2(스키마·상수) → M3(도메인 효과 함수) → M4(에셋+컴포지션)
→ M5(UI) → M6(렌더·프록시) → M7(검증·analysis 문서). 각 모듈의 산출물·게이트 표가 Design §11에,
Do 진입 체크리스트가 §11.1에 있다. quad의 교훈(공통 경로 선행, `SELECTABLE_TEMPLATES` 임시 가드)이
M1·M2에 반영돼 있으니 순서를 바꾸지 말 것.

## 이 환경에서 막히는 것 (day1-quad 인수인계에서 검증된 사실)

원격 컨테이너의 Chromium에 **H.264 인코더·디코더가 없다.** MP4 업로드/렌더 E2E는 전부 환경
실패한다. 우회로:

```bash
# ffmpeg/ffprobe를 PATH에 (npm 패키지; 컨테이너에 ffmpeg 없음)
mkdir -p /tmp/bin
node -e "const fs=require('fs');fs.writeFileSync('/tmp/bin/ffmpeg','#!/bin/sh\nexec '+require('ffmpeg-static')+' \"\$@\"\n');fs.writeFileSync('/tmp/bin/ffprobe','#!/bin/sh\nexec '+require('ffprobe-static').path+' \"\$@\"\n')"
chmod +x /tmp/bin/ffmpeg /tmp/bin/ffprobe && export PATH=/tmp/bin:$PATH

npm ci && npm run generate:editor-fixture
npm run dev -- --host 127.0.0.1 --port 4173 &
npx playwright test --config artifacts/m1/playwright.container.ts   # 컨테이너 Chromium용 설정
```

렌더가 필요 없는 UI 검증은 이 환경에서 돈다(`artifacts/m1/verify-*.mjs` 선례). MP4 픽셀 단언
(Design §8.2의 ①~⑤)은 실기기 Chrome 몫으로 남는다 — quad와 동일한 분업.

## 새 세션 착수 프롬프트

아래를 그대로 새 세션에 붙여 넣으면 된다:

> failure-video 사이클의 Do 단계를 시작하세요.
>
> 1. 먼저 `docs/01-plan/features/failure-video.plan.md`와
>    `docs/02-design/features/failure-video.design.md`, 그리고
>    `docs/00-history/2026-08-28-failure-video-plan-design-handoff.md`를 정독하세요.
>    Design이 유일한 사양입니다 — 결정 D-0~D-11과 사용자 확정 Q1-Q4는 뒤집지 말고,
>    구현 중 Design과 어긋나는 발견은 코드에 우기지 말고 문서에 기록 후 사용자에게 물어보세요.
> 2. 브랜치 `claude/failure-video-template-plan-poq31c`에서 Design §11의 모듈 순서대로
>    구현하세요: M1(공통 경로 — failure 코드 0줄: Day1Inspector에서 PanelSection·EndCardSection
>    순수 추출, useDay1Assets 슬롯 파라미터화, 엔드카드 커맨드 narrower 교체, 파일명·라벨) →
>    M2(스키마 arm·상수·switchTemplate — SELECTABLE_TEMPLATES 임시 가드 포함) →
>    M3(domain/failure 효과 순수 함수 + 커맨드) → M4(스탬프 PNG·SFX wav 에셋 제작 +
>    FailureComposition) → M5(FailureInspector·에셋 패널·가드 해제) → M6(렌더·프록시 arm) →
>    M7(검증 + docs/03-analysis/failure-video.analysis.md).
> 3. 각 모듈이 끝날 때마다 해당 게이트(Design §11 표)를 실행하고 커밋하세요.
>    검증 명령: `npm test` · `npm run build` · E2E는 인수인계 문서의 컨테이너 우회로.
>    이 컨테이너에는 H.264 코덱이 없어 MP4 렌더 E2E는 실기기 몫입니다 — 실패를 코드 결함으로
>    오판하지 마세요.
> 4. M4의 스탬프는 레퍼런스에서 추출하지 말고 재창작하세요(OFL/CC0 폰트 + 자체 텍스처,
>    근거 SVG 커밋). 완성되면 Plan §1.2의 실측 수치와 대조한 스크린샷을 만들어 사용자 리뷰를
>    요청하세요 — 이것이 M4 게이트입니다.
> 5. 전 모듈 완료 후 커밋·푸시하고, 검증된 것/안 된 것을 나눠 보고하세요. PR은 사용자가
>    요청할 때만 만드세요.

## 리스크 요약 (상세: Plan §7, Design 해당 절)

| | 요지 | 대응 절 |
|---|---|---|
| R-1 | 방향 축 확산 | Design §2.3 D-0, §7.3 — 훅 파라미터화로 한정 |
| R-2 | 스탬프 품질·라이선스 | Design §6.4 — M4 대조 스크린샷 게이트 |
| R-5 | 컨테이너 코덱 부재 | 위 우회로, 실기기 분업 |
| D-11 | Plan R-6(구간 1 하한 refine)을 **창 압축으로 대체** — 드래그로 만든 합법 상태가 파싱 불가가 되는 것을 막기 위해 | Design §6.2 |
