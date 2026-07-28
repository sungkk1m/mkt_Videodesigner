// Design Ref: §1.3 CTA — dedicated media when present, otherwise a background
// generated from the last gameplay frame, plus app icon, logo, CTA text,
// optional subcopy, and store badge. No legal disclaimer field (§3.2).
import {AbsoluteFill, Freeze, Img, useVideoConfig} from 'remotion';

import type {CtaRenderProps, SceneRenderProps} from '../../domain/editor/types';
import {CANVAS_COLOR, SceneVideo} from '../shared/SceneVideo';

const CtaBackground = ({
  cta,
  scene,
  src,
}: {
  cta: CtaRenderProps;
  scene: SceneRenderProps;
  src: string | null;
}) => {
  const framing = {
    scale: scene.scale,
    x: scene.x,
    y: scene.y,
    blur: cta.backgroundBlur,
    muted: true,
  };

  if (cta.mediaUrl) {
    return (
      <SceneVideo
        {...framing}
        src={cta.mediaUrl}
        trimAfterFrames={scene.durationInFrames}
        trimBeforeFrames={0}
      />
    );
  }

  if (src && cta.freezeSourceFrame !== null) {
    // Freeze pins children to frame 0, so the source position comes entirely
    // from `trimBefore`: the last gameplay frame, held for the whole scene.
    return (
      <Freeze frame={0}>
        <SceneVideo
          {...framing}
          src={src}
          trimAfterFrames={cta.freezeSourceFrame + 1}
          trimBeforeFrames={cta.freezeSourceFrame}
        />
      </Freeze>
    );
  }

  if (src) {
    return (
      <SceneVideo
        {...framing}
        src={src}
        trimAfterFrames={scene.trimAfterFrames}
        trimBeforeFrames={scene.trimBeforeFrames}
      />
    );
  }

  return <AbsoluteFill style={{backgroundColor: CANVAS_COLOR}} />;
};

export const CtaScene = ({
  cta,
  scene,
  src,
}: {
  cta: CtaRenderProps;
  scene: SceneRenderProps;
  src: string | null;
}) => {
  const {width} = useVideoConfig();

  return (
    <AbsoluteFill>
      <CtaBackground cta={cta} scene={scene} src={src} />

      {cta.backgroundDim > 0 ? (
        <AbsoluteFill
          style={{backgroundColor: `rgba(0, 0, 0, ${cta.backgroundDim})`}}
        />
      ) : null}

      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: width * 0.03,
          padding: '10%',
          textAlign: 'center',
        }}
      >
        {cta.appIconUrl ? (
          <Img
            src={cta.appIconUrl}
            style={{
              width: width * 0.22,
              height: width * 0.22,
              borderRadius: width * 0.05,
              objectFit: 'cover',
            }}
          />
        ) : null}

        {cta.logoUrl ? (
          <Img
            src={cta.logoUrl}
            style={{width: width * 0.34, objectFit: 'contain'}}
          />
        ) : null}

        {cta.text ? (
          <span
            style={{
              color: '#ffffff',
              fontFamily: 'system-ui, sans-serif',
              fontSize: width * 0.085,
              fontWeight: 800,
              lineHeight: 1.2,
              textShadow: '0 4px 24px rgba(0, 0, 0, 0.55)',
            }}
          >
            {cta.text}
          </span>
        ) : null}

        {cta.subcopy ? (
          <span
            style={{
              color: '#dfe3e8',
              fontFamily: 'system-ui, sans-serif',
              fontSize: width * 0.04,
              fontWeight: 500,
            }}
          >
            {cta.subcopy}
          </span>
        ) : null}

        {cta.storeBadgeUrl ? (
          <Img
            src={cta.storeBadgeUrl}
            style={{width: width * 0.4, objectFit: 'contain'}}
          />
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
