// steam-review Design Ref: §2.2 / §8 — which gameplay source a locale's render
// plays, and what a restored project must relink. The kv-loop assets module is
// the pattern, with one deliberate difference: the fallback is the *shared*
// source, not the `en` set (Plan Q4 — locale sources are exceptions, like the
// KR loot-box-subtitled cut, and everything else plays the common footage).
import type {MediaReference} from '../media/reference';
import type {
  AspectRatio,
  EditorProject,
  Locale,
  SteamReviewSettings,
} from '../editor/types';

/** The locale's own replacement when it has one, the shared source otherwise. */
export const resolveSteamReviewSource = (
  settings: SteamReviewSettings,
  locale: Locale,
): MediaReference | null => settings.localeSources[locale] ?? settings.source;

/** The two ratios whose layouts draw the key art and the thumbnail strip. */
const RATIOS_NEEDING_KEY_ART: readonly AspectRatio[] = ['16:9', '9:16'];
const RATIOS_NEEDING_THUMBNAILS: readonly AspectRatio[] = ['16:9', '9:16'];

export interface SteamReviewMissingAssets {
  /** Render-target locales with no resolvable gameplay source (§3.6). */
  locales: Locale[];
  /** Selected ratios that draw the key art while none is uploaded (Plan Q11). */
  keyArtRatios: AspectRatio[];
  /** Selected ratios that draw thumbnails while slots are empty (Plan Q10). */
  thumbnailRatios: AspectRatio[];
  /** How many of the four thumbnail slots are still empty. */
  missingThumbnails: number;
}

const NO_MISSING_ASSETS: SteamReviewMissingAssets = {
  locales: [],
  keyArtRatios: [],
  thumbnailRatios: [],
  missingThumbnails: 0,
};

/**
 * Design §3.6 — the render-blocking material checks, evaluated against the
 * project's own render targets. Sits where `day1MissingPanels` and
 * `kvLoopMissingImages` sit and is read the same way: a non-empty answer
 * blocks the render/Batch with the reason named. A 1:1-only render needs no
 * key art and no thumbnails, so it passes with just the gameplay sources.
 */
export const steamReviewMissingAssets = (
  project: EditorProject,
): SteamReviewMissingAssets => {
  const settings = project.templateSettings;

  if (settings.template !== 'steam-review') {
    return NO_MISSING_ASSETS;
  }

  const ratios = project.render.selectedRatios;

  return {
    locales: project.render.selectedLocales.filter(
      (locale) => resolveSteamReviewSource(settings, locale) === null,
    ),
    keyArtRatios:
      settings.keyArt.image === null
        ? ratios.filter((ratio) => RATIOS_NEEDING_KEY_ART.includes(ratio))
        : [],
    thumbnailRatios: settings.thumbnails.some((reference) => reference === null)
      ? ratios.filter((ratio) => RATIOS_NEEDING_THUMBNAILS.includes(ratio))
      : [],
    missingThumbnails: settings.thumbnails.filter(
      (reference) => reference === null,
    ).length,
  };
};

/**
 * One stored reference the session cannot play yet, and where it lives, so the
 * restore path can write a recovered status back to the right slot.
 */
export type SteamReviewRestoreTarget =
  | {slot: 'source'; reference: MediaReference}
  | {slot: 'locale-source'; locale: Locale; reference: MediaReference}
  | {slot: 'key-art'; reference: MediaReference}
  | {slot: 'thumbnail'; index: number; reference: MediaReference};

/**
 * Everything a reload has to bring back from file handles — the same contract
 * as `kvLoopRestoreTargets`: references come out of IndexedDB, session object
 * URLs never do.
 */
export const steamReviewRestoreTargets = (
  settings: SteamReviewSettings,
  isResolved: (mediaId: string) => boolean,
): SteamReviewRestoreTarget[] => [
  ...(settings.source && !isResolved(settings.source.id)
    ? [{slot: 'source', reference: settings.source} as const]
    : []),
  ...Object.entries(settings.localeSources).flatMap(([locale, reference]) =>
    reference && !isResolved(reference.id)
      ? [
          {
            slot: 'locale-source',
            locale: locale as Locale,
            reference,
          } as const,
        ]
      : [],
  ),
  ...(settings.keyArt.image && !isResolved(settings.keyArt.image.id)
    ? [{slot: 'key-art', reference: settings.keyArt.image} as const]
    : []),
  ...settings.thumbnails.flatMap((reference, index) =>
    reference && !isResolved(reference.id)
      ? [{slot: 'thumbnail', index, reference} as const]
      : [],
  ),
];
