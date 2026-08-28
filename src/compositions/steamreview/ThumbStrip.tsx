// steam-review Design Ref: §7.1/§7.2 — the thumbnail row under the video: the
// first slot carries the white "selected" border, the first two a ▶ overlay,
// and 16:9 adds the decorative arrow/scrollbar row (§13: decoration only — the
// reference's are static too).
import {Img} from 'remotion';

import type {
  Rect,
  SteamReviewPaginationSpec,
  SteamReviewThumbStripSpec,
} from '../../domain/steamreview/layout';
import {STEAM_REVIEW_COLORS} from '../../domain/steamreview/layout';

/** The scrollbar thumb — `chipBg` lightened, per the §7.2 note. */
const SCROLL_THUMB_COLOR = '#1B5E8A';

const SELECTED_BORDER_PX = 4;

const PlayOverlay = ({size}: {size: number}) => (
  <div
    style={{
      alignItems: 'center',
      display: 'flex',
      height: '100%',
      justifyContent: 'center',
      left: 0,
      position: 'absolute',
      top: 0,
      width: '100%',
    }}
  >
    <div
      style={{
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        borderRadius: '50%',
        display: 'flex',
        height: size,
        justifyContent: 'center',
        width: size,
      }}
    >
      <svg
        fill={STEAM_REVIEW_COLORS.title}
        height={size * 0.42}
        viewBox="0 0 24 24"
        width={size * 0.42}
      >
        <path d="M7 4.5 19.5 12 7 19.5Z" />
      </svg>
    </div>
  </div>
);

const Chip = ({rect, glyph}: {rect: Rect; glyph: string}) => (
  <div
    style={{
      alignItems: 'center',
      backgroundColor: STEAM_REVIEW_COLORS.panel,
      borderRadius: 4,
      color: STEAM_REVIEW_COLORS.mutedText,
      display: 'flex',
      fontSize: 28,
      height: rect.h,
      justifyContent: 'center',
      left: rect.x,
      position: 'absolute',
      top: rect.y,
      width: rect.w,
    }}
  >
    {glyph}
  </div>
);

export const ThumbStrip = ({
  strip,
  pagination,
  thumbnails,
}: {
  strip: SteamReviewThumbStripSpec;
  pagination?: SteamReviewPaginationSpec;
  /** Resolved URLs for the four stored slots; the strip shows its own count. */
  thumbnails: (string | null)[];
}) => (
  <>
    <div
      data-testid="steam-thumb-strip"
      style={{
        display: 'flex',
        gap: strip.gap,
        left: strip.x,
        position: 'absolute',
        top: strip.y,
      }}
    >
      {Array.from({length: strip.count}, (_, index) => {
        const url = thumbnails[index] ?? null;
        const selected = index === strip.selectedIndex;

        return (
          <div
            key={index}
            style={{
              backgroundColor: STEAM_REVIEW_COLORS.panel,
              boxSizing: 'border-box',
              height: strip.thumbHeight,
              overflow: 'hidden',
              position: 'relative',
              width: strip.thumbWidth,
              ...(selected
                ? {
                    border: `${SELECTED_BORDER_PX}px solid ${STEAM_REVIEW_COLORS.title}`,
                  }
                : {}),
            }}
          >
            {url ? (
              <Img
                src={url}
                style={{height: '100%', objectFit: 'cover', width: '100%'}}
              />
            ) : null}
            {strip.playIndexes.includes(index) ? (
              <PlayOverlay size={strip.playSize} />
            ) : null}
          </div>
        );
      })}
    </div>

    {pagination ? (
      <div data-testid="steam-pagination">
        <Chip glyph="‹" rect={pagination.prev} />
        <div
          style={{
            backgroundColor: STEAM_REVIEW_COLORS.panel,
            height: pagination.track.h,
            left: pagination.track.x,
            position: 'absolute',
            top: pagination.track.y,
            width: pagination.track.w,
          }}
        />
        <div
          style={{
            backgroundColor: SCROLL_THUMB_COLOR,
            height: pagination.thumb.h,
            left: pagination.thumb.x,
            position: 'absolute',
            top: pagination.thumb.y,
            width: pagination.thumb.w,
          }}
        />
        <Chip glyph="›" rect={pagination.next} />
      </div>
    ) : null}
  </>
);
