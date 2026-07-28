# mkt_videodesigner

Chrome에서 서버 없이 3장면 UA 영상을 편집하고 다국어·다비율 MP4를 만드는 정적 웹 앱입니다.

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
npm run dev            # 개발 서버
npm test               # 유닛 테스트 (Vitest)
npm run build          # 타입체크 + 프로덕션 빌드
npm run test:e2e       # 실제 Chrome 렌더 포함 E2E (Playwright)
```

렌더 벤치마크는 `npm run benchmark:render`, 모듈 2 PoC 화면은 `#render-poc`
해시로 접근합니다.

## What It Does

| 영역 | 기능 |
|------|------|
| 소재 | 영상 1개 업로드 후 Hook · Gameplay · CTA에 일괄 적용, 파일 지문 기반 재연결 |
| 타임라인 | 고정 3장면, 15/30/60초 프리셋, 경계 드래그 시 총 길이 불변 |
| 프레이밍 | Cover 고정 + Scale/X/Y, 비율별 프레이밍 override |
| 카피 | ko / en / ja / zh-TW 4언어 Hook·자막·CTA 문구 |
| Hook | 움직임·장면 전환·오디오·밝기 기반 후보 구간 추천 (휴리스틱) |
| 오디오 | 원본·BGM·나레이션 볼륨, 나레이션 중 자동 더킹 |
| 렌더 | Fast/Standard/High 프로필, 30/60fps, 9:16·1:1·16:9 |
| Batch | 언어 × 비율 최대 12개 순차 렌더, 취소·실패 재시도, 폴더 저장 또는 다운로드 |
| 저장 | IndexedDB 자동 저장과 새로고침 복구, JSON 내보내기·가져오기 |

## Project Layout

```text
src/
├── app/              앱 셸. 어댑터를 생성해 주입하는 유일한 위치
├── domain/           순수 로직: 스키마, 타임라인 불변식, Hook 점수, 큐, 파일명
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
| `docs/01-plan/conventions.md` | 코딩 컨벤션 |
| `docs/03-analysis/*.md` | 모듈별 검증 증거와 알려진 한계 |

## Status

Do 단계 모듈 1~7 구현 및 검증 완료 (유닛 164, E2E 15).

**배포는 아직 하지 않았습니다.** Remotion 상용 라이선스 검토가 끝나기 전까지
`.github/workflows/deploy-pages.yml`은 수동 실행 전용으로 유지합니다. 자세한 내용은
`docs/03-analysis/browser-video-mvp.remotion-license-review.md`를 참고하세요.

미검증 항목: Supertonic 음성 생성(업로드 음성이 검증된 경로), Beta 객체 감지
(미구현), GitHub Pages 서브패스 로딩.
