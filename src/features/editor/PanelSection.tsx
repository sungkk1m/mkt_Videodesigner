// failure-video Design §4.1-1 — extracted from `Day1Inspector.tsx` as a pure
// move so a second panelled inspector can assemble the same trim + framing
// block. Nothing about the markup, the constants, or the test ids changed in
// the move; the Day1 trim E2E is the gate on that.
import type {Day1PanelKey} from '../../domain/editor/project';
import {
  MAX_OFFSET_PERCENT,
  MAX_SCALE,
  MEDIA_FITS,
  MIN_SCALE,
  type AspectRatio,
  type Day1Panel,
  type Day1PanelSlot,
  type MediaFit,
  type MediaTransform,
  type PanelRect,
} from '../../domain/editor/types';
import {quadLayout, splitLayout} from '../../domain/day1/layout';
import {InspectorSection} from './InspectorSection';
import {TrimStrip} from './TrimStrip';
import type {FrameSampler} from '../../domain/ports';
import {
  PercentField,
  PlainField,
  SecondsField,
  formatSeconds,
} from './inspectorFields';

const PANEL_TITLES: Record<Day1PanelKey, string> = {
  panelA: '패널 A',
  panelB: '패널 B',
  panelC: '패널 C',
  panelD: '패널 D',
};

/** The panel's letter, used for test ids and for the copy block's label keys. */
export const PANEL_TEST_KEY: Record<Day1PanelKey, Day1PanelSlot> = {
  panelA: 'a',
  panelB: 'b',
  panelC: 'c',
  panelD: 'd',
};

/** day1-quad Design §5.1 — a panel's own slot in the output, for the trim preview. */
const PANEL_RECT = (
  panels: readonly Day1PanelKey[],
  key: Day1PanelKey,
  ratio: AspectRatio,
  lineWidthPx: number,
): PanelRect => {
  const index = panels.indexOf(key);

  return panels.length > 2
    ? (quadLayout(ratio, lineWidthPx).cells[index] as PanelRect)
    : (splitLayout(ratio, lineWidthPx)[index === 0 ? 'a' : 'b'] as PanelRect);
};

/** day1-video — what each fit does to a source that is not the panel's shape. */
const FIT_LABELS: Record<MediaFit, string> = {
  cover: '꽉 채우기',
  contain: '전체 보기',
};

