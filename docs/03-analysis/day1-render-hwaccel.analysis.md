# day1-render-hwaccel Gap Analysis

> **Project**: mkt-videodesigner
> **Date**: 2026-08-18
> **Trigger**: 사용자 환경(Windows Chrome 151)에서 Day1 mp4 렌더가 100% 실패
> **Verdict**: **원인 단일 축으로 특정 · 4줄 수정 · 유닛 372/372 · e2e 57/57 통과**

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | Day1 영상 mp4 렌더가 인코더 설정 미지원 에러로 첫 프레임도 못 만들고 죽는다 |
| **WHO** | Day1 템플릿으로 UA 소재를 뽑는 퍼포먼스 마케터 (본인) |
| **RISK** | 재현 불가 환경의 추측 수정 → 죽은 코드(불필요한 폴백 래더)를 남기는 것 |
| **SUCCESS** | 사용자 Chrome에서 OK로 측정된 config를 앱이 실제로 내보내고, 기존 렌더 경로 무회귀 |
| **SCOPE** | 인코더 tier 1개 값 + 타입 + 테스트. 비트레이트/레벨/프로파일 로직 무변경 |

---

## 1. 실패 재현 및 원인 특정

### 1.1 에러의 출처

```
This specific encoder configuration (avc1.640028, 6000000 bps, 1080x1920,
hardware acceleration: prefer-hardware) is not supported by this browser.
```

mediabunny가 `VideoEncoder.isConfigSupported()`의 `supported: false`에 대해 던지는 예외다
(`node_modules/mediabunny/src/media-source.ts:686-694`). 메시지의 세 값 전부 우리 코드에서 유래한다:

| 값 | 산출 경로 |
|---|---|
| `avc1.640028` | mediabunny `buildVideoCodecString('avc', 1080, 1920, 6e6, false)` → High Profile · **Level 4.0** (8160 MB ≤ 8192, 6 Mbps ≤ 20 Mbps) |
| `6000000 bps` | `videoBitrate: 'high'` → `QUALITY_HIGH`(factor 2) × 3 Mbps 기준 = 정확히 6 Mbps — **Standard 프로파일 기본값** |
| `prefer-hardware` | `src/infrastructure/render/renderEditor.ts:54` 의 하드코딩 리터럴 |

### 1.2 로컬 재현 실패 (정직한 기록)

개발 환경(macOS · Electron/Chromium 148)에서 실패 config를 3개 tier 전부로 probe한 결과
**전부 `supported: true`** — 재현 불가. 에러 메시지가 `prefer-hardware`를 출력하는 것은
mediabunny가 config를 그대로 echo한 것일 뿐 원인의 증거가 아니므로, 이 시점에는
tier / bitrate / level / profile / 방향 5개 축이 모두 용의자로 남아 있었다.

### 1.3 사용자 환경 실측으로 축 분리

사용자에게 5개 축을 교차 검증하는 probe 매트릭스를 실행하도록 요청했다.
Windows NT 10.0 · Chrome 151.0.0.0 결과:

| 축 | 측정 | 판정 |
|---|---|:---:|
| **tier** | `prefer-hardware` FAIL / `no-preference` OK / `prefer-software` OK — 30·60fps 양쪽 | ⬅️ **원인** |
| bitrate | 3M · 6M · 12M 전부 FAIL (prefer-hardware 고정) | 무관 |
| level | 4.0 · 4.1 · 4.2 · 5.1 전부 FAIL | 무관 |
| profile | High · Main · Baseline 전부 FAIL | 무관 |
| 방향 | portrait 1080×1920 · landscape 1920×1080 둘 다 FAIL | 무관 |

**결론**: 이 머신에는 Chrome에 노출된 H.264 하드웨어 인코더가 존재하지 않는다.
`prefer-hardware`가 붙는 순간 config 내용과 무관하게 실패하고, `no-preference`는 전부 통과한다.

### 1.4 근본 원인

Chrome에서 `prefer-hardware`는 이름과 달리 **선호가 아니라 하드 요구사항**이다.
해당 config를 받아줄 HW 인코더가 없으면 `isConfigSupported`가 즉시 false를 반환한다.
그런데 `src/infrastructure/render/types.ts:86`이 타입을 `'prefer-hardware'` **리터럴로 못박아** 두어
다른 값이 들어갈 수조차 없었다. 폴백 경로도, 사용자가 프로파일을 바꿔 우회할 방법도 없었다.
HW 인코더가 없는 모든 머신에서 Day1 렌더는 구조적으로 100% 실패한다.

### 1.5 사전 게이트가 잡지 못한 이유 (부수 확인)

