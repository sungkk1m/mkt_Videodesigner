// steam-review Design Ref: §9 — the right column: the trim window picked on the
// footage (TrimStrip, the Day1 idiom), the video slot framing, and the key art's
// per-placement crop (D-4). The window is as long as the output, which follows
// the gameplay source, so it arrives as a prop. Wording lives in the copy tab.
import {
  MAX_OFFSET_PERCENT,
  MAX_SCALE,
  MIN_SCALE,
  type AspectRatio,
  type MediaReference,
  type MediaTransform,
} from '../../domain/editor/types';
import {steamReviewLayout} from '../../domain/steamreview/layout';
import type {FrameSampler} from '../../domain/ports';
import {InspectorSection} from './InspectorSection';
import {PercentField, PlainField, SecondsField, formatSeconds} from './inspectorFields';
import {TrimStrip} from './TrimStrip';

/** Scale/X/Y plus the per-ratio override toggle — the scene framing idiom. */
const FramingFields = ({
  disabled,
  hasOverride,
  ratio,
  testKey,
  transform,
  onToggleOverride,
  onTransform,
  onReset,
}: {
  disabled: boolean;
  hasOverride: boolean;
  ratio: AspectRatio;
  testKey: string;
  transform: MediaTransform;
  onToggleOverride: (enabled: boolean) => void;
  onTransform: (patch: Partial<MediaTransform>) => void;
  onReset: () => void;
}) => (
  <>
    <label className="field field--toggle">
      <input
        checked={hasOverride}
        data-testid={`${testKey}-ratio-override`}
        disabled={disabled}
        onChange={(event) => onToggleOverride(event.target.checked)}
        type="checkbox"
      />
      <span>{ratio} 전용 프레이밍 사용</span>
    </label>
    <PercentField
      disabled={disabled}
      label="Scale"
      max={MAX_SCALE}
      min={MIN_SCALE}
      onChange={(scale) => onTransform({scale})}
      step={0.01}
      testId={`${testKey}-scale`}
      value={transform.scale}
    />
    <PlainField
      disabled={disabled}
      label="X"
      max={MAX_OFFSET_PERCENT}
      min={-MAX_OFFSET_PERCENT}
      onChange={(x) => onTransform({x})}
      step={1}
      suffix="%"
      testId={`${testKey}-x`}
      value={transform.x}
    />
    <PlainField
      disabled={disabled}
      label="Y"
      max={MAX_OFFSET_PERCENT}
      min={-MAX_OFFSET_PERCENT}
      onChange={(y) => onTransform({y})}
      step={1}
      suffix="%"
      testId={`${testKey}-y`}
      value={transform.y}
    />
    <button
      className="button button--secondary"
      data-testid={`${testKey}-reset`}
      disabled={disabled}
      onClick={onReset}
      type="button"
    >
      프레이밍 초기화
    </button>
  </>
);

export interface SteamReviewInspectorProps {
  ratio: AspectRatio;
  disabled: boolean;
  /**
   * The project's length in seconds. It is also the trim window's length: the
   * store page plays one continuous cut, so the window is the whole output.
   */
  durationS: number;
  frameSampler: FrameSampler;
  trim: {inMs: number; outMs: number};
  /** D-5 — the shortest of every uploaded source; the trim drags against it. */
  trimBoundMs: number;
  /** The selected locale's resolved source, for the strip's preview. */
  sourceReference: MediaReference | null;
  sourceUrl: string | null;
  videoTransform: MediaTransform;
  videoHasOverride: boolean;
  keyArtTransform: MediaTransform;
  keyArtHasOverride: boolean;
  hasKeyArt: boolean;
  onTrimIn: (ms: number) => void;
  onTransform: (patch: Partial<MediaTransform>) => void;
  onResetTransform: () => void;
  onToggleRatioOverride: (enabled: boolean) => void;
  onKeyArtTransform: (patch: Partial<MediaTransform>) => void;
  onResetKeyArtTransform: () => void;
  onToggleKeyArtRatioOverride: (enabled: boolean) => void;
}

