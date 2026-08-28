// steam-review Design Ref: §7 — the three measured coordinate sets, one per
// output ratio. Pure data: the composition draws these rects and the tests pin
// them, so the two can never disagree about where the video slot sits.
//
// Values are reference measurements (±a few px); module-5 fine-tunes them by
// overlaying reference frames (✱Do).
import {RATIO_DIMENSIONS} from '../editor/constants';
import type {AspectRatio} from '../editor/types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Design §4.2, re-sampled off the reference video frames in module-5 (✱Do):
 * multi-point averages per region from the KR 16:9/9:16 frames.
 */
export const STEAM_REVIEW_COLORS = {
  /** Page background gradient, top → bottom. */
  pageTop: '#314459',
  pageBottom: '#18222E',
  /** Review block background (also the empty thumbnail placeholder). */
  panel: '#161F2C',
  /** The darker recommendation bar inside a review block. */
  headerBar: '#111922',
  /** The thin line above each review block. */
  divider: '#486C85',
  chipBg: '#1A2834',
  chipBorder: '#256685',
  chipText: '#66C0F4',
  /** 👍 icon fill — solid in the reference. */
  thumbBlue: '#0FC0F8',
  thumbBox: '#18415A',
  title: '#FFFFFF',
  bodyText: '#DCE5EB',
  mutedText: '#7D9DB7',
  starGray: '#4A5A68',
} as const;

/**
 * Design §4.3 — Motiva Sans is Valve's proprietary face and is not embedded.
 * The stack covers all four CJK locales on the desktop Chrome render target.
 */
export const STEAM_REVIEW_FONT_STACK =
  "'Segoe UI', 'Malgun Gothic', 'Yu Gothic UI', 'Microsoft JhengHei UI', 'Noto Sans', sans-serif";

export interface SteamReviewTitleSpec {
  x: number;
  y: number;
  h: number;
  fontSize: number;
}

export interface SteamReviewTagRowSpec {
  x: number;
  y: number;
  chipHeight: number;
  gap: number;
  paddingX: number;
  radius: number;
  fontSize: number;
}

export interface SteamReviewThumbStripSpec {
  x: number;
  y: number;
  count: number;
  thumbWidth: number;
  thumbHeight: number;
  gap: number;
  /** The thumbnail drawn with the white "selected" border. */
  selectedIndex: number;
  /** Thumbnails carrying the ▶ overlay. */
  playIndexes: readonly number[];
  /** Diameter of the translucent ▶ circle. */
  playSize: number;
}

/** 16:9 only — decorative arrows and scrollbar under the strip (Design §13). */
export interface SteamReviewPaginationSpec {
  prev: Rect;
  next: Rect;
  track: Rect;
  thumb: Rect;
}

export interface SteamReviewSidebarSpec {
  x: number;
  width: number;
  /** Key art slot — 2.0:1 here vs 3.48:1 on the 9:16 banner (D-4). */
  keyArt: Rect;
  title: {y: number; fontSize: number};
  description: {y: number; h: number; fontSize: number; lineHeight: number};
}

export interface SteamReviewReviewAreaSpec {
  /** D-3 / Plan Q9 — only 1:1 scrolls; 16:9 and 9:16 are static. */
  variant: 'static' | 'scrolling';
  x: number;
  y: number;
  width: number;
  cardHeight: number;
  gap: number;
  cardSize: 'lg' | 'md' | 'sm';
  /** D-7 — indexes into `STEAM_REVIEWS`, in display order. */
  indexes: readonly number[];
  /** Scrolling only: the clipped viewport height. */
  viewportHeight?: number;
}

/**
 * Per-card internals, by card size — measured off the reference frames
 * (module-5 ✱Do). A review block is a `panel` rectangle with a `divider`
 * hairline at its top; inside it the avatar sits left of a darker `headerBar`
 * (👍 box, recommendation, hours, star), and the body text runs below the bar,
 * left-aligned with it.
 */
export interface SteamReviewCardSpec {
  avatarSize: number;
  /** Avatar left inset from the block's left edge. */
  avatarX: number;
  /** Avatar/bar top offset from the block's top. */
  avatarY: number;
  /** Header bar left offset from the block's left edge; it runs to the right edge. */
  barX: number;
  barHeight: number;
  thumbBoxSize: number;
  recommendedFontSize: number;
  hoursFontSize: number;
  bodyFontSize: number;
  /** Gap between the bar's bottom and the body's top. */
  bodyGap: number;
  /** 0 = unlimited; the sm card clips at two lines with an ellipsis. */
  bodyMaxLines: number;
  starSize: number;
  /** Star inset from the block's right edge. */
  starRight: number;
  /** 2px hairline above the block (§7 — present on every ratio). */
  dividerPx: number;
}

export const STEAM_REVIEW_CARD_SPECS: Record<
  'lg' | 'md' | 'sm',
  SteamReviewCardSpec
> = {
    lg: {
      avatarSize: 115,
      avatarX: 15,
      avatarY: 22,
      barX: 197,
      barHeight: 113,
      thumbBoxSize: 96,
      recommendedFontSize: 38,
      hoursFontSize: 24,
      bodyFontSize: 34,
      bodyGap: 16,
      bodyMaxLines: 0,
      starSize: 36,
      starRight: 36,
      dividerPx: 2,
    },
    // The 1:1 blocks are shorter (pitch 215, D-3), so the lg internals do not
    // fit — the reference's square cards run a slightly smaller bar.
    md: {
      avatarSize: 100,
      avatarX: 15,
      avatarY: 12,
      barX: 175,
      barHeight: 100,
      thumbBoxSize: 84,
      recommendedFontSize: 34,
      hoursFontSize: 22,
      bodyFontSize: 32,
      bodyGap: 14,
      bodyMaxLines: 0,
      starSize: 32,
      starRight: 36,
      dividerPx: 2,
    },
    sm: {
      avatarSize: 72,
      avatarX: 4,
      avatarY: 5,
      barX: 105,
      barHeight: 68,
      thumbBoxSize: 60,
      recommendedFontSize: 26,
      hoursFontSize: 18,
      bodyFontSize: 26,
      bodyGap: 18,
      bodyMaxLines: 2,
      starSize: 24,
      starRight: 60,
      dividerPx: 2,
    },
  };