`capabilities.ts`의 사전 점검은 이 실패를 **구조적으로 검출할 수 없다**:
`canRenderMediaOnWeb`에는 애초에 `hardwareAcceleration` 파라미터가 존재하지 않는다
(`can-render-types.d.ts` 확인). 즉 게이트는 항상 `no-preference` 기준으로 검사해 "ready"를
내주고, 렌더는 `prefer-hardware`로 죽었다. 게이트와 렌더가 서로 다른 config를 보고 있었다.

> 이번 수정으로 렌더도 `no-preference`를 쓰게 되어 **게이트와 렌더의 tier가 일치**했고,
> 이 불일치는 부작용으로 함께 해소됐다. 게이트에 bitrate를 넘기는 축(게이트는 기본
> `medium` 3 Mbps, 렌더는 6~12 Mbps)은 여전히 어긋나 있으나, §1.3 실측에서 bitrate가
> 판별 요인이 아님이 확인됐으므로 이번 스코프에서 제외했다. 포트 시그니처 변경이
> 필요한 작업이라 증거 없이 손대지 않았다.

---

## 2. 적용한 수정

증거가 tier 단일 축을 지목했으므로 폴백 래더(bitrate·level 하향 재시도)는 **채택하지 않았다**.
실측상 죽은 코드가 되기 때문이다.

| 파일 | 변경 |
|---|---|
| `src/infrastructure/render/types.ts:86` | 타입을 `'prefer-hardware'` → `'no-preference'` 리터럴로 교체 + 근거 주석 |
| `src/infrastructure/render/renderEditor.ts:54` | 에디터 렌더 경로 값 교체 |
| `src/infrastructure/render/renderPoc.ts:55` | PoC 렌더 경로 값 교체 |
| `src/infrastructure/render/renderPoc.test.ts:27` | 기존 단언 갱신 |
| `src/infrastructure/render/renderEditor.test.ts` | 회귀 테스트 신규 1건 (3개 프로파일 전수) |

타입을 union으로 넓히지 않고 **`'no-preference'` 리터럴로 유지**했다. 기존 파일의 설계 의도
(잘못된 값이 런타임 예외가 아니라 컴파일 에러가 되게 한다)를 보존하면서, 누군가 성능
최적화 명목으로 `prefer-hardware`를 되돌리는 것을 타입 레벨에서 막는다.

`no-preference`는 HW 인코더가 있는 머신에서는 여전히 하드웨어를 사용한다 — 성능 손실 없이
없는 머신에서만 소프트웨어로 떨어진다.

---

## 3. 검증 결과

| 검증 | 결과 |
|---|---|
| `tsc -b` | 통과 (exit 0) |
| Vitest 유닛 | **372/372** (기존 371 + 신규 회귀 1) |
| Playwright 전체 | **56 passed / 0 failed / 2 skipped**(opt-in) |
| Playwright opt-in `render-fps-output` | **1/1** — `RENDER_FPS_OUTPUT=1`로 별도 실행 |
| 런타임 config 확인 | dev 서버가 실제 서빙하는 두 모듈 모두 `hardwareAcceleration: "no-preference"` |

### 3.1 실제 인코딩 파일 검증 (ffprobe)

opt-in 스펙이 실 mp4를 내려받아 ffprobe로 검사한 결과:

```
[render-fps] 30fps -> {"rFrameRate":"30/1","avgFrameRate":"13500/449","frameCount":450,"durationSeconds":15.082667}
[render-fps] 60fps -> {"rFrameRate":"60/1","avgFrameRate":"54000/899","frameCount":900,"durationSeconds":15.082667}
```

### 3.2 빌드 산출물 실측 — 실제 브라우저로 나가는 값

소스가 아니라 `npm run build` 산출물(`dist/`)을 직접 grep해서, 최종 번들이 내보내는 값을 확인했다.
소스 수정이 번들까지 반영됐는지는 별개 사실이므로 따로 검증한다.

| 항목 | 실측 |
|---|---|
| `hardwareAcceleration:'no-preference'` **설정** 사이트 | **2곳** (에디터 렌더 + PoC 렌더) |
| `hardwareAcceleration:'prefer-hardware'` **설정** 사이트 | **0곳** |
| 번들에 남은 `prefer-hardware` 문자열 | 4개 — 전부 mediabunny의 입력 검증 허용값 배열(`![...].includes()` 가드)과 에러 문구. 설정으로 쓰이는 곳 없음 |

