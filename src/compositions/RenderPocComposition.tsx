// Design Ref: §2.4 Performance Gate — deterministic frames and AAC audio for browser benchmarks.
import {Audio} from '@remotion/media';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

/** Props of this composition. The renderer adapter consumes this contract. */
export interface PocCompositionProps {
  audioSrc: string;
  label: string;
}

const COLORS = {
  canvas: '#111318',
  panel: '#f4f5f7',
  accent: '#2f6fed',
  signal: '#f2b84b',
  text: '#f7f8fa',
};

export const RenderPocComposition = ({
  audioSrc,
  label,
}: PocCompositionProps) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const entrance = spring({
    frame,
    fps,
    config: {
      damping: 18,
      mass: 0.8,
      stiffness: 140,
    },
  });
  const sweep = interpolate(
    frame % (fps * 3),
    [0, fps * 3],
    [-width * 0.2, width],
  );
  const pulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 2),
    [-1, 1],
    [0.92, 1.08],
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.canvas,
        color: COLORS.text,
        fontFamily: 'Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '8%',
          left: '8%',
          right: '8%',
          height: '2%',
          backgroundColor: COLORS.signal,
          transform: `translateX(${sweep}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '18% 8%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '8%',
          backgroundColor: COLORS.panel,
          color: COLORS.canvas,
          border: `12px solid ${COLORS.accent}`,
          opacity: entrance,
          transform: `scale(${0.8 + entrance * 0.2})`,
        }}
      >
        <div
          style={{
            fontSize: width * 0.055,
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          Browser Render PoC
        </div>
        <div
          style={{
            marginTop: '5%',
            fontSize: width * 0.032,
            lineHeight: 1.35,
          }}
        >
          {label}
        </div>
        <div
          style={{
            width: '16%',
            aspectRatio: '1',
            marginTop: '10%',
            backgroundColor: COLORS.signal,
            transform: `scale(${pulse})`,
          }}
        />
      </div>
      <Audio src={audioSrc} volume={0.08} />
    </AbsoluteFill>
  );
};
