// steam-review Design Ref: §7 / D-3 — the review area. 16:9 and 9:16 draw a
// fixed subset; 1:1 clips a viewport over the list drawn twice and scrolls it
// upward at the measured speed, so the loop is seamless. The offset is a pure
// function of wall-clock time (`reviewScrollOffsetPx`), so the Player preview
// and the render agree at any fps.
import {useCurrentFrame, useVideoConfig} from 'remotion';

import type {SteamReviewReviewRenderProps} from '../../domain/editor/types';
import type {SteamReviewReviewAreaSpec} from '../../domain/steamreview/layout';
import {steamReviewScrollCycleHeight} from '../../domain/steamreview/layout';
import {reviewScrollOffsetPx} from '../../domain/steamreview/scroll';
import {ReviewCard} from './ReviewCard';

const StaticList = ({
  area,
  reviews,
}: {
  area: SteamReviewReviewAreaSpec;
  reviews: SteamReviewReviewRenderProps[];
}) => (
  <div data-testid="steam-review-list">
    {area.indexes.map((reviewIndex, position) => {
      const review = reviews[reviewIndex];

      return review ? (
        <div
          key={position}
          style={{
            left: area.x,
            position: 'absolute',
            top: area.y + position * (area.cardHeight + area.gap),
          }}
        >
          <ReviewCard
            height={area.cardHeight}
            review={review}
            size={area.cardSize}
            width={area.width}
          />
        </div>
      ) : null;
    })}
  </div>
);

const ScrollingList = ({
  area,
  reviews,
}: {
  area: SteamReviewReviewAreaSpec;
  reviews: SteamReviewReviewRenderProps[];
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cycleHeight = steamReviewScrollCycleHeight(area);
  const offset = reviewScrollOffsetPx((frame / fps) * 1000, cycleHeight);
  const pitch = area.cardHeight + area.gap;
  // Two copies stitched end to end make the wrap invisible (D-3).
  const doubled = [...area.indexes, ...area.indexes];

  return (
    <div
      data-testid="steam-review-scroller"
      style={{
        height: area.viewportHeight ?? cycleHeight,
        left: area.x,
        overflow: 'hidden',
        position: 'absolute',
        top: area.y,
        width: area.width,
      }}
    >
      <div style={{transform: `translateY(${-offset}px)`}}>
        {doubled.map((reviewIndex, position) => {
          const review = reviews[reviewIndex];

          // Each block carries its own top divider, so the tiled loop keeps
          // the same card separation the static lists show (§7.3).
          return review ? (
            <div
              key={position}
              style={{
                left: 0,
                position: 'absolute',
                top: position * pitch,
              }}
            >
              <ReviewCard
                height={area.cardHeight}
                review={review}
                size={area.cardSize}
                width={area.width}
              />
            </div>
          ) : null;
        })}
      </div>
    </div>
  );
};

export const ReviewList = ({
  area,
  reviews,
}: {
  area: SteamReviewReviewAreaSpec;
  reviews: SteamReviewReviewRenderProps[];
}) =>
  area.variant === 'scrolling' ? (
    <ScrollingList area={area} reviews={reviews} />
  ) : (
    <StaticList area={area} reviews={reviews} />
  );
