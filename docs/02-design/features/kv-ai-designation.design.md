# Key Visual AI Designation Design Document

> **Summary**: 지정의 **형태**를 rect/circle/mask 유니온으로 열고, 마스크를 이미지 정규 좌표의 RLE 값으로 굳혀 저장한다. 클릭→마스크는 포트 뒤의 온디바이스 모델이 제안하고, 확정은 사용자이며, 렌더는 모델을 모른다
>
> **Project**: mkt_videodesigner
> **Feature**: kv-ai-designation
> **Version**: 0.1.0
> **Author**: 김성권 / Claude
> **Date**: 2026-08-27
> **Status**: Draft — 요청자 확인 대기(§12의 확인 항목). M1 착수는 확인 후
> **Plan**: [kv-ai-designation.plan.md](../../01-plan/features/kv-ai-designation.plan.md) v0.4.0 Approved
> **Measurements**: [p0-designation-spike](../../03-analysis/kv-ai-designation.p0-designation-spike.md) — 후보 4종 실측. 절대 정확도는 M0

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 지정 비용을 "드래그로 대충 감싸기"에서 "클릭 한 번"으로, 정밀도를 사각형에서 오브젝트 윤곽으로. [report §5](../../04-report/kv-object-animation.report.md)의 두 후속 요청 |
| **CONSTRAINT** | 모델은 **편집 시점의 도구**이고 렌더의 입력이 아니다(Plan §1.2). `domain`은 Remotion·DOM·모델 런타임을 임포트하지 않는다(NFR-A04). 마스크 없는 프로젝트는 프레임 단위로 동일(FR-A13). 소재는 기기를 떠나지 않는다(FR-A12) |
| **RISK** | ① 마스크 글로우의 흐림 비용(블러 전례: 소프트웨어 경로 프레임당 1.25초) — M2가 실측하고 §4.1이 선회 경로를 갖는다 ② 실소재 정확도 — M0이 착수 게이트 |

## 1. Overview

### 1.1 Design Goals

1. **마스크는 "어디에"이고, 이펙트 종류는 "무엇을"이다.** 두 축을 분리한다
   (D-A05). `region`이 형태 유니온이 되고 `kind`는 그대로다 — 마스크를 `kind`에
   넣으면 (종류 × 형태)로 조합이 폭발한다.
2. **확정된 마스크는 값이다.** RLE 문자열로 스키마에 굳으므로 렌더·배치·JSON
   내보내기가 모델 없이 돈다(FR-A07). 모델은 세션 상태에만 닿는다.
3. **모델이 내놓는 것은 확신도 필드이고, 이진화는 도메인이 한다.** 그래서 여유값
   슬라이더가 추론 0으로 동작하고(FR-A03), 추가·제외 클릭은 필드 집합의 순수
   합성이다(FR-A04).
4. **마스크는 원화에 붙고 사각형은 프레임에 붙는다.** 좌표계가 형태마다 다른 것이
   이 설계의 유일한 비대칭이고, 의도된 것이다(§3.1).
5. 마스크 없는 슬롯은 새 코드 경로를 하나도 타지 않는다(FR-A13, NFR-A02).

### 1.2 Key Insight — 실루엣은 프레임 불변이고, 셀 목록은 마스크의 순수 함수다

이 사이클의 비용은 전부 "마스크 하나당 한 번"으로 접힌다.

| 프레임마다 다시 하는 것 | 마스크당 한 번만 하는 것 |
|---|---|
| 파티클 64개의 위치·불투명도 산술, 글로우 밝기 하나 | RLE 디코드, 내부 셀 목록, bbox, 실루엣 래스터와 그 흐림 |

글로우 halo는 **모양이 프레임에 의존하지 않는다** — 프레임 함수인 것은 밝기
하나뿐이다(`kvGlowOpacityAt`). 그러므로 흐린 실루엣을 세션 캐시에 한 번 구워
두고 프레임마다 `globalAlpha`만 바꿔 합성하면, 블러 비용은 프레임당이 아니라
마스크당 한 번이 된다. Plan §5가 "지정 시점에 구워 **저장**"을 선회 경로로
적어 뒀지만, 캐시가 성립하면 픽셀을 프로젝트 파일에 넣지 않고 같은 효과를 얻는다
(§4.1).

같은 논리가 방출점에도 적용된다: 내부 셀 목록은 마스크의 순수 함수이므로 한 번
계산해 메모이즈하고, 프레임마다 하는 일은 `kvHash01`로 색인 하나를 뽑는 것이다
— 기각 샘플링과 달리 반복 횟수가 없어 D-03(결정론)의 닫힌 식이 유지된다.

### 1.3 Confirmed Decisions

[Plan §1.5.1](../../01-plan/features/kv-ai-designation.plan.md)이 원본이다. 설계에
직접 닿는 것:

| # | 설계에서 무엇이 되는가 | 위치 |
|---|---|---|
| D-A01 | 자동 후보는 모델이 아니라 밝은 영역 검출 — `domain/kvloop/lightRegions.ts` | §3.5 |
| D-A02 | MediaPipe Interactive Segmenter v1 — 어댑터 한 파일 뒤 | §5 |
| D-A03 | 런타임·모델 둘 다 같은 오리진. 경로는 설정값, 기본값은 Google 핀 URL | §5.2 |
| D-A04 | 전해상도 이진 마스크의 RLE(LEB128 + base64) | §2.2 |
| D-A05 | `region`이 `{shape: 'rect' \| 'circle' \| 'mask'}` 유니온 | §2.1 |
| D-A06 | 이미지 정규 좌표 + 그릴 때 `objectFit` 매핑 | §3.1 |
| D-A07 | 여유값(임계값) 슬라이더 + 추가/제외 클릭. 픽셀 브러시 없음 | §6 |
| D-A10 | 게이트 기준은 M0에서 — 이 문서는 기본값을 **잠정**으로 두고 출처를 적는다 | §2.3 |

---

## 2. Data Model

### 2.1 지정 형태 — `region`이 shape 유니온이 된다

