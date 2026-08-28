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
import {steamReviewOf, writeRatioOverride, writeTransform} from './project';

/** The fixed window the trim selects out of the gameplay source (Plan Q2). */
export const STEAM_REVIEW_WINDOW_MS = STEAM_REVIEW_DURATION_S * 1000;

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
 * D-5 — the one shared trim window must stay inside *every* source that will
 * play it, so the binding length is the shortest of the common source and all
 * locale replacements. Zero when nothing with a duration is uploaded yet.
 */
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
 * crop footage nobody has looked at yet. Clearing keeps the rest of the edit.
 */
export const setSteamReviewSource = (
  project: EditorProject,
  source: MediaReference | null,
): EditorProject =>
  mapSteamReview(project, (settings) => {
    // The gameplay slot plays video; a reference without a duration (an image)
    // would fail the schema, so it is refused here instead.
    if (source && !source.durationMs) {
      return settings;
    }

    if (!source) {
      return {...settings, source: null};
    }

    const next = {...settings, source};

    return {
      ...next,
      trim: reconcileTrim(
        {inMs: 0, outMs: 0},
        shortestSourceMs(next),
        STEAM_REVIEW_WINDOW_MS,
      ),
      transforms: {base: {...DEFAULT_TRANSFORM}, overrides: {}},
    };
  });

/**
 * Plan Q4 — one locale's replacement footage. A source shorter than the shared
 * trim window is refused, not accommodated (D-5): shrinking the window here
 * would silently re-cut every other locale's render, and the asset panel is
 * the place that explains the refusal.
 */
export const setSteamReviewLocaleSource = (
  project: EditorProject,
  locale: Locale,
  source: MediaReference | null,
): EditorProject =>
  mapSteamReview(project, (settings) => {
    if (source === null) {
      if (!(locale in settings.localeSources)) {
        return settings;
      }

      const localeSources = {...settings.localeSources};

      delete localeSources[locale];

      return {...settings, localeSources};
    }

    if (!source.durationMs || source.durationMs < settings.trim.outMs) {
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
 * §3.5 — the window length is invariant (20s, or all of the shortest source
 * when that is less), so moving the in point is the whole edit, exactly like
 * the Day1 panel trim.
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
        STEAM_REVIEW_WINDOW_MS,
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
