// steam-review Design Ref: §3.5 — the store page's command set. Same contract
// as every other template's commands: an edit that does not apply (foreign
// template, out-of-range index, the pinned Korean tag) returns the project
// unchanged rather than throwing, and no command ever produces a document the
// schema would reject.
import type {MediaReference} from '../media/reference';
import {reconcileTrim} from '../timeline/timeline';
import {
  STEAM_REVIEW_DURATION_S,
  STEAM_REVIEW_KR_NOTICE,
  STEAM_REVIEW_MAX_DURATION_S,
  STEAM_REVIEW_MIN_DURATION_S,
  STEAM_REVIEW_THUMBNAIL_COUNT,
  type AspectRatio,
  type EditorProject,
  type Locale,
  type LocalizedCopy,
  type MediaTransform,
  type SteamReviewCopy,
  type SteamReviewSettings,
  DEFAULT_TRANSFORM,
} from './types';
import {
  buildSteamReviewSections,
  steamReviewOf,
  writeRatioOverride,
  writeTransform,
} from './project';

/**
 * The window the trim selects out of the gameplay source. It used to be the
 * fixed 20s of Plan Q2; the output now runs as long as its footage, so the
 * window is the project's own length.
 */
export const steamReviewWindowMs = (project: EditorProject): number =>
  project.durationPreset * 1000;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * The length the store page takes on when footage arrives: the shortest source
 * it has to play, whole seconds, inside the template's bounds. Falls back to
 * the starting length while nothing is uploaded.
 *
 * D-5 keeps one shared trim window across every locale, so fitting to the
 * *shortest* source is what keeps that window playable everywhere — the reason
 * a short locale replacement shrinks the output instead of being refused.
 */
export const steamReviewFittedDurationS = (
  settings: SteamReviewSettings,
): number => {
  const shortest = shortestSourceMs(settings);

  return shortest > 0
    ? clamp(
        Math.round(shortest / 1000),
        STEAM_REVIEW_MIN_DURATION_S,
        STEAM_REVIEW_MAX_DURATION_S,
      )
    : STEAM_REVIEW_DURATION_S;
};

/**
 * Rewrites the length, the one-section axis and the trim window together, so
 * the schema's "sections total the project length" invariant can never be seen
 * half-applied. Out-of-range values clamp rather than throw, matching every
 * other command here.
 */
const withSteamReviewDuration = (
  project: EditorProject,
  settings: SteamReviewSettings,
  durationS: number,
): EditorProject => {
  const bounded = clamp(
    Math.round(durationS),
    STEAM_REVIEW_MIN_DURATION_S,
    STEAM_REVIEW_MAX_DURATION_S,
  );
  const windowMs = bounded * 1000;

  return {
    ...project,
    durationPreset: bounded,
    sections: buildSteamReviewSections(bounded),
    templateSettings: {
      ...settings,
      trim: reconcileTrim(settings.trim, shortestSourceMs(settings), windowMs),
    },
  };
};

/**
 * The length control. The auto-fit is a default, not a lock: a 60s source can
 * still be cut to a 30s spot, and `setSteamReviewTrimInMs` picks which 30s.
 */
export const setSteamReviewDuration = (
  project: EditorProject,
  durationS: number,
): EditorProject => {
  const settings = steamReviewOf(project);

  return settings
    ? withSteamReviewDuration(project, settings, durationS)
    : project;
};

const mapSteamReview = (
  project: EditorProject,
  update: (settings: SteamReviewSettings) => SteamReviewSettings,
): EditorProject => {
  const settings = steamReviewOf(project);

  if (!settings) {
    return project;
  }

  const next = update(settings);

  return next === settings ? project : {...project, templateSettings: next};
};

/**
 * A source change moves the length as well as the payload. `fit` is for a fresh
 * upload, which adopts the footage's length outright; a relink or a locale
 * replacement only clamps, so an intentional shorter cut is not overwritten by
 * a longer file arriving later.
 */
const mapSteamReviewSource = (
  project: EditorProject,
  mode: 'fit' | 'clamp',
  update: (settings: SteamReviewSettings) => SteamReviewSettings,
): EditorProject => {
  const settings = steamReviewOf(project);

  if (!settings) {
    return project;
  }

  const next = update(settings);

  if (next === settings) {
    return project;
  }

  const shortest = shortestSourceMs(next);
  const durationS =
    mode === 'fit'
      ? steamReviewFittedDurationS(next)
      : shortest > 0
        ? Math.min(project.durationPreset, Math.floor(shortest / 1000))
        : project.durationPreset;

  return withSteamReviewDuration(project, next, durationS);
};

/**
 * D-5 — the one shared trim window must stay inside *every* source that will
 * play it, so the binding length is the shortest of the common source and all
 * locale replacements. Zero when nothing with a duration is uploaded yet.
 * Exported for the inspector, whose trim strip drags against this bound.
 */
