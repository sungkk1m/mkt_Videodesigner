# 2026-08-26 — kv-object-animation 핸드오프 (M4·M5 착수)

> 다음 세션이 이 문서 하나로 맥락을 복원할 수 있도록 남긴다. 갱신: M0~M3 완료 시점.

## 현재 상태 — 브랜치 `claude/key-visual-looping-effect-dcqxo6`

| 단계 | 상태 | 커밋 |
|---|---|---|
| Plan (D-01~D-06 확정) + Design | ✅ | `74b084b` |
| M0 — 결정론 캔버스 스파이크 5/5 PASS | ✅ | `5ec5ab4` · 증거 [m0-canvas-spike](../03-analysis/kv-object-animation.m0-canvas-spike.md) |
| M1 — 스키마·도메인(`effects.ts`)·커맨드 | ✅ | `81791df` · 유닛 610 그린 |
| M2 — `KvEffectsCanvas` + `KvScene` 통합 (카메라 추종) | ✅ | `432f538` · 프로덕션 경로로 M0 하네스 재실행 5/5 동일 |
| M3 — 인스펙터 이펙트 섹션 + `KvEffectOverlay` (드래그 지정) | ✅ | `6ecca2b` |
| M4 — 레퍼런스 실측으로 기본값 교정 | ✅ | 실측·교정 완료 — [m4-reference-measurement](../03-analysis/kv-object-animation.m4-reference-measurement.md). density 0.2 · speed 0.4(TRAVEL 0.03/0.32) · sizePx 8 · periodMs 1300 · glow center (0.5, 0.74). 계수 변경 후 하네스 5/5 PASS 동일 수치, 유닛 614 그린 |
| **M5 — 실기기 렌더 게이트** | ⬜ 렌더 대기 | SC1~SC7 + 성능 게이트(M0 참고치: transform 하 ≈19~25ms/프레임). 절차: [kv-object-animation.m5-runbook](../01-plan/kv-object-animation.m5-runbook.md) — **Pages가 브랜치 빌드 `cd4de89`를 서빙 중**(run 33029140338). 이펙트 on/off 두 벌 렌더 mp4를 세션에 업로드하면 프레임 실측으로 판정. 통과 시 리포트 → main 병합 → Pages 원복 |

주의사항: 이 컨테이너에는 H.264가 없어 스파이크 렌더는 VP9로 한다. 소재는
서버로 보내지 않는다는 앱의 약속 유지. `Math.random()` 금지 — 시드는 생성
시 1회만(이미 커맨드에 구현됨).

## 다음 세션 프롬프트 (복사용 — 실기기 렌더 mp4 2개 첨부와 함께)

```
/bkit:pdca do kv-object-animation

kv-object-animation의 M5 판정을 진행합니다. 먼저 읽어주세요:
- docs/00-history/2026-08-26-kv-object-animation-handoff.md (현재 상태 표)
- docs/01-plan/kv-object-animation.m5-runbook.md (렌더 절차·게이트 기준)
- docs/03-analysis/kv-object-animation.m4-reference-measurement.md (기본값 근거)

브랜치 claude/key-visual-looping-effect-dcqxo6에 M0~M4가 커밋·푸시돼
있습니다 (HEAD cd4de89, Pages가 이 빌드를 서빙 중). 첨부한 실기기 렌더
(이펙트 on/off 두 벌, 각 렌더 소요 시간은 본문에 적음)로:

1. SC1~SC7과 성능 게이트(on/off 시간 차 5% 이내, D-05)를 프레임 실측으로
   판정해주세요. 방법 전례: artifacts/kv-obj-m4/의 스캔·분석 파이프라인.
2. 통과 시 리포트 작성 → main 병합 → Pages 원복(런북 §5)까지.
   미달 항목이 있으면 원인 분해와 수정 커밋 후 재판정 준비까지.
```
