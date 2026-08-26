# 2026-08-26 — kv-object-animation 착수 핸드오프

> 다음 세션이 이 문서 하나로 맥락을 복원할 수 있도록 남긴다.
> kv-loop-reference-motion 사이클(왕복·컷·블러 북엔드)은 **완료·main 병합**됐다.

## 지금까지의 사실

- 레퍼런스(언더다크 모닥불 루핑)와의 남은 체감 차이는 **정적 원화 위에
  오브젝트별로 걸린 애니메이션**(불티 파티클, 글로우 펄스) 한 층이다 —
  [reference-measurement §3](../03-analysis/kv-loop-reference-motion.reference-measurement.md)에서
  증폭 diff로 실측했다.
- 요청자 확정: **오브젝트를 AI 혹은 사용자가 직접 지정해 이펙트를 거는 것이
  루핑 템플릿의 최종 목표**다.
- Draft Plan이 이미 있다:
  [kv-object-animation.plan.md](../01-plan/features/kv-object-animation.plan.md) —
  지정 두 경로(직접/AI 제안), 이펙트 후보 3종, 렌더 경로 근거(web-renderer의
  canvas 래스터화 실측), 결정 항목 D-01~D-06.
- 방법론 전례: kv-loop-reference-motion은 M0 스파이크로 렌더 경로를 먼저
  실증하고, 실측 게이트로 판정하고, 기본값을 레퍼런스에서 쟀다. 같은 방식으로
  간다. 스파이크 하네스 전례는 `artifacts/kv-m0/`.
- 주의 둘: `Math.random()`은 미리보기와 렌더가 다른 프레임을 낸다(오브젝트별
  고정 시드 필요). 이 앱의 약속상 소재는 서버로 가지 않는다(AI 지정은
  온디바이스 기본, 외부 API는 옵트인).

## 다음 세션 프롬프트 (복사용)

```
/bkit:pdca plan kv-object-animation

키비주얼 루핑의 다음 사이클을 시작합니다. Draft Plan이 이미 있습니다:
docs/01-plan/features/kv-object-animation.plan.md — 먼저 이 문서와
docs/00-history/2026-08-26-kv-object-animation-handoff.md 를 읽어주세요.

목표: 정적 키비주얼 위의 오브젝트를 AI 혹은 제가 직접 지정하고, 지정한
오브젝트에 이펙트(파티클, 글로우 펄스 등)를 걸어 언더다크 레퍼런스의
마지막 층을 재현하는 것.

이번 세션에서 할 일:
1. Draft Plan의 결정 항목 D-01~D-06을 저와 함께 확정
2. 확정되면 Plan을 Draft에서 승격하고 Design 문서 작성
3. M0 스파이크(결정론 캔버스 파티클 레이어의 렌더 실증)까지 진행

이전 사이클과 같은 방식으로: 스파이크로 렌더 경로 먼저, 수치 게이트로
판정, 기본값은 실측에서. 브랜치는 새로 파주세요.
```

## 원상태 스냅샷 (병합 시점)

- 라이브 Pages = main (원복 완료)
- `.bkit/state/pdca-status.json`: kv-loop-reference-motion `completed`,
  kv-object-animation `plan`(draft)
