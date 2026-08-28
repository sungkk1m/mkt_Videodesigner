# mkt_videodesigner

**https://sungkk1m.github.io/mkt_Videodesigner/**

Chrome에서 서버 없이 UA 영상을 편집하고 다국어·다비율 MP4를 만드는 정적 웹 앱입니다.
템플릿 3종을 지원합니다 — **Day1**(Before/After 분할 비교, 영상 2개 + 엔드카드),
**Day1(4 video)**(2×2 그리드, 영상 4개 + 엔드카드), **키비주얼 루핑**(이미지 반복,
9:16 전용). 새 프로젝트는 Day1으로 시작합니다.

업로드한 영상과 문구는 애플리케이션 서버로 전송되지 않습니다. 편집, 미리보기,
렌더, 저장이 모두 브라우저 안에서 끝납니다.

## Requirements

- 최신 데스크톱 Chrome (WebCodecs, H.264/AAC 인코딩, OPFS 필요)
- Node.js 22 이상
- 최소 뷰포트 1280×720
- E2E 검증에는 `ffmpeg` / `ffprobe` 필요

## Commands

```bash
npm install
npm run generate:editor-fixture   # 최초 1회: E2E 미디어 픽스처 생성 (gitignored)
npm run dev            # 개발 서버
npm test               # 유닛 테스트 (Vitest)
npm run build          # 타입체크 + 프로덕션 빌드
npm run test:e2e       # 실제 Chrome 렌더 포함 E2E (Playwright)
```

렌더 벤치마크는 `npm run benchmark:render`, 모듈 2 PoC 화면은 `#render-poc`
해시로 접근합니다.

## What It Does

공통 기능:

| 영역 | 기능 |
|------|------|
| 타임라인 | 템플릿별 고정 구간, 15/30/60초 프리셋, 경계 드래그 시 총 길이 불변 |
| 프레이밍 | Cover/Contain + Scale/X/Y, 비율별 프레이밍 override |
| 렌더 | Fast/Standard/High 프로필, 30/60fps, 9:16·1:1·16:9 |
| Batch | 언어 × 비율 최대 12개 순차 렌더, 취소·실패 재시도, 폴더 저장 또는 다운로드 |
| 저장 | IndexedDB 자동 저장과 새로고침 복구, JSON 내보내기·가져오기 |

템플릿별 기능:

| 영역 | Day1 | Day1(4 video) | 키비주얼 루핑 |
|------|------|---------------|---------------|
| 소재 | 영상 2개 (둘 다 필수), 엔드카드 배너·앱아이콘 | 영상 4개 (전부 필수), 엔드카드는 Day1과 동일 | 이미지 2~8장, 타이틀 오버레이 |
| 구간 | 패널 A · 패널 B · 엔드카드 | 패널 A~D · 엔드카드 | 키비주얼 1장당 1구간 |
| 길이 | 15 · 30 · 60초 | **15 · 30초** | 15 · 30 · 60초 |
| 규격 | 9:16 · 1:1 · 16:9 | 9:16 · 1:1 · 16:9 | **9:16 전용** |
| 문구 | 4언어 패널 라벨 A·B | 4언어 패널 라벨 A~D (기본 `Day1`~`Day7`) | 4언어 하단 고지문구 |
| 고유 | 활성 패널만 재생 + 비활성 흑백 정지, 분할선 색·두께(스포이트) | 2×2 그리드 + 십자 분할선. 셀이 출력 종횡비와 같아 규격 간 프레이밍이 이식된다 | 반복 횟수, 켄번즈·팬 모션, 파티클·글로우 |

> 템플릿 전환은 파괴적입니다. 이름·오디오·렌더 설정은 유지되고 패널/키비주얼 설정은 초기화됩니다.
> 60초 프로젝트에서 Day1(4 video)로 바꾸면 30초로 조정되며, 전환 전에 안내가 뜹니다.

출력 파일명은 `{프로젝트}_{템플릿}_{언어}_{규격}_{길이}s_{fps}fps.mp4`입니다
(`day1` · `day1x4` · `kvloop`).