export const PanelSection = ({
  disabled,
  durationMs,
  frameSampler,
  hasOverride,
  panel,
  panelData,
  panelKeys,
  lineWidthPx,
  ratio,
  transform,
  url,
  onResetTransform,
  onToggleRatioOverride,
  onTransform,
  onTrimIn,
}: {
  disabled: boolean;
  durationMs: number;
  frameSampler: FrameSampler;
  hasOverride: boolean;
  panel: Day1PanelKey;
  panelData: Day1Panel;
  panelKeys: readonly Day1PanelKey[];
  lineWidthPx: number;
  ratio: AspectRatio;
  transform: MediaTransform;
  /** Session URL of this panel's video, or null while it is unresolved. */
  url: string | null;
  onResetTransform: () => void;
  onToggleRatioOverride: (enabled: boolean) => void;
  onTransform: (patch: Partial<MediaTransform>) => void;
  onTrimIn: (ms: number) => void;
}) => {
  const key = PANEL_TEST_KEY[panel];
  const {source, trim} = panelData;
  // day1-video — the panel's own slot in the output, so the strip's preview can
  // show the crop the render will make instead of the whole source. Half of a
  // 9:16 frame is landscape, which is why letterboxing a portrait source into a
  // 16:9 box left most of the box black. A quad cell is a quarter, and carries
  // the output's own aspect ratio (day1-quad Design §5.1).
  const rect = PANEL_RECT(panelKeys, panel, ratio, lineWidthPx);
  const sourceMs = source?.durationMs ?? 0;
  const controlsDisabled = disabled || sourceMs <= 0;
  // FR-S02. Mirrors `day1PanelsShorterThanSection`, which the render gate uses.
  const isShortSource = sourceMs > 0 && sourceMs < durationMs;

  return (
    <InspectorSection
      badge={hasOverride ? `${ratio} 전용` : `${formatSeconds(durationMs)}s`}
      defaultOpen
      id={`day1-panel-${key}`}
      title={PANEL_TITLES[panel]}
    >
      {sourceMs > 0 ? null : (
        <p className="notice notice--warning">
          이 패널의 영상을 올리면 Trim과 프레이밍을 조절할 수 있습니다.
        </p>
      )}

      {/* Day1 Trim UX FR-T01, FR-T02 — pick the interval by looking at it. */}
      <TrimStrip
        backdrop={transform.fit === 'contain'}
        disabled={controlsDisabled}
        framing={{aspectRatio: rect.width / rect.height, transform}}
        inMs={trim.inMs}
        onCommit={onTrimIn}
        sampler={frameSampler}
        sectionDurationMs={durationMs}
        sourceDurationMs={sourceMs}
        sourceId={source?.id ?? null}
        testIdPrefix={`day1-${key}`}
        url={url}
      />

      {/* Day1 Trim UX FR-T06 — kept alongside the strip, sharing `onTrimIn`, so
          the two stay in sync and 0.1s precision survives the strip's pixel
          resolution (Plan §5). */}
      <SecondsField
        disabled={controlsDisabled}
        label="Trim In (초)"
        max={sourceMs}
        min={0}
        onCommit={onTrimIn}
        testId={`day1-${key}-trim-in`}
        valueMs={trim.inMs}
      />
      {/* Day1 Trim UX FR-T07 — `reconcileTrim` derives the out point from the in
          point, so showing it as an input invited edits that were discarded. */}
      <p className="field field--readout">
        <span>
          Trim Out (초)
          <strong data-testid={`day1-${key}-trim-out`}>
            {formatSeconds(trim.outMs)}
          </strong>
        </span>
      </p>
      <p className="panel__hint" data-testid={`day1-${key}-trim-range`}>
        소스 구간 {formatSeconds(trim.inMs)}s – {formatSeconds(trim.outMs)}s · 구간{' '}
        {formatSeconds(durationMs)}s
        {sourceMs > 0 ? ` · 원본 ${formatSeconds(sourceMs)}s` : ''}
      </p>
      {/* Day1 Trim UX FR-S02 — the three-scene inspector has said this since the
          start; Day1 was the one template where it went unsaid. Unlike the
          three-scene wording this names both ways out, because a Day1 section is
          resized by dragging the timeline boundary (Plan SC5). */}
      {isShortSource ? (
        <p className="notice notice--warning" data-testid={`day1-${key}-trim-short`}>
          원본이 구간보다 짧아 남은 시간은 검은 화면으로 출력됩니다. 구간 길이를
          줄이거나 더 긴 영상을 사용하세요.
        </p>
      ) : null}

      {/* day1-video — half of a 9:16 frame is landscape, so a portrait capture
          either loses half its height or keeps all of it against the blurred
          backdrop. That is a per-panel call, not a fixed one. */}
      <p className="field field--readout">
        <span>Fit</span>
      </p>
      <div className="segmented">
        {MEDIA_FITS.map((fit) => (
          <button
            aria-pressed={transform.fit === fit}
            className={`segmented__item${
              transform.fit === fit ? ' segmented__item--on' : ''
            }`}
            data-testid={`day1-${key}-fit-${fit}`}
            disabled={controlsDisabled}
            key={fit}
            onClick={() => onTransform({fit})}
            type="button"
          >
            {FIT_LABELS[fit]}
          </button>
        ))}
      </div>
      <p className="panel__hint">
        {transform.fit === 'cover'
          ? '패널을 꽉 채우고 넘치는 부분은 잘립니다. Y로 어느 부분을 살릴지 고르세요.'
          : '원본을 모두 남기고, 남는 자리는 원본을 흐리게 깐 배경으로 채웁니다. Scale을 올리면 점점 잘립니다.'}
      </p>
      <label className="field field--toggle">
        <input
          checked={hasOverride}
          data-testid={`day1-${key}-ratio-override`}
          disabled={controlsDisabled}
          onChange={(event) => onToggleRatioOverride(event.target.checked)}
          type="checkbox"
        />
        <span>{ratio} 전용 프레이밍 사용</span>
      </label>
      <PercentField
        disabled={controlsDisabled}
        label="Scale"
        max={MAX_SCALE}
        min={MIN_SCALE}
        onChange={(scale) => onTransform({scale})}
        step={0.01}
        testId={`day1-${key}-scale`}
        value={transform.scale}
      />
      <PlainField
        disabled={controlsDisabled}
        label="X"
        max={MAX_OFFSET_PERCENT}
        min={-MAX_OFFSET_PERCENT}
        onChange={(x) => onTransform({x})}
        step={1}
        suffix="%"
        testId={`day1-${key}-x`}
        value={transform.x}
      />
      <PlainField
        disabled={controlsDisabled}
        label="Y"
        max={MAX_OFFSET_PERCENT}
        min={-MAX_OFFSET_PERCENT}
        onChange={(y) => onTransform({y})}
        step={1}
        suffix="%"
        testId={`day1-${key}-y`}
        value={transform.y}
      />
      <button
        className="button button--secondary"
        disabled={controlsDisabled}
        onClick={onResetTransform}
        type="button"
      >
        프레이밍 초기화
      </button>
    </InspectorSection>
  );
};
