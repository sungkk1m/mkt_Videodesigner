// Design Ref: §3.2 SubtitleStyle and §5.5 Scene Inspector subtitle controls.
// Scene-level subtitles only: no word timing or karaoke highlighting in the MVP.
import {AbsoluteFill} from 'remotion';

import type {SubtitleRenderProps} from '../../domain/editor/types';

const JUSTIFY = {
  top: 'flex-start',
  center: 'center',
  bottom: 'flex-end',
} as const;

const TEXT_ALIGN = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
} as const;

const hexToRgba = (hex: string, alpha: number) => {
  const value = Number.parseInt(hex.slice(1), 16);

  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

/** Splits the line so the emphasised phrase can take the emphasis colour. */
const segmentsOf = (text: string, emphasizedText: string) => {
  if (!emphasizedText) {
    return [{text, emphasized: false}];
  }

  const index = text.indexOf(emphasizedText);

  if (index < 0) {
    return [{text, emphasized: false}];
  }

  return [
    {text: text.slice(0, index), emphasized: false},
    {text: emphasizedText, emphasized: true},
    {text: text.slice(index + emphasizedText.length), emphasized: false},
  ].filter((segment) => segment.text.length > 0);
};

export const SubtitleOverlay = ({
  subtitle,
}: {
  subtitle: SubtitleRenderProps;
}) => {
  const {style, text, emphasizedText} = subtitle;

  return (
    <AbsoluteFill
      style={{
        alignItems: TEXT_ALIGN[style.align],
        justifyContent: JUSTIFY[style.position],
        padding: '8%',
      }}
    >
      <span
        style={{
          maxWidth: '100%',
          padding: style.showBackground ? '0.3em 0.6em' : 0,
          backgroundColor: style.showBackground
            ? hexToRgba(style.backgroundColor, style.backgroundOpacity)
            : 'transparent',
          borderRadius: 8,
          color: style.textColor,
          fontFamily: 'system-ui, sans-serif',
          fontSize: style.fontSize,
          fontWeight: 700,
          lineHeight: 1.3,
          textAlign: style.align,
          whiteSpace: 'pre-wrap',
        }}
      >
        {segmentsOf(text, emphasizedText).map((segment, index) => (
          <span
            key={`${segment.text}-${index}`}
            style={
              segment.emphasized ? {color: style.emphasisColor} : undefined
            }
          >
            {segment.text}
          </span>
        ))}
      </span>
    </AbsoluteFill>
  );
};
