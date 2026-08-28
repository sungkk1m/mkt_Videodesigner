// steam-review Design Ref: §7.2 — the 16:9 right-hand store column: key art,
// title, and the multiline description (Plan Q8 — the one ratio that shows it).
// The column's reviews are drawn by `ReviewList` at the composition level,
// since the layout carries their absolute coordinates.
import type {
  SteamReviewKeyArtRenderProps,
} from '../../domain/editor/types';
import type {SteamReviewSidebarSpec} from '../../domain/steamreview/layout';
import {STEAM_REVIEW_COLORS} from '../../domain/steamreview/layout';
import {KeyArtBanner} from './KeyArtBanner';

export const Sidebar = ({
  sidebar,
  keyArt,
  titleText,
  description,
}: {
  sidebar: SteamReviewSidebarSpec;
  keyArt: SteamReviewKeyArtRenderProps;
  titleText: string;
  description: string;
}) => (
  <div data-testid="steam-sidebar">
    <KeyArtBanner keyArt={keyArt} rect={sidebar.keyArt} />

    <div
      style={{
        color: STEAM_REVIEW_COLORS.title,
        fontSize: sidebar.title.fontSize,
        fontWeight: 700,
        left: sidebar.x,
        position: 'absolute',
        top: sidebar.title.y,
        whiteSpace: 'nowrap',
        width: sidebar.width,
      }}
    >
      {titleText}
    </div>

    <div
      data-testid="steam-description"
      style={{
        color: STEAM_REVIEW_COLORS.bodyText,
        fontSize: sidebar.description.fontSize,
        left: sidebar.x,
        lineHeight: `${sidebar.description.lineHeight}px`,
        position: 'absolute',
        top: sidebar.description.y,
        whiteSpace: 'pre-line',
        width: sidebar.width,
      }}
    >
      {description}
    </div>
  </div>
);
