// steam-review Design Ref: §8 / D-4 — the landscape key art, drawn into
// whichever placement the layout gives it: the 9:16 top banner (3.48:1) or the
// 16:9 sidebar slot (2.0:1). Cover-cropped, with the per-ratio transform the
// inspector edits.
import {Img} from 'remotion';

import type {SteamReviewKeyArtRenderProps} from '../../domain/editor/types';
import type {Rect} from '../../domain/steamreview/layout';
import {STEAM_REVIEW_COLORS} from '../../domain/steamreview/layout';

export const KeyArtBanner = ({
  rect,
  keyArt,
}: {
  rect: Rect;
  keyArt: SteamReviewKeyArtRenderProps;
}) => (
  <div
    data-testid="steam-key-art"
    style={{
      backgroundColor: STEAM_REVIEW_COLORS.panel,
      height: rect.h,
      left: rect.x,
      overflow: 'hidden',
      position: 'absolute',
      top: rect.y,
      width: rect.w,
    }}
  >
    {keyArt.url ? (
      <Img
        src={keyArt.url}
        style={{
          height: '100%',
          objectFit: 'cover',
          transform: `translate(${keyArt.x}%, ${keyArt.y}%) scale(${keyArt.scale})`,
          width: '100%',
        }}
      />
    ) : null}
  </div>
);
