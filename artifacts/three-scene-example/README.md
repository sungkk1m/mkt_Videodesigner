# 3장면 템플릿 예시 생성기

3장면(`three-scene`) 템플릿이 지금 어떤 영상을 만드는지 보여주기 위한 하네스다.
프레임을 여기서 그리지 않는다 — 프로젝트를 앱의 도메인 커맨드로 조립하고,
`buildEditorSnapshot` → `createEditorRenderRequest` → `ThreeSceneComposition`까지
제품 코드를 그대로 통과시킨다.

## 실행

```bash
npm run dev -- --host 127.0.0.1 --port 4173   # 하네스가 이 주소를 쓴다

node artifacts/three-scene-example/make-assets.mjs   # 대체 소재 → assets/
node artifacts/three-scene-example/run.mjs           # 3규격 렌더 → out/
```

환경 변수: `EXAMPLE_RATIOS`(기본 `9:16,1:1,16:9`), `EXAMPLE_LOCALE`(기본 `ko`),
`EXAMPLE_CHROME`, `EXAMPLE_URL`.

`assets/`와 `out/`은 gitignore 대상이다. 둘 다 위 두 명령으로 재생성된다.

## 파일

| 파일 | 역할 |
|------|------|
| `gameplay-placeholder.ts` | 대체 게임 화면을 `t`의 함수로 그린다. 난수를 쓰지 않으므로 같은 클립이 매번 나온다 |
| `assets.ts` / `assets.html` | 클립을 mediabunny로 VP9 인코딩하고 앱아이콘·로고·스토어 배지를 그린다 |
| `make-assets.mjs` | 위 페이지를 컨테이너 Chrome에서 구동해 `assets/`에 쓴다 |
| `example.tsx` / `example.html` | 예시 프로젝트 조립 + 렌더. `window.__exampleSnapshot`으로 렌더 프롭만 꺼낼 수도 있다 |
| `run.mjs` | 렌더 → ffmpeg MP4 변환 → 스토리보드 스틸 추출 |

## 두 가지 대체

1. **소재.** 저장소에 게임 캡처가 없다(`tests/fixtures/*.mp4`는 gitignore 대상이고
   내용도 컬러바다). 그래서 세로 게임 화면을 캔버스로 그려 14초 클립으로 만든다.
   실제 소재가 생기면 `assets/gameplay-placeholder.webm` 자리를 바꾸고
   `example.tsx`의 `SOURCE` 메타데이터만 맞추면 된다.
2. **인코더.** 이 컨테이너 Chromium에는 H.264 인코더·디코더가 없어
   `createEditorRenderRequest`가 만든 요청의 컨테이너·코덱만 VP9/WebM으로 바꿔
   렌더하고, `run.mjs`가 ffmpeg로 MP4로 옮긴다. 같은 제약을
   `docs/03-analysis/day1-quad.m0-perf-gate.md` §6이 기록하고 있다.

## 2026-08-27 실행 결과

| 규격 | 해상도 | 렌더 | MP4 |
|------|--------|-----:|----:|
| 9:16 | 1080×1920 | 29.2s | 3.2MB |
| 1:1 | 1080×1080 | 22.9s | 1.8MB |
| 16:9 | 1920×1080 | 34.2s | 2.2MB |

15초 · 30fps · High 프로필 · 무음(대체 클립에 오디오 트랙이 없다).
렌더 시간은 4 vCPU · GPU 없음 · VP9 소프트웨어 인코딩 기준이라
실기기 H.264 측정치(`docs/03-analysis/day1-render-speed.analysis.md`)와 비교 대상이 아니다.