export const steamReviewTrimBoundMs = (
  settings: SteamReviewSettings,
): number => shortestSourceMs(settings);

const shortestSourceMs = (settings: SteamReviewSettings): number => {
  const durations = [
    settings.source?.durationMs,
    ...Object.values(settings.localeSources).map(
      (reference) => reference?.durationMs,
    ),
  ].filter((value): value is number => typeof value === 'number' && value > 0);

  return durations.length > 0 ? Math.min(...durations) : 0;
};

/**
 * A new shared source restarts the trim and the framing, mirroring
 * `setDay1PanelSource`: carrying the previous clip's window or zoom over would
 * crop footage nobody has looked at yet. It also adopts the footage's length —
 * a 35s clip renders a 35s store page, which is the point of the auto-fit.
 * Clearing keeps the rest of the edit, and the length with it.
 */
export const setSteamReviewSource = (
  project: EditorProject,
  source: MediaReference | null,
): EditorProject =>
  source === null
    ? mapSteamReview(project, (settings) =>
        settings.source === null ? settings : {...settings, source: null},
      )
    : mapSteamReviewSource(project, 'fit', (settings) =>
        // The gameplay slot plays video; a reference without a duration (an
        // image) would fail the schema, so it is refused here instead.
        source.durationMs
          ? {
              ...settings,
              source,
              trim: {inMs: 0, outMs: 0},
              transforms: {base: {...DEFAULT_TRANSFORM}, overrides: {}},
            }
          : settings,
      );

/**
 * Plan Q4 — one locale's replacement footage. D-5 keeps one shared trim window
 * across every locale, so a shorter replacement used to be refused outright.
 * With the length fitted to the footage it shortens the output instead, which
 * re-cuts every locale to a window they can all play — visible in the length
 * field rather than silent. Below the template's floor there is no such window,
 * so that case is still refused and the asset panel explains it.
 */
export const setSteamReviewLocaleSource = (
  project: EditorProject,
  locale: Locale,
  source: MediaReference | null,
): EditorProject =>
  mapSteamReviewSource(project, 'clamp', (settings) => {
    if (source === null) {
      if (!(locale in settings.localeSources)) {
        return settings;
      }

      const localeSources = {...settings.localeSources};

      delete localeSources[locale];

      return {...settings, localeSources};
    }

    if (
      !source.durationMs ||
      source.durationMs < STEAM_REVIEW_MIN_DURATION_S * 1000
    ) {
      return settings;
    }

    return {
      ...settings,
      localeSources: {...settings.localeSources, [locale]: source},
    };
  });

export const setSteamReviewSourceStatus = (
  project: EditorProject,
  status: MediaReference['status'],
): EditorProject =>
  mapSteamReview(project, (settings) =>
    settings.source
      ? {...settings, source: {...settings.source, status}}
      : settings,
  );

/**
 * Restores or replaces the shared source while keeping the edit — the
 * `relinkDay1PanelSource` counterpart. The trim is reconciled, not reset, so a
 * reload (same file, same duration) keeps the chosen window bit for bit.
 */
export const relinkSteamReviewSource = (
  project: EditorProject,
  source: MediaReference,
): EditorProject =>
  mapSteamReviewSource(project, 'clamp', (settings) =>
    source.durationMs ? {...settings, source} : settings,
  );

/** The locale-source counterpart of `relinkSteamReviewSource`. */
export const relinkSteamReviewLocaleSource = (
  project: EditorProject,
  locale: Locale,
  source: MediaReference,
): EditorProject =>
  mapSteamReviewSource(project, 'clamp', (settings) =>
    source.durationMs
      ? {
          ...settings,
          localeSources: {...settings.localeSources, [locale]: source},
        }
      : settings,
  );

/** Restores the key art without resetting its per-placement crop (D-4). */
export const relinkSteamReviewKeyArt = (
  project: EditorProject,
  image: MediaReference,
): EditorProject =>
  mapSteamReview(project, (settings) => ({
    ...settings,
    keyArt: {...settings.keyArt, image},
  }));

/**
 * §3.5 — the window length is the project's length (or all of the shortest
 * source when that is less), so moving the in point is the whole edit, exactly
 * like the Day1 panel trim. This is what makes a 30s cut out of a 60s clip
 * possible after the auto-fit has been overridden.
 */
export const setSteamReviewTrimInMs = (
  project: EditorProject,
  inMs: number,
): EditorProject =>
  mapSteamReview(project, (settings) => {
    const boundMs = shortestSourceMs(settings);

    if (boundMs <= 0) {
      return settings;
    }

    return {
      ...settings,
      trim: reconcileTrim(
        {inMs, outMs: inMs},
        boundMs,
        steamReviewWindowMs(project),
      ),
    };
  });