D-A05의 확정을 스키마로 옮기면, 지정 형태는 **세 팔(arm)**이고 이펙트 종류마다
허용하는 부분집합이 다르다.

```ts
/** 프레임 좌표의 자유 종횡비 사각형 — 지금의 kvEffectRegionSchema 그대로. */
const kvRectDesignationSchema = z.object({
  shape: z.literal('rect'),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(MIN_KV_EFFECT_SPAN).max(1),
  height: z.number().min(MIN_KV_EFFECT_SPAN).max(1),
});

/** 프레임 좌표의 점 + 반경 — 지금 글로우가 효과 레벨에 갖고 있는 두 필드. */
const kvCircleDesignationSchema = z.object({
  shape: z.literal('circle'),
  center: z.object({x: z.number().min(0).max(1), y: z.number().min(0).max(1)}),
  radius: z.number().min(MIN_KV_EFFECT_SPAN).max(1),
});

/** 이미지 정규 좌표의 마스크 (D-A06). §2.2. */
const kvMaskDesignationSchema = z.object({
  shape: z.literal('mask'),
  mask: kvMaskSchema,
});

const kvParticlesRegionSchema = z.discriminatedUnion('shape', [
  kvRectDesignationSchema,
  kvMaskDesignationSchema,
]);
const kvGlowRegionSchema = z.discriminatedUnion('shape', [
  kvCircleDesignationSchema,
  kvMaskDesignationSchema,
]);
```

**왜 `circle`이 새로 생기는가.** 마스크는 파티클과 글로우 **둘 다** 받아야 한다
(FR-A08 — "글로우는 마스크 모양을 따른다"). 글로우의 지정이 형태 축에 올라오면
`center`·`radius`는 효과 레벨이 아니라 `circle` 팔의 필드가 된다. 대안으로 원을
사각형에 흡수시켜(내접 타원 그라디언트) 팔을 둘로 줄일 수 있었지만 **택하지
않았다** — 기존 글로우의 그리기 인수(중심·반경)가 그대로 남아야 저장 문서가
프레임 단위로 동일하다는 것(FR-A13)이 산술이 아니라 구조로 보장된다.

**마이그레이션은 `z.preprocess` 한 겹이다** — `kenBurns → motion`의 전례
(`kvSlotSchema`)와 같은 자리다.

```ts
export const kvEffectSchema = z.preprocess(liftLegacyDesignation, z.discriminatedUnion('kind', [
  z.object({kind: z.literal('particles'), id, seed, region: kvParticlesRegionSchema, color, density, speed, sizePx}),
  z.object({kind: z.literal('glow'),      id,       region: kvGlowRegionSchema,      color, intensity, periodMs}),
]));
```

`liftLegacyDesignation`이 하는 일은 둘뿐이다:

| 저장된 문서 | 파싱 결과 |
|---|---|
| `particles`의 `region`에 `shape`가 없다 | `shape: 'rect'`를 얹는다 |
| `glow`에 `region`이 없다 | `region: {shape: 'circle', center, radius}`를 만든다. 남은 `center`·`radius` 키는 Zod가 버린다 |

- 판별자(`shape`)가 없는 입력만 손대므로 **멱등**이다 — 파싱 결과를 다시 파싱해도
  같다(실측 확인). `z.preprocess`를 유니온 팔 안이 아니라 **바깥 한 곳**에 두는
  이유는 Zod 4의 `discriminatedUnion`이 팔에서 판별자를 직접 찾기 때문이다.
- `glow`에 `rect`를, `particles`에 `circle`을 주면 **파싱 실패**다. 허용 조합이
  스키마에 박혀 있어 커맨드가 따로 검사하지 않는다.

### 2.2 마스크 — RLE 인코딩 형식 (D-A04)

```ts
export const kvMaskSchema = z.object({
  /** 마스크 격자의 크기. 이미지 자체의 해상도이고, 캔버스 장변에서 잘린다. */
  width: z.number().int().min(1).max(KV_MASK_MAX_EDGE),
  height: z.number().int().min(1).max(KV_MASK_MAX_EDGE),
  /** 행 우선 런 길이의 LEB128 바이트열을 base64로. 형식은 아래. */
  rle: z.string().min(1).max(MAX_KV_MASK_RLE_CHARS),
});
```

형식을 정확히 못 박는다 — 왕복 동일성이 단위 테스트의 첫 항목이기 때문이다.

1. **행 우선**(row-major), 셀 (0,0)에서 시작한다.
2. 런은 **0으로 시작해 교대**한다. 마스크가 1로 시작하면 **첫 런은 길이 0**이다.
   이 규약이 인코딩을 유일하게 만든다(같은 마스크 → 같은 문자열).
3. 런 길이는 **LEB128 부호 없는 가변 정수** — 7비트씩, 최상위 비트가 연속 표시.
   길이 <128은 1바이트, <16384는 2바이트, 그 위는 3바이트다. P0가 바이트 수를
   추정한 모델([spike §3.4](../../03-analysis/kv-ai-designation.p0-designation-spike.md))과
   **같은 식**이므로 그 표의 KB가 그대로 이 형식의 KB다.
4. 바이트열을 표준 base64(패딩 포함)로. 프로젝트 파일이 JSON이고 base64는
   JSON 이스케이프가 없어 문자 수 = 바이트 수다. 크기는 원본의 4/3 —
   실측 0.7KB → 0.9KB, 2.6KB → 3.5KB가 이 배수다.
5. 런 길이의 합은 `width × height`와 정확히 같다. 디코더가 이것을 검증하고,
   어긋나면 파싱 실패(`SCHEMA_UNSUPPORTED`)다.

**상한을 넘으면 격자를 줄인다.** 인코더는 `MAX_KV_MASK_RLE_CHARS`를 넘으면
격자를 절반으로 다수결 축소해(P0의 `downsample`과 같은 규칙) 다시 인코딩하며,
들어갈 때까지 반복한다 — 축소 1단의 IoU 손실은 실측 ≤0.004
([spike §3.4](../../03-analysis/kv-ai-designation.p0-designation-spike.md))다. 유한
루프이고 결정론적이므로 **에러 경로가 아니다**: 승인이 실패하는 일이 없다.

