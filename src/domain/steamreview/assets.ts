// steam-review Design Ref: §2.2 / §8 — which gameplay source a locale's render
// plays, and what a restored project must relink. The kv-loop assets module is
// the pattern, with one deliberate difference: the fallback is the *shared*
// source, not the `en` set (Plan Q4 — locale sources are exceptions, like the
// KR loot-box-subtitled cut, and everything else plays the common footage).
import type {MediaReference} from '../media/reference';
import type {Locale, SteamReviewSettings} from '../editor/types';

/** The locale's own replacement when it has one, the shared source otherwise. */
export const resolveSteamReviewSource = (
  settings: SteamReviewSettings,
  locale: Locale,
): MediaReference | null => settings.localeSources[locale] ?? settings.source;

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
