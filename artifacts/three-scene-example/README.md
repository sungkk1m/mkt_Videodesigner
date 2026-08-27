# 3장면 템플릿 예시 생성기

3장면(`three-scene`) 템플릿이 지금 어떤 영상을 만드는지 보여주기 위한 하네스다.
프레임을 여기서 그리지 않는다 — 프로젝트를 앱의 도메인 커맨드로 조립하고,
`buildEditorSnapshot` → `createEditorRenderRequest` → `ThreeSceneComposition`까지
제품 코드를 그대로 통과시킨다.

## 실행

```bash
npm run dev -- --host 127.0.0.1 --port 4173   # 하네스가 이 주소를 쓴다

node artifacts/three-scene-example/make-assets.mjs   # 대체 소재 → assets/
node artifacts/three-scene-example/run.mjs           # 15·30초 · 3규격 렌더 → out/
```

환경 변수: `EXAMPLE_JOBS`(기본 `full,hook`), `EXAMPLE_RATIOS`(기본 `9:16,1:1,16:9`),
`EXAMPLE_LOCALE`(기본 `ko`), `EXAMPLE_CHROME`, `EXAMPLE_URL`.

**주의**: 실행 중에 `src/` 나 이 폴더의 파일을 고치면 Vite HMR이 페이지를 리로드해서
렌더가 `Execution context was destroyed`로 죽는다. 돌리는 동안은 편집하지 않는다.

`assets/`와 `out/`은 gitignore 대상이다. 둘 다 위 두 명령으로 재생성된다.

## 파일

| 파일 | 역할 |
|------|------|
| `gameplay-placeholder.ts` | 대체 게임 화면을 `t`의 함수로 그린다. 난수를 쓰지 않으므로 같은 클립이 매번 나온다 |
| `assets.ts` / `assets.html` | 클립을 mediabunny로 VP9 인코딩하고 앱아이콘·로고·스토어 배지를 그린다 |
| `make-assets.mjs` | 위 페이지를 컨테이너 Chrome에서 구동해 `assets/`에 쓴다 |
| `example.tsx` / `example.html` | 예시 프로젝트 조립 + 렌더. `window.__exampleSnapshot`으로 렌더 프롭만 꺼낼 수도 있다 |
| `run.mjs` | 렌더 → ffmpeg MP4 변환 → 스토리보드·Hook 모션 스틸 추출 |

`run.mjs`의 `hook` 잡은 `durationInFrames`만 90으로 줄여 Hook 구간 앞부분만 렌더한다.
컴포지션이 장면을 절대 프레임으로 배치하므로, 잘린 렌더는 같은 편집의 앞 1.5초다 —
모션 프리셋 비교 스틸을 전체 렌더 없이 6초에 뽑기 위한 것.

## 두 가지 대체

1. **소재.** 저장소에 게임 캡처가 없다(`tests/fixtures/*.mp4`는 gitignore 대상이고
   내용도 컬러바다). 그래서 세로 게임 화면을 캔버스로 그려 26초 · 60fps 클립으로
   만든다. 아트 방향은 운영자의 키비주얼(설원·망토 캐릭터·여우 동료)에 맞췄고,
   실제 게임 화면이 아님을 프레임마다 표기한다. 실제 소재가 생기면
   `assets/gameplay-placeholder.webm` 자리를 바꾸고 `example.tsx`의 `SOURCE`
   메타데이터(길이·해상도)만 맞추면 된다.
2. **인코더.** 이 컨테이너 Chromium에는 H.264 인코더·디코더가 없어
   `createEditorRenderRequest`가 만든 요청의 컨테이너·코덱만 VP9/WebM으로 바꿔
   렌더하고, `run.mjs`가 ffmpeg로 MP4로 옮긴다. 같은 제약을
   `docs/03-analysis/day1-quad.m0-perf-gate.md` §6이 기록하고 있다.

## 2026-08-27 실행 결과

소재를 운영자의 키비주얼 톤(설원)으로 다시 그린 2차 실행. 26초 · 60fps 대체 클립
(1,560프레임 · 10.4MB)에서:

| 잡 | 해상도 | 렌더 | MP4 |
|----|--------|-----:|----:|
| 9:16 · 15초 | 1080×1920 | 52.5s | 4.3MB |
| 1:1 · 15초 | 1080×1080 | 42.1s | 2.8MB |
| 16:9 · 15초 | 1920×1080 | 58.4s | 4.0MB |
| 9:16 · 30초 | 1080×1920 | 95.9s | 8.9MB |
| Hook 모션 3종 (90프레임씩) | 1080×1920 | 5.8~6.2s | — |

60fps · High 프로필 · 무음(대체 클립에 오디오 트랙이 없다).
렌더 시간은 4 vCPU · GPU 없음 · VP9 소프트웨어 인코딩 기준이라
실기기 H.264 측정치(`docs/03-analysis/day1-render-speed.analysis.md`)와 비교 대상이 아니다.

### 이 실행에서 드러난 것 2건

기존 검증은 어두운 컬러바 픽스처로 했기 때문에, 밝은 소재 + 한국어 카피 조합에서만
보이는 두 가지가 이번에 걸렸다. 둘 다 버그가 아니라 조절 수단이 없는 지점이다.

1. **긴 헤드라인이 두 줄이 되면 줄이 붙는다.** `HookScene`의 헤드라인은
   `fontSize: width * 0.095`(1080에서 102px)에 `lineHeight: 1.15` 고정이다.
   한국어 9자쯤부터 두 줄이 되고, 1.15는 한글 받침을 감당하지 못한다.
   회피: 한 줄에 들어가게 쓴다. 후보: 폭에 맞춘 자동 축소, 또는 두 줄일 때 1.3.
2. **밝은 소재에서 Hook 배경 딤 35%가 부족하다.** `dimBackground`는 불리언이고
   강도는 프리셋에 묶여 있다(`impact`·`caption` 0.35, `focus` 0.55). CTA는
   `backgroundDim`이 0~1로 조절 가능한데 Hook만 없다.
   회피: 밝은 소재에 `focus`. 후보: CTA와 같은 딤 슬라이더를 Hook에도.