> **3장면 템플릿은 제거되었습니다.** 3장면으로 저장된 프로젝트(IndexedDB 자동 저장,
> 내보낸 JSON, 스키마 v1 문서)는 더 이상 열리지 않고, "3장면 템플릿은 더 이상
> 지원하지 않습니다"라는 오류로 거부됩니다. 원본 레코드는 그대로 남습니다.

## Project Layout

```text
src/
├── app/              앱 셸. 어댑터를 생성해 주입하는 유일한 위치
├── domain/           순수 로직: 스키마, 타임라인 불변식, 큐, 파일명
├── features/editor/  편집기 UI와 워크플로 오케스트레이션
├── compositions/     Remotion 컴포지션 (미리보기와 렌더가 공유)
├── infrastructure/   브라우저·SDK 어댑터 (렌더, 미디어, 저장소, TTS, 출력)
└── shared/           에러 모델, 모델 설정, 타입 선언
```

의존 방향은 `src/test/architecture.test.ts`가 검사합니다. `domain`은 React·Remotion·
Zustand를 임포트할 수 없고, feature는 다른 feature 내부를 참조할 수 없습니다.

## Documentation

| 문서 | 내용 |
|------|------|
| `docs/01-plan/features/browser-video-mvp.plan.md` | 요구사항과 범위 |
| `docs/02-design/features/browser-video-mvp.design.md` | 설계, 모듈 완료 로그, 의도적 설계 편차 |
| `docs/archive/2026-07/day1-template/` | Day1 템플릿 PDCA 전체 (Plan·Design·모듈 증거·Check·리포트) — 사이클 완료 후 아카이브 |
| `docs/01-plan/features/day1-quad.plan.md` | Day1(4 video) Plan — 결정 15건과 근거 |
| `docs/02-design/features/day1-quad.design.md` | Day1(4 video) Design — 설계 결정 D-0~D-4 |
| `docs/03-analysis/day1-quad.m0-perf-gate.md` | 4분할 렌더 성능 실측. 패널 개수는 1.15배, `contain` 블러 배경이 2.13배 |
| `docs/01-plan/conventions.md` | 코딩 컨벤션 (§3.1 템플릿 규약) |
| `docs/03-analysis/*.md` | 모듈별 검증 증거와 알려진 한계 |

## Status

**day1-quad (Day1 4 video) 구현 완료 — 배포 전 실측 대기.** 모듈 M0~M7, 유닛 575개
통과. 4분할 렌더가 Day1 대비 1.15배로 성능 게이트를 통과했으나, 그 실측은 H.264가
없는 원격 컨테이너에서 VP9로 대체 측정한 값입니다
([근거와 한계](docs/03-analysis/day1-quad.m0-perf-gate.md) §6). **실제 Chrome에서의
MP4 렌더 검증(`tests/e2e/day1-quad.spec.ts`)이 남아 있습니다.**

browser-video-mvp Do 모듈 1~7 완료. day1-template은 **PDCA 사이클 완료**
(Match Rate 100%, Success Criteria 6/6 — 유닛 272, E2E 27 + 옵트인 60초 렌더 하네스 1).
Day1 엔드카드는 9:16 · 1:1 · 16:9 세 규격 모두 bannerdesigner 좌표에 자동 배치됩니다.

**GitHub Pages 배포 완료 (2026-07-28).** 라이브 사이트에서 업로드 → 실제 MP4 렌더 →
자동 저장·복구까지 확인했습니다 (`npm run verify:deployment`).

### 라이선스 상태 — 읽어주세요

Remotion Free License의 **"평가 중" 조항**을 근거로 배포했습니다. Superplanet은
직원 4명 이상 영리법인이라 나머지 자격 조건에는 해당하지 않습니다.

> **렌더 결과물을 실제·유료 UA 캠페인에 사용하기 전에 Remotion Company License
> ($25/seat·월) 구매가 필요합니다.**

- 근거와 경계 조건: `docs/03-analysis/browser-video-mvp.remotion-license-review.md` §6
- 배포 절차와 구매 후 처리: `docs/01-plan/pages-deployment-runbook.md`

미검증 항목: Supertonic 음성 생성(업로드 음성이 검증된 경로), Beta 객체 감지(미구현).