### 2.3 상수 — `constants.ts`

```ts
/**
 * 마스크 격자의 장변 상한. 이펙트 캔버스는 컴포지션 해상도(1080×1920)로 고정이고
 * 카메라 줌은 그 캔버스 전체를 CSS transform으로 확대한다 — 즉 마스크는 어떤
 * 줌에서도 캔버스 픽셀보다 곱게 그려질 수 없다. 원화가 그 이상이면 잘라도 잃는
 * 것이 없고, 그 이하면 격자가 곧 원화의 해상도라 마스크 정밀도가 아트 정밀도와
 * 정확히 같다. P0의 실측 구성(1080×1920)이 이 값에서 그대로 재현된다.
 */
export const KV_MASK_MAX_EDGE = 1920;

/**
 * 마스크 하나의 base64 문자 상한. SC-A7(스키마 상한 = 슬롯 8 × 오브젝트 8 =
 * 마스크 64개)이 1MB 안에 들어가는 것을 산술로 보장한다: 64 × 12,000 = 768,000 <
 * MAX_PROJECT_FILE_BYTES(1,000,000)이고 나머지 232,000이 프로젝트의 그 외 전부다.
 * 실측 최악값은 3.5KB이므로 실사용은 이 상한의 1/3 이하다.
 */
export const MAX_KV_MASK_RLE_CHARS = 12_000;

/**
 * 밝은 영역 검출 격자의 장변. P0는 1080×1920 픽셀을 stride 8로 훑어 135×240에서
 * 측정했다(§3.3) — 1920/240 = 8이므로 이 값이 그 구성의 해상도 독립 표현이다.
 */
export const KV_LIGHT_GRID_EDGE = 240;

/** 후보로 올릴 연결성분의 최소 셀 수. P0와 같은 값. */
export const MIN_KV_LIGHT_REGION_CELLS = 12;

/** 여유값(재이진화 임계값)의 범위와 기본값. 기본값은 M0에서 실측으로 확정. */
export const MIN_KV_MASK_THRESHOLD = 0.1;
export const MAX_KV_MASK_THRESHOLD = 0.9;
export const DEFAULT_KV_MASK_THRESHOLD = 0.3; // 잠정 — §2.3 아래 근거

/** 마스크 글로우 halo의 흐림 반경, 프레임 폭의 비율. 잠정 — M2에서 확정. */
export const KV_MASK_GLOW_BLUR_RATIO = 0.01;
```

**임계값 기본값 0.3은 잠정이고, 그 이유를 적어 둔다.** P0의 스윕에서 캐릭터는
0.2가 최선(0.918)이고 광원은 0.5~0.65가 최선(0.984/0.986)이었다 — 대상 유형에
따라 반대 방향이므로 하나의 최적값이 없다. 0.3은 "윤곽이 뚜렷한 대상 쪽으로
기울인 값"이고, **0.5로 두면 안 된다는 것만이 실측의 결론**이다. 최종값은 실소재
4장에서 M0이 정한다(D-A10). `KV_MASK_GLOW_BLUR_RATIO`도 같은 절차로 M2가 정한다
— 이전 사이클의 D-07/D-08(블러 333ms·30px), M4 계수와 같은 관례다.

### 2.4 렌더 프롭 — 이미지 치수가 실린다

```ts
export interface KvSlotRenderProps {
  // …기존 필드…
  /**
   * 이 로케일 MediaReference의 원본 픽셀 크기. 마스크 매핑(§3.1)이 필요로 하는
   * 유일한 새 입력이고, 없으면(구 참조는 optional) 마스크 격자 크기로 대체한다 —
   * 격자가 곧 그 이미지의 해상도이므로 같은 종횡비다.
   */
  imageWidth: number | null;
  imageHeight: number | null;
}
```

Plan §6.2가 지적한 그 한 칸이다: 이펙트를 "해석 없이 통과"시키던 규약이 여기서만
넓어진다. `effects`는 여전히 스키마 값 그대로 동결해 통과시킨다.

**로케일마다 원화가 다를 때.** 마스크는 슬롯(언어 공통)에 저장되고 매핑은 렌더
시점의 로케일 이미지 치수를 쓴다 — 같은 그림의 다른 종횡비 판이면 비례로 따라
붙고(FR-A09), 내용이 다른 그림이면 마스크가 어긋난 채 **미리보기에 그대로
보인다**. 스키마를 늘려 감추지 않는 쪽을 택했다: 로케일 탭을 바꾸면 마스크
미리보기도 그 이미지 위에 다시 그려진다.

### 2.5 커맨드 — `project.ts`

| 커맨드 | 변경 |
|---|---|
| `addKvEffect(project, index, kind)` | 그대로 — 기본값은 rect/circle 팔 |
| `addKvEffect`의 마스크판 | `addKvMaskEffect(project, index, kind, mask)` — 승인이 부르는 커맨드(FR-A01/A06). 시드는 파티클일 때 여기서 한 번 생성(D-03) |
| `updateKvEffect` | `KvEffectPatch.region`이 유니온을 받는다. `clampKvEffectRegion`은 `rect` 팔에만 — 마스크는 드래그되지 않으므로 클램프할 값이 없다. 글로우의 `center`·`radius` 패치 키는 `region`으로 대체된다 |
| `removeKvEffect` | 그대로 — 거절은 커맨드를 부르지 않는다(FR-A02: 승인 전에는 프로젝트가 바뀌지 않는다) |

---

## 3. Domain

### 3.1 좌표 매핑 — `objectFit`의 닫힌 식 (D-A06)

새 파일 `src/domain/kvloop/mask.ts`. 매핑은 프로젝트 값만으로 계산된다.

