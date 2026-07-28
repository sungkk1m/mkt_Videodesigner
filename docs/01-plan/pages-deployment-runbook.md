# GitHub Pages Deployment Runbook

> **Feature**: `browser-video-mvp`
> **Repository**: https://github.com/sungkk1m/mkt_Videodesigner
> **Target URL after deployment**: https://sungkk1m.github.io/mkt_Videodesigner/
> **Current status**: 기술적으로 배포 준비 완료. **라이선스 결정 대기 중이라 배포하지 않음.**
> **Date**: 2026-07-28

---

## 1. 왜 아직 배포하지 않았는가

배포를 막는 것은 기술 문제가 아니라 **Remotion 상용 라이선스 한 가지**입니다.

Remotion 공식 라이선스 원문(`node_modules/remotion/LICENSE.md`)의 Free License
자격 조건은 다음 네 가지이고, Superplanet은 어디에도 해당하지 않습니다.

| Free License 자격 | 우리 상황 |
|---|---|
| an individual | ❌ 회사 UA 크리에이티브 제작용 |
| a for-profit organization with **up to 3 employees** | ❌ 3명 초과 |
| a non-profit organization | ❌ |
| **evaluating** whether Remotion is a good fit, and **not yet using it in a commercial way** | ✅ **현재 여기에 해당** |

즉 지금은 "평가 중" 조항 하나로만 커버되고 있습니다. 사내 공용 URL에 올려 팀이
쓰기 시작하면 더 이상 "평가"가 아니므로 Company License가 필요합니다. 상세 근거는
[remotion-license-review.md](../03-analysis/browser-video-mvp.remotion-license-review.md)에 있습니다.

**이 결정은 회사 구매 건이라 개발자나 AI가 대신 처리할 수 없습니다.**

## 2. 선택지

| 선택 | 비용 | 작업량 | 결과 |
|---|---|---|---|
| **A. Company License 구매** (권장) | Remotion for Creators **$25/seat/월** (1석 ≈ 연 $300) | 코드 변경 없음 | 아래 3장 실행 → 즉시 배포 |
| **B. Remotion 제거 후 자체 렌더러** | $0 | 컴포지션·프리뷰·렌더 어댑터 재작성 (대규모) | 미리보기/렌더 동일성(설계 §1.1 목표 2) 보장이 어려워짐 |
| **C. 평가 상태 유지** | $0 | 없음 | 배포 불가. 로컬 `npm run dev`로만 사용 |

연 $300 대비 B의 재작성 비용이 훨씬 크므로 **A를 권장**합니다.
B를 택하더라도 도메인·에디터 UI는 그대로입니다. `VideoRenderer` 포트 뒤만
교체하면 되도록 설계되어 있습니다(설계 §9.2, 라이선스 리뷰 §8).

애매한 경계 사례라면 구매 전에 Remotion 측에 직접 확인하는 방법도 있습니다:
https://www.remotion.pro/faq

## 3. 라이선스 승인 후 배포 절차

### 3.1 라이선스 구매 (사용자 직접 수행)

1. https://www.remotion.pro/license 에서 **Remotion for Creators** 구매
2. 구매 주체는 **코드베이스를 소유·통제하는 법인**(Superplanet)이어야 합니다.
   개인 명의 라이선스는 조건을 충족하지 않습니다.
3. 좌석 수와 보유 주체를 기록

코드에 라이선스 키를 넣는 절차는 없습니다. `4.0.499`는 키 검증을 하지 않고,
`acknowledgeRemotionLicense` 속성은 이미 코드에 들어가 있습니다.

### 3.2 문서 게이트 해제

- `docs/03-analysis/browser-video-mvp.remotion-license-review.md`
  - §6 Current Position → 승인 상태로 갱신
  - §7 Trigger Conditions 체크박스 처리
  - 좌석 수·보유 주체·구매일 기록
- `docs/03-analysis/browser-video-mvp.module-2-benchmark.md`의 라이선스 게이트 행을
  Approved로 변경

### 3.3 저장소에서 Pages 활성화 (사용자 직접 수행)

GitHub → 저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions**

> 저장소 설정 변경이라 제가 임의로 하지 않습니다. 승인해 주시면 대신 실행할 수 있습니다.

### 3.4 배포 실행

```bash
gh workflow run deploy-pages.yml --repo sungkk1m/mkt_Videodesigner
```

또는 GitHub → **Actions → Deploy to GitHub Pages → Run workflow**.

워크플로는 `workflow_dispatch` 전용입니다. 라이선스 게이트가 닫혀 있는 동안
푸시만으로 배포되지 않도록 의도적으로 그렇게 두었습니다. 상시 배포로 바꾸려면
`.github/workflows/deploy-pages.yml`에 `push` 트리거를 추가하면 됩니다.

### 3.5 배포 후 확인

| 확인 항목 | 방법 |
|---|---|
| 앱 로드 및 새로고침 | https://sungkk1m.github.io/mkt_Videodesigner/ 접속 후 새로고침 |
| Hook 분석 Worker | 영상 업로드 → `Hook 후보 분석` 실행 |
| 실제 렌더 | `MP4 렌더` → 다운로드 파일 재생 |
| 자동 저장·복구 | 편집 후 새로고침 → 프로젝트 복원 및 재연결 패널 |
| 콘솔 오류 | DevTools Console 비어 있어야 함 |

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

### 남는 것

실제 `github.io` 호스팅에서만 확인 가능한 항목입니다.

1. **HTTPS 보안 컨텍스트** — Pages는 HTTPS라 WebCodecs/OPFS 요건은 충족되지만,
   실제 호스트에서 한 번 확인이 필요합니다.
2. **COOP/COEP 헤더 부재** — GitHub Pages는 응답 헤더를 설정할 수 없어
   cross-origin isolation이 불가능합니다. 로컬 검증 서버도 헤더를 보내지 않아
   같은 조건으로 맞췄고, 그 상태에서 렌더가 성공했습니다. 다만 Remotion이 향후
   `SharedArrayBuffer`를 요구하는 경로로 바뀌면 Pages로는 대응할 수 없고
   Cloudflare Pages 등 헤더 설정이 가능한 호스팅으로 옮겨야 합니다.
3. **모델 다운로드 경로** — Supertonic Beta 음성 생성은 아직 미검증입니다
   ([module-6 evidence](../03-analysis/browser-video-mvp.module-6-audio-tts.md) §4).
   배포 여부와 무관한 별도 항목입니다.
