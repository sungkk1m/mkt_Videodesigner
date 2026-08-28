// steam-review Design Ref: §7 — the game title and the four tag chips, at the
// layout's measured positions. The chips are the store page's category pills;
// the Korean fourth one always carries the loot-box notice (D-6).
import type {
  SteamReviewTagRowSpec,
  SteamReviewTitleSpec,
} from '../../domain/steamreview/layout';
import {STEAM_REVIEW_COLORS} from '../../domain/steamreview/layout';

export const StoreHeader = ({
  title,
  tagRow,
  titleText,
  tags,
}: {
  title: SteamReviewTitleSpec;
  tagRow: SteamReviewTagRowSpec;
  titleText: string;
  tags: readonly string[];
}) => (
  <>
    <div
      data-testid="steam-title"
      style={{
        alignItems: 'center',
        color: STEAM_REVIEW_COLORS.title,
        display: 'flex',
        fontSize: title.fontSize,
        fontWeight: 700,
        height: title.h,
        left: title.x,
        position: 'absolute',
        top: title.y,
        whiteSpace: 'nowrap',
      }}
    >
      {titleText}
    </div>

    <div
      data-testid="steam-tag-row"
      style={{
        display: 'flex',
        gap: tagRow.gap,
        left: tagRow.x,
        position: 'absolute',
        top: tagRow.y,
      }}
    >
      {tags
        .filter((tag) => tag.length > 0)
        .map((tag, index) => (
          <div
            key={index}
            style={{
              alignItems: 'center',
              backgroundColor: STEAM_REVIEW_COLORS.chipBg,
              // The reference chips are dark with a lighter blue outline
              // (module-5 measurement), not a solid mid-blue fill.
              border: `2px solid ${STEAM_REVIEW_COLORS.chipBorder}`,
              borderRadius: tagRow.radius,
              boxSizing: 'border-box',
              color: STEAM_REVIEW_COLORS.chipText,
              display: 'flex',
              fontSize: tagRow.fontSize,
              height: tagRow.chipHeight,
              padding: `0 ${tagRow.paddingX}px`,
              whiteSpace: 'nowrap',
            }}
          >
            {tag}
          </div>
        ))}
    </div>
  </>
);