```ts
/** 이미지가 캔버스 박스 안에서 차지하는 배율. 축마다 하나. */
export interface KvImageBox {
  rx: number;
  ry: number;
}

export const kvImageBoxOf = (
  fit: MediaFit,          // 'cover' | 'contain'
  imageAspect: number,    // imageWidth / imageHeight
  canvasAspect: number,   // 1080 / 1920
): KvImageBox => {
  const ratio = imageAspect / canvasAspect;

  return fit === 'cover'
    ? {rx: Math.max(1, ratio), ry: Math.max(1, 1 / ratio)}
    : {rx: Math.min(1, ratio), ry: Math.min(1, 1 / ratio)};
};

/** 이미지 정규 좌표 → 캔버스 정규 좌표. 중심 정렬(objectPosition 기본값). */
export const kvImageToCanvas = (u: number, v: number, box: KvImageBox) => ({
  x: 0.5 + (u - 0.5) * box.rx,
  y: 0.5 + (v - 0.5) * box.ry,
});

/** 역방향 — 오버레이의 클릭이 이미지 좌표가 되는 길(M4). */
export const kvCanvasToImage = (x: number, y: number, box: KvImageBox) => ({
  u: 0.5 + (x - 0.5) / box.rx,
  v: 0.5 + (y - 0.5) / box.ry,
});
```

검산 하나: 1080×1920 캔버스에 1920×1080 원화, `cover`면 `ratio = 3.1605`이고
`rx = 3.1605`, `ry = 1` — 실제 배율은 `max(1080/1920, 1920/1080) = 1.7778`이라
표시 폭 3413px = 캔버스 폭의 3.16배, 표시 높이 1920px = 1.0배로 일치한다.
`contain`이면 `rx = 1`, `ry = 0.3164`이고 표시 크기 1080×607.5px로 일치한다.

**카메라와 프레이밍은 이 매핑에 들어오지 않는다.** `KvScene`이 이미지와 캔버스에
**같은 transform 문자열**을 주므로(kv-object-animation §4.1) 캔버스 0-1 박스는
transform 이전의 프레임 박스이고, 그 안에서 이미지를 놓는 것이 `objectFit`뿐이다
— 즉 마스크가 카메라·프레이밍을 따라가는 것(SC-A4)은 지난 사이클의 구조가 이미
보장한다. 이 매핑이 새로 메꾸는 것은 **원화 안에서의 자리** 하나다.

`contain`일 때 뒤에 깔리는 흐린 배경판(`BACKDROP_OVERSCAN`)은 매핑 대상이
아니다 — 마스크는 앞의 원본 이미지에 붙는다.

### 3.2 마스크 기하 — 한 번의 디코드에서 셋을 얻는다

```ts
export interface KvMaskGeometry {
  width: number;
  height: number;
  /** 행 우선 이진 격자. 글로우 실루엣 래스터가 쓴다(§4.1). */
  grid: Uint8Array;
  /** 내부 셀의 행 우선 색인. 파티클 방출점이 쓴다(§3.3). */
  cells: Int32Array;
  /** 이미지 정규 좌표의 bounding box. 도달 범위가 쓴다(§3.4). */
  bounds: {x: number; y: number; width: number; height: number};
}

/** 마스크의 순수 함수. 마스크 객체를 키로 메모이즈된다 — Plan §1.3. */
export const kvMaskGeometry = (mask: KvMask): KvMaskGeometry;

export const kvMaskEncode = (grid: Uint8Array, width: number, height: number): KvMask;
```

- 메모이즈는 `WeakMap<KvMask, KvMaskGeometry>`. `buildKvLoopProps`가 이펙트를
  동결해 통과시키므로 마스크 객체의 동일성이 세션 내내 유지되고, 디코드는 마스크당
  한 번이다. 순수 함수의 캐시이므로 결과에 영향이 없다(SC-A3).
- **메모리를 숨기지 않는다**: 1080×1920 격자는 2.1MB(Uint8Array), 내부 셀은
  면적에 비례해 P0 캐릭터(5.9%)에서 122,342칸 × 4바이트 = 489KB다. 실사용
  구성(슬롯 4 × 오브젝트 2~3)에서 마스크 10개면 25MB 남짓이고, 실제로 그려지는
  마스크만 **지연 계산**된다(글로우는 `grid`만, 파티클은 `cells`만 필요하지만
  둘 다 한 번의 디코드에서 나온다). 스키마 상한(64개)이 부담이 되면 셀 목록을
  격자 간격으로 추려 줄일 수 있으나(방출점은 파티클 크기보다 고운 격자를 필요로
  하지 않는다) **지금은 하지 않는다** — 실측 없이 도입할 복잡도가 아니다.

### 3.3 파티클 방출점 — 마스크 내부 셀의 닫힌 식

`kvParticlesAt`은 이미 `region`에서 출생점을 뽑는다. 그 두 줄만 형태 분기가 된다.

```ts
// 지금: rect 안 균등
const birthX = effect.region.x + kvHash01(seed, i, k, 2) * effect.region.width;
const birthY = effect.region.y + kvHash01(seed, i, k, 3) * effect.region.height;

// 마스크: 내부 셀 목록을 색인
const n = Math.min(cells.length - 1, Math.floor(kvHash01(seed, i, k, 2) * cells.length));
const cell = cells[n];
const u = (cell % gw + 0.5) / gw;
const v = (Math.floor(cell / gw) + 0.5) / gh;
const {x: birthX, y: birthY} = kvImageToCanvas(u, v, box);
```

- 색인 하나짜리 닫힌 식이다 — 기각 샘플링(마스크 밖이면 다시 뽑기)은 반복
  횟수가 입력에 따라 달라져 D-03을 깨므로 쓰지 않는다.
- 셀 중심을 쓰고 셀 안 지터는 **넣지 않는다**. 1080폭에서 셀은 1px이고 파티클은
  1~16px이라 지터가 만드는 차이가 없는데, 도달 범위 식에 반 셀을 더해야 하는
  비용이 생긴다.
- 해시 레인 번호(`2`,`3`)는 지금 것을 그대로 쓴다 — rect 경로의 값이 변하지
  않아야 마스크 없는 프로젝트가 프레임 단위로 동일하다(FR-A13).

시그니처는 해석된 지정을 받는 쪽으로 한 칸 바뀐다. 프레임마다 디코드·매핑을
반복하지 않기 위한 것이고, 해석 자체는 §3.2의 메모이즈된 함수다.

