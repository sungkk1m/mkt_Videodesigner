# kv-loop-reference-motion — M4 실기기 런북

> **Date**: 2026-08-26
> **Who**: 시스템 Chrome이 있는 기기의 운영자
> **What**: SC1~SC7 판정용 H.264 MP4 확보 + 강도 검수(D-10) + 블러 비용 재측정(M5)

---

## 0. 어떤 포맷으로 렌더하는가 — H.264 MP4가 맞다

"컨테이너에서 계속 VP9로 작업했으니 실기기도 VP9로 해야 하나"에 대한 검증:

| 사실 | 근거 |
|---|---|
| 제품의 렌더 경로는 **mp4 · h264 · aac로 고정**이고 다른 포맷 분기가 없다 | `renderEditor.ts` — `container: 'mp4', videoCodec: 'h264', audioCodec: 'aac'` |
| H.264가 없으면 앱은 다른 포맷으로 **대체하지 않고 렌더를 차단**한다 | `capabilities.ts` — "H.264 인코더를 사용할 수 없습니다" 블로커 |
| VP9/WebM은 **이 개발 컨테이너 전용 대체재**다 (Chromium에 H.264 인코더가 없어서) | day1-quad M0 §6.1, kv-m0 스파이크 — 실기기 절차가 아니라 컨테이너 절차 |
| 실기기는 이미 H.264로 렌더해 왔다 | 첨부됐던 `uavideo_kvloop_ko_9x16_15s_60fps.mp4` 자체가 이 앱이 만든 h264/aac다 |

**결론: 실기기 M4는 평소의 "MP4 렌더" 버튼 그대로다.** 특별한 버전이 필요 없다.
컨테이너의 VP9 수치(정점 배율·컷·블러 램프)는 코덱 무관 기하라 비교에 그대로 유효하다.

## 1. 준비 (한 번)

```bash
git fetch origin claude/key-visual-looping-effect-dcqxo6
git checkout claude/key-visual-looping-effect-dcqxo6
npm install
npm run dev        # http://localhost:5173
```

배포된 Pages 사이트는 main 기준이라 이 기능이 없다 — 반드시 브랜치의 dev 서버로.

## 2. 본 렌더 (SC1~SC7 + D-10 검수)

1. 키비주얼 루핑 템플릿, 소다전설 3장 업로드, 15초 · 60fps · Standard.
2. 설정은 **기본값 그대로** (왕복 켬 · 크로스페이드 0 · 블러 333ms/30px · 페이드아웃 0).
3. MP4 렌더 → 파일 확보.
4. **판정**: 그 MP4를 Claude 세션에 업로드하면 레퍼런스와 같은 방법(프레임 배율
   탐색·경계 diff·에지 에너지)으로 SC1~SC7을 측정한다. 육안 검수 포인트:
   - 각 장이 숨 쉬듯 들어갔다 나오는가, 컷이 튀지 않는가
   - 시작·끝 블러가 자연스러운가 (세기 30px이 과한지/약한지 — D-08)
   - **강도 0.5(정점 1.10배)가 적절한가 — D-10.** 과하면 인스펙터에서 내리고
     재렌더해 비교. 레퍼런스는 ±1~1.5%였지만 그쪽은 오브젝트 애니메이션이
     생동감을 채우는 조건이었다

## 3. 블러 비용 재측정 (M5 — 중요)

컨테이너의 소프트웨어 경로에서 blur(30px)는 **블러 프레임당 ≈1.25초**였다
(m0-blur-spike §2.1). 네이티브 경로는 GPU라 훨씬 쌀 것으로 보지만 측정이 판정이다:

```bash
# 같은 프로젝트를 블러 30px과 0px로 각각 렌더해 소요 시간을 비교
# (렌더 시간은 화면의 진행 표시로 충분하다)
```

- 차이가 전체의 5% 이내(NFR-R02) → 통과.
- 벗어나면 m0-blur-spike §2.1의 대안(램프 계단화 / 저해상도 블러 / 세기 하향)을
  다음 커밋으로 다룬다.
- 여유가 되면 `npm run benchmark:render`로 변경 전(main)/후(브랜치) 전체 비교.

## 4. (선택) 네이티브 래스터화 경로 스파이크

M0을 실기기 Chrome으로 재실행해 두 경로의 일치를 수치로 닫는다:

```bash
npm run dev -- --host 127.0.0.1 --port 4173   # 별도 셸
KV_M0_CHROME="/path/to/chrome" node artifacts/kv-m0/run.mjs
node artifacts/kv-m0/verify.mjs                # 5/5 PASS 기대
```

Windows라면 `KV_M0_CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"`.
`nativeHtmlInCanvas: true`로 찍히면 네이티브 경로를 실제로 측정한 것이다.

## Version History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 0.1.0 | 2026-08-26 | 김성권 / Claude | 최초 작성 — 코덱 검증 포함 |
