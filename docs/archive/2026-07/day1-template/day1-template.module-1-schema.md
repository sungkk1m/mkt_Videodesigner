# Day1 Template — Module 1 Evidence: Schema v2 and Migration

> **Feature**: day1-template
> **Module**: 1 — 스키마 v2 (`sections` + `templateSettings`), v1→v2 마이그레이션, 저장·가져오기 적용
> **Date**: 2026-07-28
> **Design**: [day1-template.design.md](day1-template.design.md) §3, §11.3
> **완료 조건 (Design §11.3)**: 기존 E2E 17개 통과 — **충족**

---

## 1. What Shipped

Option C (Design §1.3 D9) 그대로다. 프로젝트가 템플릿 무관 시간축 `sections`와 템플릿별
페이로드 `templateSettings`로 갈라졌고, `schemaVersion`이 1에서 2로 올라갔다.

```ts
// before (v1)                    // after (v2)
{ scenes: [...],                  { sections: [{id,label,durationMs} ×3],
  source: MediaReference|null }     templateSettings:
                                      | {template:'three-scene', source, scenes}
                                      | {template:'day1', panelA, panelB, split,
                                         labelStyle, endCard} }
```

`durationMs`는 각 scene에서 떨어져 나와 `sections`로 올라갔다. 두 곳에 같은 값을
두면 어긋날 수 있어서 한 곳만 남겼다 (Design §3.1).

### 신규 파일

| 파일 | 내용 |
|------|------|
| [migrate.ts](../../../../src/domain/editor/migrate.ts) | `migrateProject()` — v1 승격, v2 통과, 그 외 `SCHEMA_UNSUPPORTED` |
| [migrate.test.ts](../../../../src/domain/editor/migrate.test.ts) | 13개 유닛. 왕복 무손실, 손상 문서 거부 |
| [project-v1.json](../../../../tests/fixtures/project-v1.json) | 모든 필드를 채운 실제 v1 문서 |
| [test/fixtures/project.ts](../../../../src/test/fixtures/project.ts) | 테스트용 `scenesOf`/`sourceOf`/`sectionDurations` |

### 회귀 방어선 — `threeSceneOf` 접근자

판별자 확인을 한 곳에 모았다 ([project.ts](../../../../src/domain/editor/project.ts)).

```ts
export const threeSceneOf = (project) =>
  project.templateSettings.template === 'three-scene'
    ? project.templateSettings : null;
```

소비자 60곳이 `project.scenes` → `threeSceneOf(project).scenes`로 기계적으로 바뀌었다.
세 장면 커맨드는 다른 템플릿을 만나면 프로젝트를 그대로 돌려준다 — 이 파일이 이미
쓰던 관용구(`toggleRenderLocale`, `setSourceStatus`)와 같다.

### 타임라인은 진짜로 무수정이 됐다

Design §1.2의 예측이 맞았다. `EditorScenes`에 묶여 있던 함수는 `sceneDurationsOf`
하나뿐이었고, 이것을 `sectionDurationsOf(sections)`로 바꾸자 경계 드래그·총길이
불변식·프레임 배분·프리셋이 전부 템플릿 무관이 됐다. `moveTimelineBoundary`는 이제
`templateSettings`를 아예 건드리지 않는다.

`Timeline.tsx`도 `sections`를 받고 `section.id`/`section.label`을 쓴다. 기존
`data-testid`(`timeline-clip-hook` 등)는 문자열이 동일해 그대로 유지됐다.

---

## 2. Verification

### Success Criteria

| # | 기준 | 결과 | 근거 |
|---|------|:----:|------|
| **SC3** | 기존 3장면 프로젝트가 회귀 없이 열리고 렌더된다 | ✅ | 기존 E2E 17개 전량 통과(실제 MP4 렌더 포함) + v1 JSON 가져오기 E2E 신규 통과 |
| **SC6** | 유닛·E2E 전부 통과, 타입체크·빌드 통과 | ✅ (모듈 범위) | 아래 표 |

```
npm test          183 passed (22 files)   — 기존 164 + 신규 19
npx tsc -b        0 errors
npm run build     built in 186ms
npx playwright    18 passed               — 기존 17 + v1 가져오기 1
```

### 마이그레이션 무손실 증명

`project-v1.json`은 빈 기본값이 아니라 실제로 쓰인 문서다. per-ratio override,
`fade`/`zoom` 전환, hook `emphasizedText`, CTA 앱아이콘, BGM, 2개 언어 카피,
비대칭 구간 길이(2500/9500/3000)를 담았다. 테스트는 v1의 모든 scene 필드를
`durationMs` 하나만 뺀 채 v2와 deep-equal로 비교한다 — 필드가 하나라도 새면 실패한다.

### v1 가져오기 E2E (Plan SC3)

[persistence-recovery.spec.ts](../../../../tests/e2e/persistence-recovery.spec.ts) —
실제 가져오기 UI로 v1 파일을 열어 확인한다.

- 구간 길이 2.5 / 9.5 / 3.0초가 타임라인에 그대로 (scene → section 이동 성공)
- Trim In 1.00초, 자막 위치 `top` (per-scene 설정 보존)
- 4언어 카피 ko/en 모두 보존
- 소스는 `missing` — 가져오기 후 relink가 담당하는 기존 동작 유지

### 실행 중인 앱 확인

dev 서버에서 직접 확인했다. 3개 클립이 정상 렌더, 30초 프리셋 클릭 시
3.0/24.0/3.0초로 재배분(`applyDurationPreset` → sections 경로), 자동저장이 v2 문서로
"저장됨". 템플릿 미지원 안내는 뜨지 않는다.

---

## 3. Design Deviations

| 항목 | Design | 실제 | 사유 |
|------|--------|------|------|
| FR-D03 (패널 소스 누락 시 렌더 차단) | §3.5 불변식 표에 기재 | 스키마가 아닌 렌더 preflight에 배치 | 업로드 도중 프로젝트가 저장되지 않으면 자동저장이 깨진다. §7 `RENDER_PREFLIGHT_FAILED`가 원래 이 역할이고, 스키마 주석에 근거를 남겼다 |
| Timeline 시그니처 | "무수정 재사용" | props가 `scenes`→`sections`, `selectedKind`→`selectedId`로 변경 | 도메인 로직은 실제로 무수정이다. props 이름만 템플릿 무관으로 바꿨고 `data-testid`는 전부 동일하다 |
| `applyDurationPreset` | — | Day1도 3장면 테이블을 쓴다 | `day1SectionDurations`는 module-2 범위다. Day1 프로젝트는 아직 UI로 만들 수 없어 도달 불가. module-2에서 분기 추가 |

### 남긴 경계

Day1 편집 UI는 module-5까지 없다. 그 사이 손으로 만든 Day1 JSON이 들어오면
`EditorWorkspace`가 안내 문구(`template-unsupported`)를 띄우고 원본을 건드리지
않는다. 스키마는 Day1 페이로드를 이미 완전히 검증하며 유닛 테스트 6개가 붙어 있다.

---

## 4. Next

```bash
/pdca do day1-template --scope module-2,module-3
```

module-2 착수 전 준비물 (Design §11.4):
- [ ] `tests/fixtures/gameplay-sample-b.mp4` — 첫 번째와 눈에 띄게 다른 두 번째 소스