```ts
export type KvResolvedDesignation =
  | {shape: 'rect'; rect: KvEffectRect}
  | {shape: 'circle'; center: {x: number; y: number}; radius: number}
  | {shape: 'mask'; geometry: KvMaskGeometry; box: KvImageBox; bounds: KvEffectRect};

export const kvResolveDesignation = (region: KvDesignation, box: KvImageBox): KvResolvedDesignation;

export const kvParticlesAt = (
  effect: KvParticlesEffect,
  frame: number,
  fps: number,
  designation: KvResolvedDesignation,   // 새 인자
): KvParticleState[];
```

`bounds`는 §3.2의 이미지 좌표 bbox를 축마다 아핀인 매핑에 통과시킨 캔버스 좌표
사각형이다 — 두 점을 매핑하면 끝이다.

### 3.4 도달 범위 — SC-A2의 판정식

```ts
export const kvParticlesReach = (
  effect: KvParticlesEffect,
  designation: KvResolvedDesignation,
): KvEffectRect;
```

식의 형태는 그대로다: 지정의 사각형(rect면 자기 자신, mask면 §3.3의 `bounds`)에
좌우로 최대 sway, 위로 최대 travel을 더한다. 즉 **마스크가 rect의 자리를
대신할 뿐**이고, SC1의 판정 논리가 SC-A2로 그대로 이어진다.

글로우는 지정 밖 기여가 0인 것이 그리기에서 나온다 — `circle`은 반경에서 알파 0,
`mask`는 흐림 반경만큼 번지는 것이 상한이므로 도달 범위는
`bounds + KV_MASK_GLOW_BLUR_RATIO × 3`(가우시안의 실질 꼬리)이다. M2 하네스가
이 띠 밖을 판정한다.

### 3.5 밝은 영역 검출 — `domain/kvloop/lightRegions.ts` (신규)

P0 후보 D를 순수 함수로 옮긴다. 알고리즘은 실측된 것 그대로다.

```ts
export interface KvLightRegion {
  /** 이미지 정규 좌표의 bounding box — 후보 목록 UI가 그린다. */
  bounds: {x: number; y: number; width: number; height: number};
  /** 승인하면 이 마스크가 지정이 된다. 검출 격자 해상도. */
  mask: KvMask;
  cells: number;
  peakLuma: number;
}

export const kvLightRegions = (
  pixels: Uint8ClampedArray,   // RGBA, 이미지 해상도
  width: number,
  height: number,
): KvLightRegion[];
```

- 격자: 장변이 `KV_LIGHT_GRID_EDGE`가 되도록 stride를 잡는다
  (`stride = max(1, round(max(w,h) / 240))`) — 1080×1920에서 stride 8, 즉 P0의
  구성이다.
- 휘도는 Rec.709(0.2126/0.7152/0.0722), 임계값은 `max(0.5, maxLuma × 0.7)`,
  4-이웃 연결성분, `MIN_KV_LIGHT_REGION_CELLS` 미만은 버리고, 셀 수 내림차순.
- **후보가 사각형이 아니라 마스크로 승격된다.** 연결성분의 셀이 이미 손에 있으니
  그것을 그대로 인코딩하면 (a) 지정이 원화에 붙고(FR-A09) (b) 이펙트가 광원
  모양을 따르고 (c) RLE가 0.1~0.2KB다. 사각형으로 내리면 세 이점을 다 버린다.
- 픽셀 배열을 인자로 받으므로 도메인이 DOM에 닿지 않는다(NFR-A04). 픽셀을 뽑는
  것은 features/infrastructure의 몫이다.

---

## 4. Compositions

### 4.1 마스크 글로우 — 실루엣은 캐시, 밝기는 프레임 함수

`KvEffectsCanvas.tsx`의 `drawKvEffects`에 팔 하나가 붙는다.

```
mask 글로우 한 프레임:
  1) 실루엣 래스터를 캐시에서 찾는다. 키: (mask 객체, 캔버스 크기, box)
  2) 없으면 만든다 — 격자 크기 오프스크린에 putImageData(알파 = 격자) →
     캔버스 크기 오프스크린에 매핑된 목적 사각형으로 drawImage →
     ctx.filter = `blur(${KV_MASK_GLOW_BLUR_RATIO × width}px)`로 한 번 더 그려 halo
  3) globalAlpha = kvGlowOpacityAt(effect, frame, fps), 색으로 틴트해 합성
```

캐시는 모듈 수준 `WeakMap`이고, 캐시 히트/미스가 픽셀을 바꾸지 않으므로(같은
드로잉 호출) SC-A3(두 렌더 프레임 동일)이 유지된다. 렌더 잡의 첫 프레임이 블러
비용을 한 번 치른다.

**흐림이 비쌀 때의 선회 경로** — M2의 수치로 고른다.

| 순서 | 선회 | 잃는 것 |
|---|---|---|
| 1 | 실루엣 래스터를 **캔버스보다 작게**(예: 1/2) 만들고 확대해 합성 — 흐림이 필요한 곳은 저주파다 | 없음(halo는 이미 흐릿하다) |
| 2 | `filter` 대신 실루엣을 배율 다르게 3~4번 겹쳐 그려 falloff를 만든다 | halo 품질 |
| 3 | Plan §5의 원안 — 지정 시점에 구워 마스크와 **함께 저장** | 프로젝트 파일 크기(PNG 49KB급). 캐시가 성립하면 치를 이유가 없는 비용 |

1·2가 프레임 비용이 아니라 **마스크당 한 번**의 비용을 줄이는 것이라는 점이
중요하다 — 프레임당 비용은 `drawImage` 하나로 이미 상수다.

### 4.2 `drawKvEffects` 시그니처

```ts
export const drawKvEffects = (
  canvas: HTMLCanvasElement,
  effects: readonly KvEffect[],
  frame: number,
  fps: number,
  /** 마스크 팔이 필요한 것 전부. 마스크가 없으면 읽히지 않는다. */
  view: {box: KvImageBox},
): void;
```

- `KvEffectsCanvas`는 `imageWidth`·`imageHeight`·`fit`으로 `box`를 계산해
  넘긴다. 치수가 없으면(§2.4) 마스크 격자로 대체한다.
