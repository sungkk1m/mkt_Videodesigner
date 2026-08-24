# day1-quad 인수인계 — 2026-08-24

새 세션에서 이 사이클을 이어받을 때 필요한 것만 적었다. 전체 맥락은
[Plan](../01-plan/features/day1-quad.plan.md) ·
[Design](../02-design/features/day1-quad.design.md) ·
[Report](../04-report/day1-quad.report.md) ·
[M0 분석](../03-analysis/day1-quad.m0-perf-gate.md)에 있다.

## 지금 상태

- 브랜치 `claude/day1-4-video-template-x2wrir`, `main` 대비 커밋 40+. 전부 푸시됨.
- PDCA: Plan·Design 완료, Do M0~M7 완료, **Check 완료 — PR 작성 대기**.
- 유닛 **575/575**, `tsc -b` + `vite build` 통과.
- E2E 전량 1회 실행 완료(2026-08-24, 20.2분): **31 통과 / 49 실패 / 2 스킵**.
  실패 49건을 전부 추적했고 **코드 결함은 없다** — 47건은 H.264 디코더 부재,
  2건은 픽스처 생성 실패(`libsvtav1` 없음). 상세는
  [Report §2.2](../04-report/day1-quad.report.md).
- `main`에는 아직 병합하지 않았다. 병합하면 Pages 워크플로가 자동 배포한다.

## 이 환경에서 막히는 것 (중요)

원격 컨테이너의 Chromium에 **H.264 인코더도 디코더도 없다.** 실제 Chrome 설치는
네트워크 정책이 `dl.google.com`을 막아 불가능하다. 그래서:

- MP4를 업로드하거나 렌더하는 E2E는 전부 실패한다. 앱이
  "Chrome이 이 영상을 열지 못했습니다 (H.264 (avc1))"로 정확히 거부한다 — 코드
  결함이 아니라 환경 한계다.
- M0 성능 게이트의 1.15배는 VP9로 대체 측정한 **상대 비율**이다. 절대값은
  기존 문서의 17.0초 기준선과 비교할 수 없다.

우회로 확보해 둔 것:

```bash
# 실제 ffmpeg/ffprobe를 PATH에 올린다 (npm 패키지, 컨테이너에 ffmpeg 없음)
mkdir -p /tmp/bin
node -e "const fs=require('fs');fs.writeFileSync('/tmp/bin/ffmpeg','#!/bin/sh\nexec '+require('ffmpeg-static')+' \"\$@\"\n');fs.writeFileSync('/tmp/bin/ffprobe','#!/bin/sh\nexec '+require('ffprobe-static').path+' \"\$@\"\n')"
chmod +x /tmp/bin/ffmpeg /tmp/bin/ffprobe
export PATH=/tmp/bin:$PATH

npm run generate:editor-fixture     # H.264 픽스처 생성 (AV1 하나만 실패, 코덱 호환 스펙 전용)
npm run dev -- --host 127.0.0.1 --port 4173 &

# 이 컨테이너의 Chromium으로 E2E를 돌리는 설정 (committed config는 real Chrome을 요구한다)
npx playwright test --config artifacts/m1/playwright.container.ts
```

브라우저 UI 검증 스크립트는 `artifacts/m1/`에 있고 전부 통과한다:
`verify-quad-ui.mjs`(12항목) · `verify-panel-move.mjs`(추출 무결성) ·
`verify-endcard-length.mjs` · `verify-dropdown.mjs` · `check-saturation.mjs`.
이들은 렌더가 필요 없어서 이 환경에서 돈다.

## E2E 실행으로 검증된 것 / 여전히 안 된 것

| | 상태 |
|---|---|
| 선택기 드롭다운 + `switchTemplate` 헬퍼 | **검증됨** — `timeline-axis`·`kv-loop`·`kv-motion`·`debug-report` 등 20개 이상이 이 헬퍼로 전환하며 통과 |
| 4분할 UI (5구간·프리셋·60초 경고·인스펙터 4섹션·라벨 16칸) | **검증됨** |
| Day1 무변경, 3템플릿 시간축·3방향 전환 | **검증됨** |
| MP4 렌더 전량 (SC1·SC3·SC4) | **미검증** — 실제 Chrome 필요 |
| 파일명 단정 8곳 | **미검증** — 전부 업로드가 선행되는 스펙 안 |
| 1.15배 게이트의 절대값 | **미검증** — M0 §6.1 재측정 필요 |

## E2E가 잡아낸 것 — 유닛 570개가 못 잡던 결함 3건

1. **`useMediaSession.retain`이 패널 A·B만 유지** → 4분할에서 세 번째 영상을
   올리는 순간 앞의 둘이 해제돼 네 패널이 전부 "연결 필요"로 떨어졌다. (M5에서 수정)
2. **렌더 프리플라이트가 `template === 'day1'`로 막혀 4분할에 아예 안 돌았다** →
   패널이 비어도 렌더가 시작된다. (수정 완료, 회귀 테스트 5개)
3. **차단 문구 하드코딩** — "영상 2개를 모두 올려야… 남은 패널: A · B · C · D". (수정 완료)

## 남은 작업

| # | 할 일 | 비고 |
|---|---|---|
| 0 | **PR 생성** | 이 저장소에 PR 템플릿은 없다. 본문에 검증된 것/안 된 것을 나눠 적을 것 |
| 1 | **실제 Chrome에서 E2E 전량 실행** | 남은 검증. SC1(3규격 MP4)·SC3(MP4의 흑백)·SC4(분할선 픽셀)·파일명 단정 8곳 |
| 2 | **M0 게이트 재측정** | 절차는 M0 분석 §6.1. 코덱 두 줄 교체 + 소스 경로. `M0_REPEATS=3` 권장 |
| 3 | 계획서의 1.15배를 실제값으로 갱신 | 2번 결과가 나온 뒤 |
| 4 | `main` 병합 → Pages 배포 | `docs/**`·`**.md`만 바뀐 커밋은 워크플로가 스킵한다 |
| 5 | 후속 사이클 후보: 블러 배경 굽기 | Day1 렌더 시간 절반. 픽셀 동일성 검증 필요 (Plan §2.12) |

## 뒤집지 말 것

- Plan §8의 결정 15건 (Q1~Q14). 특히 Q4(`contain` 기본), Q10(Day1 렌더 출력 무변경).
- Design D-0~D-4. 특히 D-0(패널을 배열이 아니라 이름 키로) — 명령 15종 재사용이 여기 달려 있다.
- `PROJECT_SCHEMA_VERSION`은 2. 마이그레이션 코드를 쓰지 않는다.
- `day1EndCardSchema`의 `.default()`들. 그게 저장된 문서의 마이그레이션 전략이다.