export const SteamReviewInspector = ({
  ratio,
  disabled,
  durationS,
  frameSampler,
  trim,
  trimBoundMs,
  sourceReference,
  sourceUrl,
  videoTransform,
  videoHasOverride,
  keyArtTransform,
  keyArtHasOverride,
  hasKeyArt,
  onTrimIn,
  onTransform,
  onResetTransform,
  onToggleRatioOverride,
  onKeyArtTransform,
  onResetKeyArtTransform,
  onToggleKeyArtRatioOverride,
}: SteamReviewInspectorProps) => {
  const layout = steamReviewLayout(ratio);
  const windowMs = durationS * 1000;
  const controlsDisabled = disabled || trimBoundMs <= 0;
  // 1:1 shows no key art at all (Plan Q11); the sidebar and banner do.
  const keyArtVisibleHere = ratio !== '1:1';

  return (
    <aside aria-label="스팀리뷰 속성" className="inspector">
      <div className="inspector__head">
        <h2>인스펙터</h2>
        <span className="inspector__scene" data-testid="inspector-template">
          스팀리뷰
        </span>
      </div>

      <div className="inspector__body">
        <InspectorSection
          badge={`${durationS}s`}
          defaultOpen
          id="steam-gameplay"
          title="게임플레이"
        >
          {trimBoundMs > 0 ? null : (
            <p className="notice notice--warning">
              게임플레이 영상을 올리면 Trim과 프레이밍을 조절할 수 있습니다.
            </p>
          )}

          <TrimStrip
            disabled={controlsDisabled}
            framing={{
              aspectRatio: layout.video.w / layout.video.h,
              transform: videoTransform,
            }}
            inMs={trim.inMs}
            onCommit={onTrimIn}
            sampler={frameSampler}
            sectionDurationMs={windowMs}
            sourceDurationMs={trimBoundMs}
            sourceId={sourceReference?.id ?? null}
            testIdPrefix="steam-review"
            url={sourceUrl}
          />

          <SecondsField
            disabled={controlsDisabled}
            label="Trim In (초)"
            max={trimBoundMs}
            min={0}
            onCommit={onTrimIn}
            testId="steam-trim-in"
            valueMs={trim.inMs}
          />
          <p className="field field--readout">
            <span>
              Trim Out (초)
              <strong data-testid="steam-trim-out">
                {formatSeconds(trim.outMs)}
              </strong>
            </span>
          </p>
          <p className="panel__hint" data-testid="steam-trim-range">
            소스 구간 {formatSeconds(trim.inMs)}s – {formatSeconds(trim.outMs)}s
            · 창 {durationS}s
            {trimBoundMs > 0 ? ` · 사용 가능 ${formatSeconds(trimBoundMs)}s` : ''}
          </p>
          {/* D-5 — the bound is the shortest source across every locale. */}
          {trimBoundMs > 0 && trimBoundMs < windowMs ? (
            <p className="notice notice--warning" data-testid="steam-trim-short">
              가장 짧은 소스가 {formatSeconds(trimBoundMs)}s라 트림 창이
              그만큼으로 줄었습니다. 남는 시간은 검은 화면으로 출력됩니다.
            </p>
          ) : null}

          <FramingFields
            disabled={controlsDisabled}
            hasOverride={videoHasOverride}
            onReset={onResetTransform}
            onToggleOverride={onToggleRatioOverride}
            onTransform={onTransform}
            ratio={ratio}
            testKey="steam-video"
            transform={videoTransform}
          />
        </InspectorSection>

        <InspectorSection
          badge={keyArtVisibleHere ? undefined : '1:1 미표시'}
          id="steam-keyart"
          title="키아트 프레이밍"
        >
          {hasKeyArt ? null : (
            <p className="notice notice--warning">
              키아트 이미지를 올리면 프레이밍을 조절할 수 있습니다.
            </p>
          )}
          {keyArtVisibleHere ? null : (
            <p className="panel__hint" data-testid="steam-keyart-hidden">
              1:1 화면에는 키아트가 나오지 않습니다. 16:9·9:16에서 조절하세요.
            </p>
          )}
          {/* D-4 — the sidebar (2.0:1) and the banner (3.48:1) crop apart, so
              the override follows the ratio being previewed. */}
          <FramingFields
            disabled={disabled || !hasKeyArt}
            hasOverride={keyArtHasOverride}
            onReset={onResetKeyArtTransform}
            onToggleOverride={onToggleKeyArtRatioOverride}
            onTransform={onKeyArtTransform}
            ratio={ratio}
            testKey="steam-keyart"
            transform={keyArtTransform}
          />
        </InspectorSection>
      </div>
    </aside>
  );
};