- rect·circle 팔의 드로잉 코드는 **한 줄도 바뀌지 않는다** — 인수의 출처가
  `effect.center`에서 `effect.region.center`로 바뀔 뿐이다. 이것이 FR-A13을
  산술 논증 없이 얻는 방법이다.
- 마스크 없는 슬롯은 캔버스 자체를 만들지 않는 조건부 마운트도 그대로다(NFR-A02).

### 4.3 M2 하네스 — `artifacts/kv-ai-m2/`

전례: `artifacts/kv-obj-m0/`(spike.html + spike.tsx + run.mjs + verify.mjs).
1080×1920 픽스처 위에 마스크 지정 파티클 + 마스크 글로우를 놓고 30fps·90프레임을
VP9로 렌더한다. 픽스처 마스크는 P0의 `fixtures.js`가 그린 오브젝트 레이어의 알파를
RLE로 인코딩해 만든다 — 정답이 정확히 알려진 마스크다.

| 게이트 | 방법 | 판정 |
|---|---|---|
| ① 격리 | on/off 프레임을 §3.4 도달 범위 밖 띠에서 비교 | 차이가 코덱 노이즈 이하 (SC-A2) |
| ② 비용 | 마스크 on/off 렌더 시간, 그리고 첫 프레임 vs 정상 상태 | 수치 기록. 흐림이 프레임 비용이면 §4.1로 선회 |
| ③ 결정론 | 같은 프로젝트 2회 렌더 | 프레임 동일 (SC-A3) |
| ④ 매핑 | `cover`·`contain` × 원화 종횡비 3종에서 마스크 실루엣의 화면 위치 | §3.1 예측값과 일치 (SC-A4) |
| ⑤ 회귀 | 마스크 없는 이펙트 프로젝트를 이 브랜치와 `main`에서 렌더 | 프레임 동일 (FR-A13) |

---

## 5. Port — `ObjectDesignator` (계약은 지금, 구현은 M3)

### 5.1 계약

```ts
/** 이미지 정규 좌표의 확신도 필드. 이진화는 도메인이 한다(§1.1-3). */
export interface ObjectDesignationField {
  width: number;
  height: number;
  /** [0,1], 행 우선. 길이 = width × height. */
  values: Float32Array;
}

export interface ObjectDesignationRequest {
  /** 키비주얼의 픽셀. 장변이 KV_MASK_MAX_EDGE로 잘린 상태로 온다. */
  image: ImageBitmap;
  /** 이미지 정규 좌표의 클릭 한 점. */
  point: {x: number; y: number};
  signal: AbortSignal;
}

export interface ObjectDesignator {
  /**
   * 런타임·모델을 가져와 초기화한다. 멱등. 이 호출 전에는 관련 네트워크 요청이
   * 0건이다(SC-A9) — 어댑터가 런타임을 동적 import로 가른다.
   */
  prepare(request: {signal: AbortSignal; onProgress: (ratio: number) => void}): Promise<Result<void>>;
  /** 점 하나 → 필드 하나. 여러 점의 합성은 도메인이 한다. */
  designate(request: ObjectDesignationRequest): Promise<Result<ObjectDesignationField>>;
  release(): void;
}
```

**왜 `designate`가 점 하나만 받는가.** 모델이 하는 일이 정확히 그것이고(v1
legacy는 `RegionOfInterest.keypoint` 한 점), 추가·제외 클릭을 **필드의 집합
연산**으로 도메인에 두면 세 가지가 따라온다:

1. 여유값 슬라이더가 점이 여러 개일 때도 추론 0이다 — 필드들이 세션에 남아 있다.
2. 합성 규칙이 순수 함수라 단위 테스트가 된다:
   `mask = ⋃(포함 필드 ≥ t) \ ⋃(제외 필드 ≥ t)`.
3. 어댑터가 얇게 남는다(NFR-A05) — v2로 옮기거나 scribble 한 번 호출로 묶는
   최적화가 생겨도 계약이 그대로다.

도메인 쪽 짝:

```ts
export const kvMaskFromFields = (
  include: readonly ObjectDesignationField[],
  exclude: readonly ObjectDesignationField[],
  threshold: number,
): KvMask;
```

비용은 점 하나당 한 번의 추론(실측 0.55~0.65초)이다. 제외 클릭도 추론 한 번이다
— "그 점의 오브젝트"를 얻어 빼는 것이기 때문이다.

### 5.2 자산 배송과 네트워크 (D-A03)

```ts
// shared/config/models.ts
export interface SegmentationModelConfig {
  /** Tasks Vision WASM 디렉터리. 빌드가 node_modules에서 배포본으로 복사(NFR-A08). */
  wasmBase: string;
  /** magic_touch.tflite 경로. 재배포 권리가 확인되면 같은-오리진으로 바꾼다. */
  modelUrl: string;
}
export const MAGIC_TOUCH_V1: SegmentationModelConfig = {...};
export const SEGMENTATION_NETWORK_NOTICE = '…';   // 한국어, TTS 고지와 같은 자리
```

Plan §2.3대로 **경로는 설정값이고 기본값은 Google의 버전 고정 URL**이다. 재배포
권리가 확인되면 `modelUrl`을 같은-오리진 경로로 바꾸는 한 줄이 D-A03의 완성이고,
확인 전까지 저장소에 커밋되는 바이너리는 없다. 설계에서 이 상수 하나 말고 파일의
출처에 의존하는 것은 없다.

---

## 6. 지정 세션의 상태 모델 (M4)