```
Bitrate,muted:!1,outputTarget:t.outputTarget,hardwareAcceleration:`no-preference`,pageResponsiveness:`medi
medium`,muted:!1,outputTarget:e.outputTarget,hardwareAcceleration:`no-preference`,pageResponsiveness:`medi
```

### 3.3 Day1 렌더 경로 무회귀

`day1-template.spec.ts`가 실 렌더로 3개 비율 전수 통과:

```
[module-6] Day1 render wall clock — 1:1: 4.89s · 9:16: 4.86s · 16:9: 4.86s
[module-6] three-scene 9:16 render wall clock — 7.38s
```

Day1 batch(로케일 × 비율), 엔드카드 좌표, v1 마이그레이션 렌더, VP8 WebM 소스 렌더까지 모두 통과.

---

## 4. 검증의 한계 (명시)

개발 환경에는 동작하는 HW 인코더가 있어(§1.2) **이곳의 통과는 수정이 사용자 환경을 고친다는
직접 증거가 아니다.** 로컬 검증이 증명하는 것은 "렌더 경로 무회귀"까지다.

사용자 환경에 대한 근거는 다음 연결로 성립한다:

1. 사용자 Chrome 실측: 문제의 정확한 config가 `no-preference`에서 **OK** (§1.3, 30·60fps 양쪽)
2. 코드가 이제 그 `no-preference`를 실제로 내보냄 (§3 런타임 확인)
3. 실패의 유일한 판별 축이 tier임이 나머지 4축 전수 FAIL로 확인됨 (§1.3)

**남은 확인 사항**: 사용자 환경에서 실제 Day1 mp4 렌더 1회 성공. `isConfigSupported`는
통과하되 `configure()` 단계에서 죽는 경우가 이론적으로 남아 있으므로, 실 렌더 확인 전까지
이 사이클은 완결이 아니다.

### 4.1 대체 환경으로 검증 시도 — 실패 (Playwright Chromium은 대역이 될 수 없음)

별개 컨테이너 환경에서 실렌더를 대신 시도했으나 **불가**로 확인됐다. 원인은 tier가 아니라
코덱 부재다:

| 코덱 | 지원 |
|---|:---:|
| H.264 (`avc1.640028` / `avc1.42001f`) | ❌ 없음 |
| VP8 / VP9 / AV1 | ✅ |

Playwright 번들 Chromium은 오픈소스 빌드라 H.264가 아예 빠져 있다. 따라서 3개 tier가 전부
실패하지만, 이는 문제의 머신처럼 "tier에서 갈리는" 상황이 아니라 **출발선에 서지 못하는** 상황이다.
이 환경은 Windows Chrome 151의 대역이 될 수 없다. (실제 Chrome 설치는 프록시가
`dl.google.com`을 403으로 차단해 중단 — 우회하지 않았다.)

부수 확인 하나: H.264가 없는 환경에서 사전 게이트는 "렌더 가능"이라 해놓고 렌더에서 죽는 게
아니라 **정직하게 "렌더 불가"를 반환**했다. §1.5에 적은 게이트/렌더 tier 불일치가 실제로
해소됐음을 보여준다.

---

## 5. 배포 상태 (2026-08-18 기준)

사용자는 배포된 Pages 주소로 확인하기를 선호한다. 그러나 커밋 시점에 **GitHub 전역 장애**로
배포가 막혀 있다:

```
GitHub Status: "Partial System Outage" (indicator: major)
  Actions ......... major_outage    ← Pages deploy 차단
  Pages ........... degraded_performance
  API Requests .... major_outage
  Issues .......... major_outage    ← Issue 생성 불가
