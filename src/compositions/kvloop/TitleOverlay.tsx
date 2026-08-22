// key-visual-looping Design Ref: §5.3 — the fixed title or logo, held over the
// whole loop.
//
// Plan L5 / FR-L13 / SC5: returning null when there is no title is the normal
// path, not a degraded one. No warning, no placeholder.
import {AbsoluteFill, Img} from 'remotion';

import type {KvOverlayRenderProps} from '../../domain/editor/types';

export const TitleOverlay = ({title}: {title: KvOverlayRenderProps}) => {
  if (title.url === null) {
    return null;
  }

  return (
    <AbsoluteFill>
      <Img
        data-testid="kv-title-overlay"
        src={title.url}
        style={{
          height: '100%',
          // A title is artwork with its own margins, so it defaults to
          // `contain`: cropping a logo is never the intent.
          objectFit: title.fit,
          transform: `translate(${title.x}%, ${title.y}%) scale(${title.scale})`,
          width: '100%',
        }}
      />
    </AbsoluteFill>
  );
};