FR-A02가 요구하는 것은 "승인 전에는 프로젝트가 바뀌지 않는다"이므로, 세션은
**프로젝트 스토어가 아니라 로컬 상태**다(conventions §4의 "두 번째 소비자가
생기기 전까지 로컬").

```ts
type KvDesignationSession =
  | {phase: 'idle'}
  | {phase: 'preparing'; slotIndex: number; progress: number}
  | {phase: 'ready'; slotIndex: number}                       // 클릭을 기다린다
  | {phase: 'inferring'; slotIndex: number; picks: Pick[]}
  | {phase: 'proposed'; slotIndex: number; picks: Pick[]; threshold: number; preview: KvMask}
  | {phase: 'failed'; slotIndex: number; error: AppError};

interface Pick {
  point: {x: number; y: number};
  include: boolean;
  field: ObjectDesignationField;   // 세션에만 있다. 프로젝트에는 가지 않는다
}
```

| 전이 | 무엇이 일어나나 |
|---|---|
| `idle → preparing` | "AI로 지정" — 여기서 처음 모델 요청이 나간다(SC-A9) |
| `preparing → ready` / `failed` | 로드 성공/실패. 실패해도 사각형 지정은 그대로다(FR-A11) |
| `ready → inferring → proposed` | 클릭 한 번, 추론 한 번, `kvMaskFromFields`로 미리보기 |
| `proposed → proposed` (여유값) | **추론 없음** — 같은 필드를 다시 이진화(FR-A03) |
| `proposed → inferring → proposed` (추가/제외 클릭) | 점 하나 추론 후 재합성(FR-A04) |
| `proposed → idle` (승인) | `addKvMaskEffect` 또는 `updateKvEffect` — **여기서만** 프로젝트가 바뀐다 |
| `proposed → idle` (거절) | 아무것도 커밋하지 않는다. 사각형 경로가 그대로 남는다(FR-A05) |
| 어느 단계든 취소 | `AbortSignal`로 추론을 끊고 이전 phase로(NFR-A06) |

자동 후보(FR-A06)는 세션과 **독립**이다 — 모델이 없으므로 `preparing`을 지나지
않는다. KV를 열면 `kvLightRegions`가 후보 목록을 만들고, 각 항목의 승인이
`addKvMaskEffect`를 부른다. 즉 **모델을 한 번도 로드하지 않고 마스크 지정을 쓸 수
있는 경로**가 있다.

승인 후 여유값을 다시 만지려면 새 세션이다(필드는 저장하지 않는다 — §2.5). 저장할
수도 있었지만(점 목록 + 임계값 ≈ 50바이트) D-A07의 범위가 세션 중의 조절이므로
스키마를 늘리지 않았다.

---

## 7. Error Handling

`AppErrorCode`에 셋을 더한다 — 생산자는 M3의 어댑터다(conventions §5).

| 코드 | 언제 | 사용자 문구의 요지 |
|---|---|---|
| `DESIGNATION_MODEL_LOAD_FAILED` | 런타임·모델 로드 실패 | "AI 지정 모델을 불러오지 못했습니다. 사각형으로 직접 지정할 수 있습니다." |
| `DESIGNATION_FAILED` | 추론 실패 | "오브젝트를 찾지 못했습니다. 다른 지점을 눌러 보거나 사각형으로 지정하세요." |
| `DESIGNATION_CANCELLED` | 사용자 취소 | 토스트 없이 조용히 되돌린다 |

`SCHEMA_UNSUPPORTED`는 그대로 쓴다 — 런 길이 합이 격자 크기와 다른 마스크가
그것이다(§2.2-5). 지정 상한 도달은 에러가 아니라 추가 버튼 비활성이다(지난
사이클과 같다).

---

## 8. Test Plan

### 8.1 Unit — `domain/kvloop/mask.test.ts`, `lightRegions.test.ts` (신규)

| 검증 | 대상 |
|---|---|
| 인코드 → 디코드가 격자를 비트 단위로 되돌린다. 1로 시작하는 마스크(첫 런 0), 전부 0, 전부 1, 1×1 | D-A04 |
| 같은 격자는 같은 문자열(정규형), 런 길이 합 ≠ 격자면 파싱 실패 | §2.2 |
| 상한 초과 격자가 축소를 거쳐 상한 안으로 들어오고, 결과가 결정론적 | §2.2 |
| `kvImageBoxOf`가 `cover`·`contain` × 종횡비(가로·세로·정사각) 조합에서 §3.1 검산값 | D-A06 / SC-A4 |
| `kvCanvasToImage(kvImageToCanvas(p)) === p` | M4의 클릭 경로 |
| `bounds`가 셀에서 계산한 최소 사각형과 일치 | §3.2 |
| 같은 (시드, 프레임, 지정)이 같은 방출점, 다른 시드는 다르게 | FR-A07 / SC-A3 |
| 모든 방출점이 마스크 내부 셀 중심 위에 있다 | FR-A08 |
| 모든 파티클이 `kvParticlesReach` 안 | SC-A2 |
| `kvMaskFromFields`: 포함 합집합, 제외 차집합, 임계값 단조성(높이면 면적이 줄어든다) | FR-A03/A04 |
| `kvLightRegions`가 알려진 입력에 알려진 박스 — 밝은 사각 2개, 작은 점(상한 미만) 무시, 셀 수 내림차순 | D-A01 |

### 8.2 Unit — 스키마·커맨드 (`schema.test.ts`, `kvLoopCommands.test.ts`)

- 저장 문서 파싱: `shape` 없는 particles → `rect`, `region` 없는 glow → `circle`.
  **값이 한 자리도 바뀌지 않는다**(FR-A13).
- 잘못된 조합(glow + rect, particles + circle) 파싱 실패.
- 파싱 결과 재파싱 멱등.
- `addKvMaskEffect`/`updateKvEffect`의 클램프와 외부 템플릿 no-op.
- 스키마 상한 구성(슬롯 8 × 오브젝트 8, 마스크 전부 상한 크기)이
  `MAX_PROJECT_FILE_BYTES` 안에서 내보내지고 다시 읽힌다 (SC-A7).
- `buildKvLoopProps`가 로케일 이미지의 `width`·`height`를 싣고, 없으면 null.

### 8.3 M2 하네스 (§4.3) — 픽셀 판정

캔버스 내용은 DOM 문자열로 읽히지 않는다. 격리·비용·매핑은 하네스가, 최종 판정은
M5 실기기 게이트가 맡는다.

### 8.4 E2E (M4, 코덱 불필요)

- 자동 후보 승인 → 이펙트가 생기고 캔버스가 마운트된다.
- 여유값 슬라이더가 미리보기를 바꾸고 **네트워크 요청이 늘지 않는다**(FR-A03).
- "AI로 지정"을 누르기 전 모델 관련 요청 0건, 소재가 어떤 요청 본문에도 없다
  (SC-A9 / FR-A12) — 네트워크 관찰.
- 모델 로드를 강제 실패시켜도 편집·저장·렌더가 동작한다(SC-A8).

---

## 9. Architecture Compliance

- `domain/kvloop/mask.ts`·`lightRegions.ts`는 수학과 바이트뿐 — Remotion·DOM·모델
  런타임 임포트 없음(NFR-A04). `ImageBitmap`은 **포트 인터페이스의 타입**으로만
  나타난다(`MediaResolver`가 `File`을 받는 것과 같은 자리).
- 래스터·블러는 `compositions/kvloop/`에 — 도메인은 격자를 내고 뷰가 그린다.
- 모델 접근은 `infrastructure/vision/browserObjectDesignator.ts` 한 파일, 어댑터
  선택은 `src/app/App.tsx` 한 곳(NFR-A05). `architecture.test.ts`의 규칙표에
  `infrastructure/vision/`을 등록한다.
- `crypto.getRandomValues`는 이미 있는 예외 자리(`newKvEffectSeed`) 그대로 —
  이펙트 생성 시점 한 번이고, 프레임 함수에는 난수가 없다(D-03).

## 10. Implementation Order

| M | 내용 | 게이트 |
|---|---|---|
| M0 | 실소재 정확도 — 요청자 키비주얼 4장에 P0 하네스 (§4.1.1 유형 커버리지, 여유값 기본값) | 기준 확정(D-A10). **미달이면 Plan §5의 완화 순서** |
| M1 | 스키마·상수·커맨드 + `mask.ts`·`lightRegions.ts` | §8.1·§8.2 |
| — | ↳ M1은 글로우 필드 경로의 **기계적 정정**을 포함한다 — `effect.center`·`effect.radius`를 읽는 4곳(`KvEffectsCanvas` 3, `KvEffectOverlay` 4, `KvLoopInspector` 1, `updateKvEffect` 패치)이 `effect.region.…`이 된다. 새 UI가 아니라 타입 체크를 통과시키는 경로 변경이고, 값과 그리기 인수는 그대로다 | `npm run build` |
| M2 | `KvEffectsCanvas` 마스크 팔 + `KvScene` 통합 | §4.3 하네스 ①~⑤ |
| M3 | 포트·어댑터 + 자산 배송 | 단위(가짜 어댑터) + 네트워크 관찰 |
| M4 | UI — 클릭 지정, 후보 목록, 여유값, 추가/제외, 승인·거절 | §8.4 |
| M5 | 실기기 렌더 게이트 | SC-A1~SC-A10 |

M1·M2는 M0을 기다리지 않는다 — 스키마·좌표·인코딩·드로잉 중 실소재 정확도에
의존하는 것이 하나도 없다. M0이 바꿀 수 있는 것은 여유값 **기본값**과, 미달일 때
UI의 범위다.

## 11. Requirement Traceability

| FR | 설계 위치 |
|---|---|
| FR-A01 | §5.1, §6 |
| FR-A02 | §6 (승인만이 커맨드를 부른다) |
| FR-A03 | §5.1 (필드 반환), §6 |
| FR-A04 | §5.1 (`kvMaskFromFields`) |
| FR-A05 | §6, §2.1 (rect 팔이 남는다) |
| FR-A06 | §3.5 |
| FR-A07 | §2.2 (값으로 굳는다), §3.3 (닫힌 식) |
| FR-A08 | §3.3, §4.1 |
| FR-A09 | §3.1, §2.4 |
| FR-A10 | §5.2, §6 (`preparing`이 첫 요청) |
| FR-A11 | §6 (`failed`), §7 |
| FR-A12 | §5.1 (이미지는 인자로 들어갈 뿐) |
| FR-A13 | §2.1 (preprocess + 그리기 인수 불변), §4.2 |
| NFR-A01 | §2.3 (`MAX_KV_MASK_RLE_CHARS`의 산술) |
| NFR-A02 | §4.2 (조건부 마운트 유지) |
| NFR-A03 | §4.1, §4.3 ② |
| NFR-A04 | §9 |
| NFR-A05 | §5.1, §9 |
| NFR-A06 | §5.1, §6 |
| NFR-A07 | §2.1 |
| NFR-A08 | §5.2 |

---

## 12. 확인이 필요한 것 — M1 착수 전

| # | 항목 | 설계의 선택 | 대안 |
|---|---|---|---|
| 1 | **글로우의 `center`·`radius`가 `region` 안으로 들어간다** | 형태 축을 하나로 두는 D-A05의 귀결. 그리기 인수는 그대로여서 렌더는 동일 | 글로우만 예외로 두고 마스크를 별도 필드로 — 그러면 "어디에"가 두 곳이 된다 |
| 2 | **자동 후보가 사각형이 아니라 마스크로 승격된다** | 셀이 이미 있으므로 공짜고, 원화에 붙고 모양을 따른다 | 사각형으로 승격 — 지난 사이클과 같은 형태지만 세 이점을 버린다 |
| 3 | **여유값·클릭 점을 저장하지 않는다** | 승인 후 재조절은 새 세션(추론 다시). 스키마가 마스크 하나로 끝난다 | 점 목록·임계값을 함께 저장해 "다시 지정"을 예약 — 50바이트, 범위 밖 |
| 4 | **임계값 기본값 0.3(잠정)** | 실측은 "0.5는 아니다"까지만 말한다. 최종값은 M0 | M0까지 0.5로 두기 — 실측에 반한다 |

---

## Version History

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 0.1.0 | 2026-08-27 | 김성권 / Claude | 최초 작성 — D-A01~D-A10을 설계로. 지정 형태 유니온(§2.1), RLE 형식(§2.2), objectFit 매핑(§3.1), 마스크 방출점(§3.3), 글로우 실루엣 캐시(§4.1), 포트 계약(§5), 세션 상태 모델(§6) |
