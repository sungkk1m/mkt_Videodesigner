// steam-review Design Ref: §8 — the one moving element on the page. A thin
// positioned wrapper around the shared `SceneVideo`: the slot is a rect, not
// the full frame, so the frame-level layer is clipped into it.
import type {Rect} from '../../domain/steamreview/layout';
import {STEAM_REVIEW_COLORS} from '../../domain/steamreview/layout';
import type {SteamReviewVideoRenderProps} from '../../domain/editor/types';
import {SceneVideo} from '../shared/SceneVideo';

export const GameplaySlot = ({
  rect,
  video,
  volume,
}: {
  rect: Rect;
  video: SteamReviewVideoRenderProps;
  /** FR-13 — the source's own audio at the project's original-volume mix. */
  volume: number;
}) => (
  <div
    data-testid="steam-gameplay-slot"
    style={{
      backgroundColor: '#000000',
      height: rect.h,
      left: rect.x,
      overflow: 'hidden',
      position: 'absolute',
      top: rect.y,
      width: rect.w,
    }}
  >
    {video.url ? (
      <SceneVideo
        scale={video.scale}
        src={video.url}
        trimAfterFrames={video.trimAfterFrames}
        trimBeforeFrames={video.trimBeforeFrames}
        volume={volume}
        x={video.x}
        y={video.y}
      />
    ) : (
      <div
        style={{
          alignItems: 'center',
          color: STEAM_REVIEW_COLORS.mutedText,
          display: 'flex',
          fontSize: 32,
          height: '100%',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        게임플레이 영상을 올려주세요
      </div>
    )}
  </div>
);
