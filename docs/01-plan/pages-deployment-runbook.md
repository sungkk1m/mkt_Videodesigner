# GitHub Pages Deployment Runbook

> **Feature**: `browser-video-mvp`
> **Repository**: https://github.com/sungkk1m/mkt_Videodesigner
> **Live URL**: https://sungkk1m.github.io/mkt_Videodesigner/
> **Current status**: **배포 완료 (2026-07-28).** Free License 평가 조항 근거.
> 캠페인 실사용 전 Company License 구매 필요.
> **Date**: 2026-07-28

---

## 1. 현재 라이선스 근거

**2026-07-28 결정: Free License의 "평가 중" 조항으로 배포하고, 검증 후 Company
License 구매를 검토합니다.**

Remotion 공식 라이선스는 자격을 **호스팅 여부가 아니라 상업적 사용 여부**로
가릅니다. 평가 목적의 배포는 조항 안에 있습니다. 다만 Superplanet에 해당하는
자격은 네 가지 중 "평가 중" 하나뿐이므로, 아래 경계가 유지되어야 합니다.

| 유지되어야 하는 조건 |
|---|
| 렌더된 MP4를 실제·유료 UA 캠페인에 사용하지 않음 ← 실질적 기준선 |
| 사용 범위가 "이 도구가 적합한지 검증"에 머무름 |
| 평가에 끝이 있고 구매 판단으로 이어짐 |
| 첫 캠페인 사용 전에 Company License 구매 |

이 중 하나라도 깨지면 유료 라이선스가 필요합니다 (Remotion for Creators
$25/seat·월). 상세 근거: [remotion-license-review.md](../03-analysis/browser-video-mvp.remotion-license-review.md) §6.

## 1-1. 참고: Free License 자격 기준

Remotion 공식 라이선스 원문(`node_modules/remotion/LICENSE.md`)의 Free License
자격 조건은 네 가지이고, Superplanet은 그중 하나에만 해당합니다.

| Free License 자격 | 우리 상황 |
|---|---|
| an individual | ❌ 회사 UA 크리에이티브 제작용 |
| a for-profit organization with **up to 3 employees** | ❌ 3명 초과 |
| a non-profit organization | ❌ |
| **evaluating** whether Remotion is a good fit, and **not yet using it in a commercial way** | ✅ **현재 근거** |

기준은 호스팅 여부가 아니라 상업적 사용 여부입니다. 평가 목적의 배포는 조항
안이지만, 렌더 결과물을 실제 캠페인에 쓰는 순간 벗어납니다.

## 2. 검증 이후 선택지

| 선택 | 비용 | 작업량 | 결과 |
|---|---|---|---|
| **A. Company License 구매** (권장) | Remotion for Creators **$25/seat/월** (1석 ≈ 연 $300) | 코드 변경 없음 | 캠페인 실사용 가능 |
| **B. Remotion 제거 후 자체 렌더러** | $0 | 컴포지션·프리뷰·렌더 어댑터 재작성 (대규모) | 미리보기/렌더 동일성(설계 §1.1 목표 2) 보장이 어려워짐 |
| **C. 도구 미채택** | $0 | 없음 | 평가 종료, 배포 내림 |

연 $300 대비 B의 재작성 비용이 훨씬 크므로 채택 시 **A를 권장**합니다.
B를 택하더라도 도메인·에디터 UI는 그대로입니다. `VideoRenderer` 포트 뒤만
교체하면 되도록 설계되어 있습니다(설계 §9.2, 라이선스 리뷰 §8).

경계가 애매한 사례는 Remotion 측에 직접 확인할 수 있습니다:
https://www.remotion.pro/faq

구매 자체는 회사 결정 사항이며 개발자나 AI가 대신 처리하지 않습니다.

## 3. 배포 절차

### 3.1 Company License 구매 (캠페인 실사용 전, 사용자 직접 수행)

1. https://www.remotion.pro/license 에서 **Remotion for Creators** 구매
2. 구매 주체는 **코드베이스를 소유·통제하는 법인**(Superplanet)이어야 합니다.
   개인 명의 라이선스는 조건을 충족하지 않습니다.
3. 좌석 수와 보유 주체를 라이선스 리뷰 문서에 기록

코드에 라이선스 키를 넣는 절차는 없습니다. `4.0.499`는 키 검증을 하지 않고,
`acknowledgeRemotionLicense` 속성은 이미 코드에 들어가 있습니다.

### 3.2 구매 후 문서 게이트 해제

- `docs/03-analysis/browser-video-mvp.remotion-license-review.md`
  - §6 Current Position → 승인 상태로 갱신
  - §7 Trigger Conditions 체크박스 처리
  - 좌석 수·보유 주체·구매일 기록
- `docs/03-analysis/browser-video-mvp.module-2-benchmark.md`의 라이선스 게이트 행을
  Approved로 변경

### 3.3 저장소에서 Pages 활성화 — 완료 (2026-07-28)

GitHub → 저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions**

동등한 CLI:

```bash
gh api -X POST repos/sungkk1m/mkt_Videodesigner/pages -f 'build_type=workflow'
```

### 3.4 배포 실행 — 완료 (2026-07-28)

```bash
gh workflow run deploy-pages.yml --repo sungkk1m/mkt_Videodesigner
```

또는 GitHub → **Actions → Deploy to GitHub Pages → Run workflow**.