export interface SteamReviewLayout {
  canvas: {width: number; height: number};
  /** 9:16 only — the full-width key art banner above the title. */
  keyArtBanner?: Rect;
  title: SteamReviewTitleSpec;
  tagRow: SteamReviewTagRowSpec;
  video: Rect;
  /** Absent on 1:1, which shows no thumbnail strip (Plan Q10). */
  thumbStrip?: SteamReviewThumbStripSpec;
  pagination?: SteamReviewPaginationSpec;
  /** 16:9 only — the right-hand store column. */
  sidebar?: SteamReviewSidebarSpec;
  reviews: SteamReviewReviewAreaSpec;
}

const LAYOUTS: Record<AspectRatio, SteamReviewLayout> = {
  // Design §7.1 — 1080×1920.
  '9:16': {
    canvas: {...RATIO_DIMENSIONS['9:16']},
    keyArtBanner: {x: 0, y: 0, w: 1080, h: 310},
    title: {x: 32, y: 318, h: 70, fontSize: 58},
    // Chips tightened vs the reference measurement (font 26, pad 18): the
    // pinned Korean fourth tag (D-6) is longer than the reference's 「지금
    // 플레이」, and at the measured metrics the row overflows a 1080 canvas.
    tagRow: {
      x: 32,
      y: 425,
      chipHeight: 45,
      gap: 12,
      paddingX: 14,
      radius: 4,
      fontSize: 24,
    },
    video: {x: 32, y: 499, w: 1016, h: 571},
    thumbStrip: {
      x: 32,
      y: 1075,
      count: 3,
      thumbWidth: 331,
      thumbHeight: 200,
      gap: 11,
      selectedIndex: 0,
      playIndexes: [0, 1],
      playSize: 96,
    },
    reviews: {
      // Measured block pitch 228 (divider-to-divider on the reference frame);
      // the third block runs off the bottom edge, as the reference does.
      variant: 'static',
      x: 50,
      y: 1315,
      width: 980,
      cardHeight: 205,
      gap: 23,
      cardSize: 'lg',
      indexes: [1, 2, 3],
    },
  },
  // Design §7.2 — 1920×1080.
  '16:9': {
    canvas: {...RATIO_DIMENSIONS['16:9']},
    title: {x: 100, y: 55, h: 60, fontSize: 56},
    tagRow: {
      x: 100,
      y: 140,
      chipHeight: 45,
      gap: 14,
      paddingX: 18,
      radius: 4,
      fontSize: 26,
    },
    video: {x: 101, y: 209, w: 1088, h: 612},
    thumbStrip: {
      x: 100,
      y: 835,
      count: 4,
      thumbWidth: 258,
      thumbHeight: 150,
      gap: 18,
      selectedIndex: 0,
      playIndexes: [0, 1],
      playSize: 72,
    },
    pagination: {
      prev: {x: 100, y: 1000, w: 75, h: 50},
      next: {x: 1115, y: 1000, w: 75, h: 50},
      track: {x: 180, y: 1000, w: 925, h: 50},
      thumb: {x: 180, y: 1000, w: 140, h: 50},
    },
    sidebar: {
      x: 1232,
      width: 658,
      keyArt: {x: 1232, y: 207, w: 658, h: 328},
      title: {y: 552, fontSize: 44},
      description: {y: 630, h: 95, fontSize: 26, lineHeight: 36},
    },
    reviews: {
      // Measured block pitch ~202; the reference clips reviews 2-4 at the
      // bottom edge, so the full subset renders and the canvas crops it.
      variant: 'static',
      x: 1232,
      y: 740,
      width: 658,
      cardHeight: 180,
      gap: 22,
      cardSize: 'sm',
      indexes: [0, 1, 2, 3],
    },
  },
  // Design §7.3 — 1080×1080.
  '1:1': {
    canvas: {...RATIO_DIMENSIONS['1:1']},
    title: {x: 32, y: 40, h: 65, fontSize: 58},
    // Tightened like the 9:16 row — same 1080-wide canvas, same pinned tag.
    tagRow: {
      x: 32,
      y: 140,
      chipHeight: 45,
      gap: 12,
      paddingX: 14,
      radius: 4,
      fontSize: 24,
    },
    video: {x: 32, y: 206, w: 1016, h: 571},
    reviews: {
      variant: 'scrolling',
      x: 32,
      y: 788,
      width: 1016,
      cardHeight: 180,
      gap: 35,
      cardSize: 'md',
      indexes: [1, 2, 3],
      viewportHeight: 292,
    },
  },
};

export const steamReviewLayout = (ratio: AspectRatio): SteamReviewLayout =>
  LAYOUTS[ratio];

/**
 * D-3 — the 1:1 scroll cycle: one full pass of the review list, card pitch
 * (height + gap) times the card count. 3 × (180 + 35) = 645px on the reference.
 */
export const steamReviewScrollCycleHeight = (
  reviews: SteamReviewReviewAreaSpec,
): number => (reviews.cardHeight + reviews.gap) * reviews.indexes.length;
