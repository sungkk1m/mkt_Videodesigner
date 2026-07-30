// Day1 Design Ref: §5.2 SplitFrame — the live panel plays while the other holds
// its own trim-in frame in greyscale, with the divider drawn between them.
//
// Plan SC2: the greyscale must survive into the MP4, which is why it is a CSS
// filter on the video element rather than a preview-only overlay.
import {Video} from '@remotion/media';
import {AbsoluteFill, Freeze} from 'remotion';

import type {
  ActivePanel,
  Day1LabelStyle,
  Day1PanelRenderProps,
  PanelRect,
  SplitLayout,
} from '../../domain/editor/types';
import {CANVAS_COLOR} from '../shared/SceneVideo';

const JUSTIFY = {
  top: 'flex-start',
  center: 'center',
  bottom: 'flex-end',
} as const;

/**
 * Day1 Design Ref: §5.2 — heavy outlined text. `paintOrder: 'stroke'` draws the
 * stroke behind the glyph so a thick outline never eats into the letter shape,
 * which is what the reference GIF's lettering does.
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
        color: style.textColor,
        fontFamily: 'system-ui, sans-serif',
        fontSize: style.fontSize,
        fontWeight: 900,
        letterSpacing: '0.02em',
        lineHeight: 1.2,
        paintOrder: 'stroke',
        textAlign: 'center',
        WebkitTextStroke: `${style.outlineWidthPx}px ${style.outlineColor}`,
        whiteSpace: 'pre-wrap',
      }}
    >
      {label}
    </span>
  </AbsoluteFill>
);

const Panel = ({
  labelStyle,
  live,
  originalVolume,
  panel,
  rect,
}: {
  labelStyle: Day1LabelStyle;
  live: boolean;
  originalVolume: number;
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
      {panel.url === null ? null : live ? (
        <Video
          objectFit="cover"
          src={panel.url}
          style={framing}
          trimAfter={panel.trimAfterFrames}
          trimBefore={panel.trimBeforeFrames}
          // Plan D7: the live panel carries the original sound. Day1 has no
          // narration (Plan §2.2), so there is nothing to duck against.
          volume={originalVolume}
        />
      ) : (
        // Freeze pins its children to frame 0, so `trimBefore` alone chooses
        // which source frame is held — the panel's own trim-in (Design D11).
        <Freeze frame={0}>
          <Video
            muted
            objectFit="cover"
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

export interface SplitFrameProps {
  active: ActivePanel;
  labelStyle: Day1LabelStyle;
  layout: SplitLayout;
  lineColor: string;
  originalVolume: number;
  panelA: Day1PanelRenderProps;
  panelB: Day1PanelRenderProps;
}

export const SplitFrame = ({
  active,
  labelStyle,
  layout,
  lineColor,
  originalVolume,
  panelA,
  panelB,
}: SplitFrameProps) => (
  <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}}>
    <Panel
      labelStyle={labelStyle}
      live={active === 'a'}
      originalVolume={originalVolume}
      panel={panelA}
      rect={layout.a}
    />
    <Panel
      labelStyle={labelStyle}
      live={active === 'b'}
      originalVolume={originalVolume}
      panel={panelB}
      rect={layout.b}
    />

    {/* Plan SC4: the divider is a solid fill so its rendered pixels equal the
        configured hex exactly, with no blending to measure against. */}
    <div
      data-testid="day1-split-line"
      style={{
        backgroundColor: lineColor,
        height: layout.line.height,
        left: layout.line.x,
        position: 'absolute',
        top: layout.line.y,
        width: layout.line.width,
      }}
    />
  </AbsoluteFill>
);