/** Video slot framing — the same override rules as a scene or panel. */
export const updateSteamReviewTransform = (
  project: EditorProject,
  ratio: AspectRatio,
  patch: Partial<MediaTransform>,
): EditorProject =>
  mapSteamReview(project, (settings) =>
    writeTransform(settings, ratio, patch),
  );

export const resetSteamReviewTransform = (
  project: EditorProject,
  ratio: AspectRatio,
): EditorProject =>
  updateSteamReviewTransform(project, ratio, {...DEFAULT_TRANSFORM});

export const setSteamReviewRatioOverride = (
  project: EditorProject,
  ratio: AspectRatio,
  enabled: boolean,
): EditorProject =>
  mapSteamReview(project, (settings) =>
    writeRatioOverride(settings, ratio, enabled),
  );

/** Plan Q3·Q7 — the one landscape key art, shared across locales. */
export const setSteamReviewKeyArt = (
  project: EditorProject,
  image: MediaReference | null,
): EditorProject =>
  mapSteamReview(project, (settings) => ({
    ...settings,
    keyArt: image
      ? // A new art restarts its framing, like a new panel source does.
        {image, transforms: {base: {...DEFAULT_TRANSFORM}, overrides: {}}}
      : {...settings.keyArt, image: null},
  }));

/** D-4 — per-placement crop control over the two key art slots. */
export const updateSteamReviewKeyArtTransform = (
  project: EditorProject,
  ratio: AspectRatio,
  patch: Partial<MediaTransform>,
): EditorProject =>
  mapSteamReview(project, (settings) => ({
    ...settings,
    keyArt: writeTransform(settings.keyArt, ratio, patch),
  }));

export const resetSteamReviewKeyArtTransform = (
  project: EditorProject,
  ratio: AspectRatio,
): EditorProject =>
  updateSteamReviewKeyArtTransform(project, ratio, {...DEFAULT_TRANSFORM});

export const setSteamReviewKeyArtRatioOverride = (
  project: EditorProject,
  ratio: AspectRatio,
  enabled: boolean,
): EditorProject =>
  mapSteamReview(project, (settings) => ({
    ...settings,
    keyArt: writeRatioOverride(settings.keyArt, ratio, enabled),
  }));

/** Plan Q10 — one of the four fixed slots. Out-of-range indexes are refused. */
export const setSteamReviewThumbnail = (
  project: EditorProject,
  index: number,
  image: MediaReference | null,
): EditorProject =>
  mapSteamReview(project, (settings) => {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= STEAM_REVIEW_THUMBNAIL_COUNT
    ) {
      return settings;
    }

    return {
      ...settings,
      thumbnails: settings.thumbnails.map((current, slot) =>
        slot === index ? image : current,
      ),
    };
  });

/**
 * The copy block a wording edit lands on. `switchTemplate` fills every locale,
 * so this base only matters for a document whose block was stripped by hand —
 * and even then the Korean fourth tag arrives pinned (D-6).
 */
const steamReviewCopyOf = (
  copy: LocalizedCopy,
  locale: Locale,
): SteamReviewCopy =>
  copy.steamReview ?? {
    title: '',
    description: '',
    tags: ['', '', '', locale === 'ko' ? STEAM_REVIEW_KR_NOTICE : ''],
  };

const writeSteamReviewCopy = (
  project: EditorProject,
  locale: Locale,
  update: (block: SteamReviewCopy) => SteamReviewCopy,
): EditorProject => {
  const current = project.copy[locale] as LocalizedCopy;

  return {
    ...project,
    copy: {
      ...project.copy,
      [locale]: {
        ...current,
        steamReview: update(steamReviewCopyOf(current, locale)),
      },
    },
  };
};

export const setSteamReviewTitle = (
  project: EditorProject,
  locale: Locale,
  value: string,
): EditorProject =>
  writeSteamReviewCopy(project, locale, (block) => ({...block, title: value}));

/** Plan Q8 — rendered on 16:9 only, editable per locale regardless. */
export const setSteamReviewDescription = (
  project: EditorProject,
  locale: Locale,
  value: string,
): EditorProject =>
  writeSteamReviewCopy(project, locale, (block) => ({
    ...block,
    description: value,
  }));

/**
 * D-6 / Plan Q5 — the Korean fourth tag is the loot-box notice and nothing
 * else, so a write aimed at it is refused, exactly as the schema would refuse
 * the resulting document.
 */
export const setSteamReviewTag = (
  project: EditorProject,
  locale: Locale,
  index: number,
  value: string,
): EditorProject => {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= 4 ||
    (locale === 'ko' && index === 3)
  ) {
    return project;
  }

  return writeSteamReviewCopy(project, locale, (block) => ({
    ...block,
    tags: block.tags.map((tag, slot) =>
      slot === index ? value : tag,
    ) as SteamReviewCopy['tags'],
  }));
};
