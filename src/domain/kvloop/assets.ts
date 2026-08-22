// key-visual-looping Design Ref: §4.2 — which locale's key visuals a render
// actually uses, and the two absence questions the render path asks about them.
import type {MediaReference} from '../media/reference';
import type {EditorProject, KvLoopSettings, Locale} from '../editor/types';

/**
 * Plan L4 — the inherited set is `en`, not `ko`. A locale nobody produced art
 * for ships the English cut, which is what UA practice expects, and it is why
 * filling `en` first is the recommendation.
 */
export const KV_FALLBACK_LOCALE: Locale = 'en';

export interface ResolvedKvSet {
  /** Length always equals the requested count; an unfilled slot is null. */
  references: (MediaReference | null)[];
  /** Null while a locale uses its own set; the locale it inherited otherwise. */
  inheritedFrom: Locale | null;
}

const sizedTo = (
  references: readonly (MediaReference | null)[] | undefined,
  count: number,
): (MediaReference | null)[] =>
  Array.from({length: count}, (_, index) => references?.[index] ?? null);

const hasAny = (references: readonly (MediaReference | null)[] | undefined) =>
  (references ?? []).some((reference) => reference !== null);

/**
 * Design D-05 — the fallback is per set, never per slot. A locale with two of
 * four key visuals filled renders its own two and two empty sections, rather
 * than a mix nobody chose; the asset panel says which set is in play (FR-L04).
 */
export const resolveKvSet = (
  images: KvLoopSettings['images'],
  locale: Locale,
  count: number,
): ResolvedKvSet => {
  const own = images[locale];

  if (hasAny(own) || locale === KV_FALLBACK_LOCALE) {
    return {references: sizedTo(own, count), inheritedFrom: null};
  }

  const inherited = images[KV_FALLBACK_LOCALE];

  return hasAny(inherited)
    ? {
        references: sizedTo(inherited, count),
        inheritedFrom: KV_FALLBACK_LOCALE,
      }
    : {references: sizedTo(undefined, count), inheritedFrom: null};
};

/**
 * The title overlay follows the same set-level rule, and absence is a normal
 * answer here — Plan L5 is implemented by returning null rather than by warning.
 */
export const resolveKvTitle = (
  images: KvLoopSettings['title']['images'],
  locale: Locale,
): {reference: MediaReference | null; inheritedFrom: Locale | null} => {
  const own = images[locale];

  if (own || locale === KV_FALLBACK_LOCALE) {
    return {reference: own ?? null, inheritedFrom: null};
  }

  const inherited = images[KV_FALLBACK_LOCALE];

  return inherited
    ? {reference: inherited, inheritedFrom: KV_FALLBACK_LOCALE}
    : {reference: null, inheritedFrom: null};
};

/**
 * FR-L13 — how many key visuals the selected locale is still short of the two a
 * loop needs. Sits where `day1MissingPanels` sits and is read the same way.
 *
 * Overlays are deliberately not counted: a project with no title and no
 * disclaimer must render and download (Plan L5 / SC5), and this function is
 * where that promise is kept.
 */
export const kvLoopMissingImages = (project: EditorProject): number => {
  const settings = project.templateSettings;

  if (settings.template !== 'kv-loop') {
    return 0;
  }

  const {references} = resolveKvSet(
    settings.images,
    project.selectedLocale,
    settings.slots.length,
  );
  const filled = references.filter((reference) => reference !== null).length;

  return Math.max(0, 2 - filled);
};
