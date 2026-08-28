// steam-review Design Ref: §7.1 (lg) / §7.2 (sm) — one review card: avatar,
// 👍 recommendation box, the "hours on record" line, the comment body, and the
// gray award star. The avatars are bundled with the composition — the domain
// hands over a key, and this file owns the key → import-URL map (§2.1).
import {Img} from 'remotion';

import type {SteamReviewReviewRenderProps} from '../../domain/editor/types';
import {
  STEAM_REVIEW_CARD_SPECS,
  STEAM_REVIEW_COLORS,
} from '../../domain/steamreview/layout';
import type {SteamReviewAvatarKey} from '../../domain/steamreview/reviews';
import avatar1 from './assets/avatar-1.png';
import avatar2 from './assets/avatar-2.png';
import avatar3 from './assets/avatar-3.png';
import avatar4 from './assets/avatar-4.png';

const AVATARS: Record<SteamReviewAvatarKey, string> = {
  'avatar-1': avatar1,
  'avatar-2': avatar2,
  'avatar-3': avatar3,
  'avatar-4': avatar4,
};

const ThumbsUpIcon = ({size}: {size: number}) => (
  <svg
    fill={STEAM_REVIEW_COLORS.thumbBlue}
    height={size}
    viewBox="0 0 24 24"
    width={size}
  >
    <path d="M2 10.5h3.6V21H2zM21.7 11.9c.2-.4.3-.8.3-1.2 0-1.2-1-2.2-2.2-2.2h-5.1l.8-3.9c.1-.7-.1-1.4-.6-1.9-.8-.8-2.2-.8-3 .1L7.2 8.5c-.4.4-.6 1-.6 1.5V19c0 1.1.9 2 2 2h8.4c.9 0 1.7-.6 2-1.4l2.5-6.6c.1-.4.1-.8.2-1.1z" />
  </svg>
);

const StarIcon = ({size}: {size: number}) => (
  <svg
    fill="none"
    height={size}
    stroke={STEAM_REVIEW_COLORS.starGray}
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={size}
  >
    <path d="m12 3 2.7 5.8 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3.1 1.2-6.2L3 9.6l6.3-.8z" />
  </svg>
);

export const ReviewCard = ({
  review,
  size,
  width,
  height,
}: {
  review: SteamReviewReviewRenderProps;
  size: 'lg' | 'sm';
  width: number;
  height: number;
}) => {
  const spec = STEAM_REVIEW_CARD_SPECS[size];
  const textX = spec.thumbBoxX + spec.thumbBoxSize + 16;

  return (
    <div
      data-testid="steam-review-card"
      style={{
        backgroundColor: STEAM_REVIEW_COLORS.panel,
        borderRadius: 4,
        height,
        overflow: 'hidden',
        position: 'relative',
        width,
      }}
    >
      <Img
        src={AVATARS[review.avatarKey]}
        style={{
          height: spec.avatarSize,
          left: spec.avatarX,
          position: 'absolute',
          top: spec.avatarY,
          width: spec.avatarSize,
        }}
      />

      <div
        style={{
          alignItems: 'center',
          backgroundColor: STEAM_REVIEW_COLORS.thumbBox,
          borderRadius: 4,
          display: 'flex',
          height: spec.thumbBoxSize,
          justifyContent: 'center',
          left: spec.thumbBoxX,
          position: 'absolute',
          top: spec.thumbBoxY,
          width: spec.thumbBoxSize,
        }}
      >
        <ThumbsUpIcon size={spec.thumbBoxSize * 0.55} />
      </div>

      <div
        style={{
          left: textX,
          position: 'absolute',
          top: spec.thumbBoxY,
        }}
      >
        <div
          style={{
            color: STEAM_REVIEW_COLORS.title,
            fontSize: spec.recommendedFontSize,
            fontWeight: 600,
            lineHeight: 1.3,
          }}
        >
          {review.recommendedLabel}
        </div>
        <div
          style={{
            color: STEAM_REVIEW_COLORS.mutedText,
            fontSize: spec.hoursFontSize,
            lineHeight: 1.5,
          }}
        >
          {review.hoursLabel}
        </div>
      </div>

      <div
        style={{
          color: STEAM_REVIEW_COLORS.bodyText,
          fontSize: spec.bodyFontSize,
          left: spec.avatarX,
          lineHeight: 1.35,
          position: 'absolute',
          right: spec.starRight,
          top: spec.bodyY,
          whiteSpace: 'pre-line',
          ...(spec.bodyMaxLines > 0
            ? {
                WebkitBoxOrient: 'vertical' as const,
                WebkitLineClamp: spec.bodyMaxLines,
                display: '-webkit-box',
                overflow: 'hidden',
              }
            : {}),
        }}
      >
        {review.body}
      </div>

      <div
        style={{
          position: 'absolute',
          right: spec.starRight,
          top: spec.starY,
        }}
      >
        <StarIcon size={spec.starSize} />
      </div>
    </div>
  );
};
