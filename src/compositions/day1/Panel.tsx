// Day1 Design Ref: §5.2 — one panel of a comparison frame: the live one plays,
// an idle one holds its own trim-in frame in greyscale, and `contain` draws a
// blurred copy behind whatever the framing leaves uncovered.
//
// day1-quad Design §6.2 — extracted from `SplitFrame.tsx` as a pure move so the
// two-panel split and the four-panel grid draw an identical panel. Nothing about
// the markup, the filters, or the constants changed in the move; the Day1 E2E
// that measures greyscale and the divider's pixels is the gate on that.
//
// Plan SC2: the greyscale must survive into the MP4, which is why it is a CSS
// filter on the video element rather than a preview-only overlay.
import {Video} from '@remotion/media';
import {AbsoluteFill, Freeze} from 'remotion';

import type {
  Day1LabelStyle,
  Day1PanelRenderProps,
  PanelRect,
} from '../../domain/editor/types';
import {CANVAS_COLOR} from '../shared/SceneVideo';
import {hexToRgba} from '../shared/color';

const JUSTIFY = {
  top: 'flex-start',
  center: 'center',
  bottom: 'flex-end',
} as const;

/**
 * day1-label-effects §5.4 — the plate's inset and corner are the subtitle's
 * (`SubtitleOverlay`), so the two overlays read as one system and neither gains
 * a control the operator has to keep in sync with the other.
 */
const BOX_PADDING = '0.3em 0.6em';
const BOX_RADIUS = 8;

/**
 * day1-label-effects FR-03/FR-07 — one halo shape for both glows: a tight layer
 * that reads as an edge and a doubled one that carries the falloff. Only the
 * shape is shared; each glow passes its own colour and radius.
 */
const halo = (strengthPx: number, color: string) =>
  `0 0 ${strengthPx}px ${color}, 0 0 ${strengthPx * 2}px ${color}`;

/**
 * Day1 Design Ref: §5.2 — heavy outlined text. `paintOrder: 'stroke'` draws the
 * stroke behind the glyph so a thick outline never eats into the letter shape,
 * which is what the reference GIF's lettering does.
 *
 * day1-label-effects Q4 — the plate and the glyph glow are independent: the
 * glyph glow is a shadow on the same element as the plate's background, so with
 * both on it reads inside the plate rather than around it. That is the
 * documented behaviour, not a state the component prevents.
 *
 * FR-07 — the plate carries its own halo through `box-shadow`, which draws
 * around the plate's rectangle instead of the letters. It is a second set of
 * fields on purpose: the two glows never share a colour or a radius.
 */
const PanelLabel = ({
  label,
  style,
}: {
  label: string;
  style: Day1LabelStyle;
}) => (
  <AbsoluteFill
    style={{
      alignItems: 'center',
      justifyContent: JUSTIFY[style.position],
      padding: '6%',
    }}
  >
    <span
      style={{
        backgroundColor: style.showBackground
          ? hexToRgba(style.backgroundColor, style.backgroundOpacity)
          : 'transparent',
        borderRadius: BOX_RADIUS,
        // FR-07 — a halo with no plate to sit on would draw a glowing rectangle
        // around invisible bounds, so it follows the plate rather than standing
        // on its own. The stored settings survive the plate being switched off.
        boxShadow:
          style.showBackground && style.boxGlowEnabled
            ? halo(style.boxGlowStrengthPx, style.boxGlowColor)
            : undefined,
        color: style.textColor,
        fontFamily: 'system-ui, sans-serif',
        fontSize: style.fontSize,
        fontWeight: 900,
        letterSpacing: '0.02em',
        lineHeight: 1.2,
        padding: style.showBackground ? BOX_PADDING : 0,
        paintOrder: 'stroke',
        textAlign: 'center',
        // FR-03 — `text-shadow` rather than `filter: drop-shadow`: drop-shadow
        // would trace the plate's rectangle instead of the letters, and it
        // rasterises the element every frame.
        textShadow: style.glowEnabled
          ? halo(style.glowStrengthPx, style.glowColor)
          : undefined,
        WebkitTextStroke: `${style.outlineWidthPx}px ${style.outlineColor}`,
        whiteSpace: 'pre-wrap',
      }}
    >
      {label}
    </span>
  </AbsoluteFill>
);

/**
 * day1-video — the blurred backdrop `contain` draws behind the source, so the
 * space `contain` leaves reads as part of the shot instead of dead canvas.
 *
 * Sized as a fraction of the panel so it looks the same at every output ratio.
 * The blur fades an element out at its own edges, so the backdrop is overscanned
 * far enough that the faded rim lands outside the panel's clip.
 */
const BACKDROP_BLUR_RATIO = 0.05;
const BACKDROP_OVERSCAN = 1.2;

export const Panel = ({
  labelStyle,
  live,
  liveVolume,
  panel,
  rect,
}: {
  labelStyle: Day1LabelStyle;
  live: boolean;
  liveVolume: (panelFrame: number) => number;
  panel: Day1PanelRenderProps;
  rect: PanelRect;
}) => {
  const framing = {
    height: '100%',
    width: '100%',
    transform: `translate(${panel.x}%, ${panel.y}%) scale(${panel.scale})`,
  };

  return (
    <div
      style={{
        backgroundColor: CANVAS_COLOR,
        height: rect.height,
        left: rect.x,
        overflow: 'hidden',
        position: 'absolute',
        top: rect.y,
        width: rect.width,
      }}
    >
      {/* One frame, held for the section — the same Freeze trick the idle panel
          below uses, so the backdrop costs a single decode rather than a second
          video stream. Deliberately ignores the panel's own framing: it exists to
          fill the panel edge to edge whatever the foreground does. */}
      {panel.fit === 'contain' && panel.url !== null ? (
        // AbsoluteFill takes the backdrop out of flow. In normal flow its 100%
        // height would consume the panel and push the source below the clip.
        <AbsoluteFill>
          <Freeze frame={0}>
            <Video
              muted
              objectFit="cover"
              src={panel.url}
              style={{
                // Plan SC2 — the idle panel is greyscale, so its backdrop has to
                // be too, or a colour halo gives the desaturation away.
                filter:
                  `blur(${BACKDROP_BLUR_RATIO * rect.width}px)` +
                  (live ? '' : ' grayscale(1)'),
                height: '100%',
                transform: `scale(${BACKDROP_OVERSCAN})`,
                width: '100%',
              }}
              trimAfter={panel.trimBeforeFrames + 1}
              trimBefore={panel.trimBeforeFrames}
            />
          </Freeze>
        </AbsoluteFill>
      ) : null}

      {panel.url === null ? null : live ? (
        <Video
          objectFit={panel.fit}
          src={panel.url}
          style={framing}
          trimAfter={panel.trimAfterFrames}
          trimBefore={panel.trimBeforeFrames}
          // Plan D7 / Design §5.2: the live panel carries the original sound
          // through the shared ducking curve (`domain/audio/ducking.ts`).
          volume={liveVolume}
        />
      ) : (
        // Freeze pins its children to frame 0, so `trimBefore` alone chooses
        // which source frame is held — the panel's own trim-in (Design D11).
        <Freeze frame={0}>
          <Video
            muted
            objectFit={panel.fit}
            src={panel.url}
            style={{...framing, filter: 'grayscale(1)'}}
            trimAfter={panel.trimBeforeFrames + 1}
            trimBefore={panel.trimBeforeFrames}
          />
        </Freeze>
      )}

      {panel.label ? <PanelLabel label={panel.label} style={labelStyle} /> : null}
    </div>
  );
};