```

| 단계 | 상태 |
|---|:---:|
| 커밋 → `origin/main` (`e012522`) | ✅ (git 프로토콜은 API 장애와 무관) |
| CI (tsc + 유닛) | ✅ success |
| Pages `build` 잡 | ✅ success (Vite 빌드 통과) |
| Pages `deploy` 잡 | ❌ `actions/deploy-pages@v4` 다운로드 429→429→502 |

실패는 `Set up job` 단계 — 우리 코드 실행 **전**이다. 1회 재실행했고 `build`까지는 통과했으나
`deploy`에서 같은 사유로 막혔다. 장애 해소 후 재실행하면 된다.

---

## 6. 다음 세션에서 할 일

1. **Pages 배포 재실행** — GitHub Actions 복구 확인 후:
   `gh run rerun 32041120715` (또는 워크플로 재실행). 빌드는 이미 통과했으므로 배포 단계만 남음.
2. **Windows Chrome 데스크탑에서 Day1 mp4 렌더 1회** — §4의 유일한 미확인 항목.
   배포 주소 또는 `git pull && npm run dev` 후 `localhost:5173`.
   - 성공 → 이 사이클 완결. `/pdca report day1-render-hwaccel` → `archive`.
   - 실패 → 에러 메시지 전문 수집. `configure()` 단계 실패라면 tier가 아닌 다른 축이므로
     §1.3 매트릭스를 `configure()` 기준으로 다시 설계해야 한다.
3. (선택) 게이트에 실제 프로파일 bitrate를 전달하는 축 — §1.5 참고. 실측상 bitrate는 판별
   요인이 아니었으므로 우선순위 낮음. 포트 시그니처 변경이 필요하다.

---

## 7. Match Rate

설계 문서 없이 진행한 버그 수정 사이클이므로 구조적 대조 대상이 없다. 대신 실측 기준:

| 항목 | 판정 |
|---|:---:|
| 원인 특정 (5축 중 1축으로 좁힘, 나머지 배제) | ✅ |
| 수정 범위 최소성 (프로덕션 3줄, 죽은 코드 0) | ✅ |
| 회귀 방지 (타입 레벨 차단 + 프로파일 전수 테스트) | ✅ |
| 기존 렌더 경로 무회귀 (유닛 + e2e + ffprobe) | ✅ |
| 사용자 환경 실렌더 확증 | ⏳ 대기 |

**4/5 완료 · 1건 사용자 확인 대기**

---

## 8. 2026-08-18 추가 — 렌더 4프레임째 delayRender 타임아웃 (디코더 프레임 풀 고갈)

§6-1의 배포 재실행은 완료됐고(run #10·#11 success), §6-2의 실렌더 확인에서 새 실패가 나왔다:
`A delayRender() "Extracting frame at time 0.1 from blob:..." was called but not cleared after 28000ms`.

### 8.1 계측

콘솔 수동 복사가 두 번 실패한 뒤(Chrome이 verbose를 숨김), `?debug=1`에서 앱이 직접
로그를 수집해 버튼으로 복사하게 했다(`debugLog.ts`). trace 레벨 로그가 실패 지점을
프레임 단위로 남겼다:

| 출력 프레임 | 소스 시각 | 소요 |
|---|---|---:|
| 0 | 0 | 39ms(A) / 75ms(B) |
| 1 | 0.0333 | 2ms |
| 2 | 0.0667 | 1ms |
| 3 | 0.1 | **28,008ms — 사망** |

마지막 영상 이벤트는 `Added frame at 0.0833sec to bank` — 0.1초 프레임을 기다리는
`sampleIterator.next()`가 영영 돌아오지 않았다. 오디오가 아니라 **영상 디코더 무응답**이다.

### 8.2 기각된 가설

- **딥 트림**: 트림 0초 재현에서도 동일 사망. 별도 실측(1080×1920·300s·GOP 10s)에서도
  168.69초 딥 시크는 737ms — 28초와 세 자릿수 차이.
- **fps**: 30fps에서도 동일. 뱅크 보존 창이 `0.2 × 30 / fps`라 프레임 수 기준으로는
  fps 불변(항상 6프레임) — 관측과 정확히 일치.
- **fMP4 duration 스캔**: 4.7ms + 메모이즈. 기각.

### 8.3 확정 기제

사망 시점에 열린 VideoFrame 7장(60fps 소스 패널 A 6장 + 정지 패널 B 1장) + 싱크
선행 디코딩 분. 하드웨어 VideoDecoder는 고정 크기 출력 풀에서 프레임을 내주므로,
소비자가 프레임을 닫지 않고 쌓아두면 디코딩 출력이 설계상 멈춘다(WebCodecs의
"프레임을 닫아라" 규칙). `@remotion/media`의 키프레임 뱅크는 `현재시각 − 0.2s` 이전만
회수하므로 60fps 소스에서 정상적으로 12장까지 쌓인다 — 이 머신의 풀보다 크다.
프리뷰는 그린 직후 프레임을 닫아서 같은 파일이 멀쩡히 재생된다. §1의 인코더 건과
대칭인 디코더 축이다.

### 8.4 수정

라이브러리는 디코더 옵션을 노출하지 않는다(4.0.499·4.0.512 모두 decode 쪽
`decoderOptions`/`hardwareAcceleration` 참조 0건). 렌더 동안만
`VideoDecoder.configure`를 감싸 avc1/avc3/vp8/vp09/av01 config를
`prefer-software`로 돌린다 — 소프트웨어 디코더는 메모리에서 할당하므로 풀이 없다.
HEVC는 소프트웨어 지원이 보편적이지 않아 제외(하드웨어 유지, 풀 고갈 리스크 잔존).
프로브(`avc1 prefer-software` 지원 확인)가 거짓이면 무패치로 기존 동작.

- 구현: `softwareVideoDecode.ts`, 적용: `renderEditor.ts`(단일·Batch 공통 경로)
- 실검증 대기: 해당 Windows Chrome 데스크탑에서 Day1 렌더 1회. 재발 시 `?debug=1`
  로그의 마지막 줄이 다시 갈라준다.