**2026-08-26 갱신: 워크플로는 더 이상 `workflow_dispatch` 전용이 아닙니다.**
라이선스 리뷰 §6·§7이 "배포 자체는 트리거가 아니다"로 정리되면서
`.github/workflows/deploy-pages.yml`에 `push: branches: [main]` 트리거가 들어갔고,
`docs/**`·`.bkit/**`·`**.md`만 바뀐 커밋은 `paths-ignore`로 건너뜁니다. 즉
**앱 코드가 담긴 커밋이 main에 올라가면 자동 배포**되며, 위 수동 실행은 재배포가
필요할 때만 씁니다. 배포 잡은 `npm test` → `npm run build`를 먼저 통과해야
진행하므로 붉은 스위트는 라이브 URL에 도달하지 못합니다.

### 3.5 배포 후 확인 — 자동화됨

```bash
npm run verify:deployment
```

실제 Chrome으로 라이브 사이트를 구동해 HTTPS 보안 컨텍스트, capability probe,
업로드, Hook Worker, 실제 MP4 렌더·다운로드, 자동 저장·새로고침 복구를 확인하고
실패 요청·콘솔 오류 수를 출력합니다. 다른 URL은 `DEPLOY_URL` 환경변수로 지정합니다.

2026-07-28 실행 결과: 전 항목 PASS, 실패 요청 0, 콘솔 오류 0.

### 3.6 배포 기록

| 일시(UTC) | 커밋 | 내용 | 워크플로 | 라이브 스모크 |
|---|---|---|---|---|
| 2026-07-28 | — | 최초 배포 | 수동 dispatch, success | 전 항목 PASS |
| 2026-08-26 07:15 | `86409dd` | day1-label-effects (라벨 배경 박스·글로우) | push 자동 배포, build+deploy 모두 success (CI `32941842966`도 success) | 미실행 — 아래 주의 |
| 2026-08-26 14:08 | `3e9f0d0` | day1-label-effects Iteration 2 (텍스트 박스 글로우) | push 자동 배포, build+deploy 모두 success (run `32978443625`) | 미실행 — 아래 주의 |

2026-08-26 배포는 main 병합 푸시로 자동 실행됐고, build 잡의 `npm test`(유닛 588)와
`npm run build`를 통과한 뒤 `actions/deploy-pages@v4`가 성공했습니다.
`npm run verify:deployment`는 이 세션의 컨테이너에서 실행할 수 없었습니다 — 스크립트가
채널 `chrome`(H.264 포함)을 요구하는데 없고, 컨테이너의 아웃바운드 프록시가
`sungkk1m.github.io`로의 CONNECT를 403으로 막습니다. **실 Chrome이 있는 로컬에서
`npm run verify:deployment` 한 번 실행**해 라이브 스모크를 마감하는 것이 남았습니다.

## 4. 이미 검증된 것 / 남는 것

### 검증 완료

서브패스 배포 레이아웃은 **실제 프로덕션 번들로 로컬 검증했습니다.**
`tests/e2e/pages-subpath.spec.ts`가 `dist/`를 `/mkt_Videodesigner/` 경로 아래에
서빙하고 다음을 확인합니다.

- 진입 문서 로드와 새로고침
- 모든 script/link가 루트 절대경로(`/assets/...`)가 아닌 상대경로로 해결
- Hook 분석 **Worker 청크** 정상 동작 (서브패스에서 가장 깨지기 쉬운 부분)
- 프로덕션 번들에서 실제 MP4 렌더와 다운로드
- 실패한 네트워크 요청 0건, 콘솔 오류 0건

```bash
npm run test:e2e -- tests/e2e/pages-subpath.spec.ts
```

로컬 미리보기만 필요하면:

```bash
npm run serve:pages-preview   # http://127.0.0.1:4190/mkt_Videodesigner/
```

라이브 배포에서도 동일 항목을 확인했습니다 (`npm run verify:deployment`,
2026-07-28): HTTPS 보안 컨텍스트, capability probe `대기`, Hook 후보 5건,
실제 MP4 렌더 `ua-video_ko_9x16_15s_60fps.mp4`, 새로고침 복구, 실패 요청 0.

**주요 확인: GitHub Pages에 COOP/COEP 헤더가 없어도 렌더가 동작합니다.** Pages를
호스트로 쓸 때 가장 큰 미지수였는데, cross-origin isolation 없이 15초 1080p60
렌더가 완료됐습니다.

### 남는 것

1. **Supertonic Beta 음성 생성** — 여전히 미검증입니다
   ([module-6 evidence](../03-analysis/browser-video-mvp.module-6-audio-tts.md) §4).
   배포와 무관한 별도 항목이며, 업로드 음성이 검증된 경로입니다.
2. **향후 Remotion이 `SharedArrayBuffer`를 요구하는 경로로 바뀌는 경우** — Pages는
   응답 헤더를 설정할 수 없어 대응이 불가능하고, Cloudflare Pages 등으로 이전해야
   합니다. 현재 `4.0.499`에서는 문제되지 않습니다.
3. **공개 URL** — 저장소와 Pages 모두 public입니다. 사내 전용이 필요하면 저장소를
   private으로 전환(Pages는 GitHub Pro/Team 이상 필요)하거나 접근 제어가 가능한
   호스팅으로 옮겨야 합니다.
