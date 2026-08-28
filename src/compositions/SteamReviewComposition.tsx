// steam-review Design Ref: §8 — the store page shell. Everything but the
// gameplay slot (and the 1:1 review scroll) is static DOM; the layout arrives
// baked into the props, so this file only places what the prop builder
// resolved. The Player preview and the browser render consume this same
// component and the same snapshot.
import {AbsoluteFill} from 'remotion';

import type {SteamReviewProps} from '../domain/editor/types';
import {
  STEAM_REVIEW_COLORS,
  STEAM_REVIEW_FONT_STACK,
} from '../domain/steamreview/layout';
import {AudioLayer} from './shared/AudioLayer';
import {GameplaySlot} from './steamreview/GameplaySlot';
import {KeyArtBanner} from './steamreview/KeyArtBanner';
import {ReviewList} from './steamreview/ReviewList';
import {Sidebar} from './steamreview/Sidebar';
import {StoreHeader} from './steamreview/StoreHeader';
import {ThumbStrip} from './steamreview/ThumbStrip';

export const SteamReviewComposition = ({
  audio,
  description,
  keyArt,
  layout,
  reviews,
  tags,
  thumbnails,
  title,
  video,
}: SteamReviewProps) => {
  // The reference's 16:9 review column starts below the description, which is
  // 3 lines in KR but 5 in the other locales (module-5 frame comparison) — a
  // fixed start would bury a longer description under the first review block.
  const descriptionBottom = layout.sidebar
    ? layout.sidebar.description.y +
      (description ? description.split('\n').length : 0) *
        layout.sidebar.description.lineHeight
    : 0;
  const reviewArea =
    layout.sidebar && descriptionBottom + 16 > layout.reviews.y
      ? {...layout.reviews, y: descriptionBottom + 16}
      : layout.reviews;

  return (
  <AbsoluteFill
    style={{
      background: `linear-gradient(180deg, ${STEAM_REVIEW_COLORS.pageTop} 0%, ${STEAM_REVIEW_COLORS.pageBottom} 100%)`,
      fontFamily: STEAM_REVIEW_FONT_STACK,
    }}
  >
    {layout.keyArtBanner ? (
      <KeyArtBanner keyArt={keyArt} rect={layout.keyArtBanner} />
    ) : null}

    <StoreHeader
      tagRow={layout.tagRow}
      tags={tags}
      title={layout.title}
      titleText={title}
    />

    <GameplaySlot
      rect={layout.video}
      video={video}
      volume={audio.originalVolume}
    />

    {layout.thumbStrip ? (
      <ThumbStrip
        pagination={layout.pagination}
        strip={layout.thumbStrip}
        thumbnails={thumbnails}
      />
    ) : null}

    {layout.sidebar ? (
      <Sidebar
        description={description}
        keyArt={keyArt}
        sidebar={layout.sidebar}
        titleText={title}
      />
    ) : null}

    <ReviewList area={reviewArea} reviews={reviews} />

    {/* Plan FR-13 — BGM only; the narration list is always empty here. */}
    <AudioLayer audio={audio} />
  </AbsoluteFill>
  );
};
