// steam-review Design Ref: §12.1 — the schema arm (§3.1/§3.2), the commands
// that produce a store-page project (§3.5), and the two shared-layer regression
// fences (D-1 kv-loop slot floor, D-2 preset tuple).
import {describe, expect, it} from 'vitest';

import {testMediaReference} from '../../test/fixtures/media';
import {
  kvLoopProjectFixture,
  kvLoopSettingsOf,
  steamReviewProjectFixture,
  steamReviewSettingsOf,
  day1ProjectFixture,
  day1QuadProjectFixture,
} from '../../test/fixtures/project';
import {
  DURATION_PRESETS,
  STEAM_REVIEW_KR_NOTICE,
  durationPresetsForTemplate,
} from './constants';
import {
  createProject,
  parseProject,
  setKvCount,
  steamReviewOf,
  switchTemplate,
} from './project';
import {
  STEAM_REVIEW_WINDOW_MS,
  resetSteamReviewTransform,
  setSteamReviewKeyArt,
  setSteamReviewKeyArtRatioOverride,
  setSteamReviewLocaleSource,
  setSteamReviewRatioOverride,
  setSteamReviewSource,
  setSteamReviewTag,
  setSteamReviewThumbnail,
  setSteamReviewTitle,
  setSteamReviewTrimInMs,
  updateSteamReviewKeyArtTransform,
  updateSteamReviewTransform,
} from './steamReviewCommands';
import {parseProjectFile, serializeProjectFile} from './projectFile';
import type {EditorProject, LocalizedCopy, MediaReference} from './types';

const video = (id: string, durationMs = 30_000): MediaReference =>
  testMediaReference({id: `media_${id}`, durationMs});

const image = (id: string): MediaReference =>
  testMediaReference({
    id: `media_${id}`,
    kind: 'image',
    name: `${id}.png`,
    mimeType: 'image/png',
    durationMs: undefined,
  });

const issuePaths = (project: unknown) => {
  const result = parseProject(project);

  if (result.ok) {
    return [];
  }

  const issues = result.error.details?.issues as
    | Array<{path: string; message: string}>
    | undefined;

  return issues?.map((issue) => issue.path) ?? [];
};

describe('switchTemplate to steam-review', () => {
  it('builds a valid 20s one-section project with the default copy', () => {
    const project = switchTemplate(createProject(15), 'steam-review');

    expect(parseProject(project).ok).toBe(true);
    expect(project.durationPreset).toBe(20);
    expect(project.sections).toEqual([
      {id: 'gameplay', label: '게임플레이', durationMs: 20_000},
    ]);

    const settings = steamReviewOf(project);

    expect(settings?.trim).toEqual({inMs: 0, outMs: 20_000});
    expect(settings?.thumbnails).toEqual([null, null, null, null]);

    // §3.4 — the copy arrives filled with the UnderDark defaults, the pinned
    // Korean fourth tag included (D-6).
    const koCopy = project.copy.ko as LocalizedCopy;

    expect(koCopy.steamReview?.title).toBe('언더다크 : 디펜스');
    expect(koCopy.steamReview?.tags[3]).toBe(STEAM_REVIEW_KR_NOTICE);

    const jaCopy = project.copy.ja as LocalizedCopy;

    expect(jaCopy.steamReview?.title).toBe('UnderDark : Defense');
  });

  it('survives an export/import round trip with sources marked missing', () => {
    const project = setSteamReviewSource(
      steamReviewProjectFixture(),
      video('common'),
    );
    const result = parseProjectFile(serializeProjectFile(project));

    expect(result.ok).toBe(true);

    if (result.ok) {
      const settings = steamReviewOf(result.value);

      expect(settings?.source?.status).toBe('missing');
    }
  });
});

describe('steam-review schema arm', () => {
  it('accepts the fixture project', () => {
    expect(parseProject(steamReviewProjectFixture()).ok).toBe(true);
  });

  it('pins the project to the 20s preset', () => {
    const project = steamReviewProjectFixture();

    expect(
      issuePaths({...project, durationPreset: 15}),
    ).toContain('durationPreset');
  });

  it('pins the axis to exactly one gameplay section', () => {
    const project = steamReviewProjectFixture();
    const withTwo: EditorProject = {
      ...project,
      sections: [
        {id: 'gameplay', label: '게임플레이', durationMs: 10_000},
        {id: 'extra', label: '추가', durationMs: 10_000},
      ],
    };

    expect(issuePaths(withTwo)).toContain('sections');
  });

  it('rejects a trim window that leaves the shared source', () => {
    const project = steamReviewProjectFixture({
      source: video('short', 15_000),
      trim: {inMs: 0, outMs: 20_000},
    });

    expect(issuePaths(project)).toContain('templateSettings.trim.outMs');
  });

  // D-5 — every locale replacement must be able to play the shared window.
  it('rejects a locale source shorter than the shared trim window', () => {
    const project = steamReviewProjectFixture({
      source: video('common'),
      localeSources: {ko: video('kr', 15_000)},
      trim: {inMs: 0, outMs: 20_000},
    });

    expect(issuePaths(project)).toContain(
      'templateSettings.localeSources.ko.durationMs',
    );
  });

  // D-6 — the Korean fourth tag is pinned at the schema level.
  it('rejects a Korean copy block whose fourth tag is not the notice', () => {
    const project = steamReviewProjectFixture();
    const koCopy = project.copy.ko as LocalizedCopy;
    const tampered: EditorProject = {
      ...project,
      copy: {
        ...project.copy,
        ko: {
          ...koCopy,
          steamReview: {
            ...(koCopy.steamReview as NonNullable<
              LocalizedCopy['steamReview']
            >),
            tags: ['a', 'b', 'c', '무료 플레이'],
          },
        },
      },
    };

    expect(issuePaths(tampered)).toContain('copy.ko.steamReview.tags.3');
  });
});

describe('steam-review commands', () => {
  it('no-op on a foreign template', () => {
    const project = createProject(15);

    expect(setSteamReviewSource(project, video('x'))).toBe(project);
    expect(setSteamReviewThumbnail(project, 0, image('t'))).toBe(project);
    expect(setSteamReviewTrimInMs(project, 1000)).toBe(project);
  });

  it('applies a new source and restarts the 20s trim window', () => {
    const project = setSteamReviewSource(
      steamReviewProjectFixture(),
      video('common', 32_000),
    );
    const settings = steamReviewOf(project);

    expect(settings?.source?.id).toBe('media_common');
    expect(settings?.trim).toEqual({inMs: 0, outMs: STEAM_REVIEW_WINDOW_MS});
    expect(parseProject(project).ok).toBe(true);
  });

  it('shrinks the window to a shorter source instead of leaving it', () => {
    const project = setSteamReviewSource(
      steamReviewProjectFixture(),
      video('short', 12_000),
    );

    expect(steamReviewOf(project)?.trim).toEqual({inMs: 0, outMs: 12_000});
    expect(parseProject(project).ok).toBe(true);
  });

  it('refuses a source without a duration', () => {
    const project = steamReviewProjectFixture();

    expect(setSteamReviewSource(project, image('art'))).toBe(project);
  });

  it('moves the trim window without changing its length', () => {
    const project = setSteamReviewTrimInMs(
      setSteamReviewSource(steamReviewProjectFixture(), video('long', 32_000)),
      5_000,
    );

    expect(steamReviewOf(project)?.trim).toEqual({
      inMs: 5_000,
      outMs: 25_000,
    });
  });

  it('clamps the trim inside the shortest source (D-5)', () => {
    // Common 32s, but the KR replacement is 24s: the window may slide only 4s.
    let project = setSteamReviewSource(
      steamReviewProjectFixture(),
      video('long', 32_000),
    );
    project = setSteamReviewLocaleSource(project, 'ko', video('kr', 24_000));
    project = setSteamReviewTrimInMs(project, 10_000);

    expect(steamReviewOf(project)?.trim).toEqual({
      inMs: 4_000,
      outMs: 24_000,
    });
    expect(parseProject(project).ok).toBe(true);
  });

  it('accepts a locale replacement and clears it back to the shared source', () => {
    let project = setSteamReviewSource(
      steamReviewProjectFixture(),
      video('common'),
    );
    project = setSteamReviewLocaleSource(project, 'ko', video('kr', 25_000));

    expect(steamReviewOf(project)?.localeSources.ko?.id).toBe('media_kr');

    project = setSteamReviewLocaleSource(project, 'ko', null);

    expect(steamReviewOf(project)?.localeSources.ko).toBeUndefined();
  });

  it('refuses a locale replacement shorter than the trim window (D-5)', () => {
    const project = setSteamReviewSource(
      steamReviewProjectFixture(),
      video('common'),
    );

    expect(
      setSteamReviewLocaleSource(project, 'ko', video('kr', 15_000)),
    ).toBe(project);
  });

  it('writes thumbnails by slot and refuses out-of-range indexes', () => {
    const project = steamReviewProjectFixture();
    const filled = setSteamReviewThumbnail(project, 2, image('thumb'));

    expect(steamReviewOf(filled)?.thumbnails[2]?.id).toBe('media_thumb');
    expect(setSteamReviewThumbnail(project, 4, image('thumb'))).toBe(project);
    expect(setSteamReviewThumbnail(project, -1, image('thumb'))).toBe(project);
  });

  it('frames the video slot with per-ratio overrides like a scene', () => {
    let project = steamReviewProjectFixture();

    project = updateSteamReviewTransform(project, '9:16', {scale: 1.4});
    expect(steamReviewOf(project)?.transforms.base.scale).toBe(1.4);

    project = setSteamReviewRatioOverride(project, '1:1', true);
    project = updateSteamReviewTransform(project, '1:1', {x: 10});
    expect(steamReviewOf(project)?.transforms.overrides['1:1']?.x).toBe(10);
    // The base keeps its own framing once the override exists.
    expect(steamReviewOf(project)?.transforms.base.x).toBe(0);

    project = resetSteamReviewTransform(project, '9:16');
    expect(steamReviewOf(project)?.transforms.base.scale).toBe(1);
  });

  it('manages the key art and its per-placement crop (D-4)', () => {
    let project = setSteamReviewKeyArt(
      steamReviewProjectFixture(),
      image('keyart'),
    );

    expect(steamReviewOf(project)?.keyArt.image?.id).toBe('media_keyart');

    project = setSteamReviewKeyArtRatioOverride(project, '9:16', true);
    project = updateSteamReviewKeyArtTransform(project, '9:16', {y: -20});
    expect(
      steamReviewOf(project)?.keyArt.transforms.overrides['9:16']?.y,
    ).toBe(-20);

    project = setSteamReviewKeyArt(project, null);
    expect(steamReviewOf(project)?.keyArt.image).toBeNull();
  });

  it('edits wording per locale and keeps documents valid', () => {
    let project = steamReviewProjectFixture();

    project = setSteamReviewTitle(project, 'en', 'My Game');
    project = setSteamReviewTag(project, 'en', 3, 'Wishlist now');
    project = setSteamReviewTag(project, 'ko', 0, '실시간 전략');

    const enCopy = project.copy.en as LocalizedCopy;
    const koCopy = project.copy.ko as LocalizedCopy;

    expect(enCopy.steamReview?.title).toBe('My Game');
    expect(enCopy.steamReview?.tags[3]).toBe('Wishlist now');
    expect(koCopy.steamReview?.tags[0]).toBe('실시간 전략');
    expect(parseProject(project).ok).toBe(true);
  });

  // D-6 — the pinned Korean tag refuses writes at the command level too.
  it('refuses to edit the Korean fourth tag', () => {
    const project = steamReviewProjectFixture();

    expect(setSteamReviewTag(project, 'ko', 3, '무료')).toBe(project);
    expect(setSteamReviewTag(project, 'ko', 4, '무료')).toBe(project);
  });
});

describe('shared-layer regressions', () => {
  // D-2 — the tuple is untouched; 20s lives only in the schema literal.
  it('keeps the DURATION_PRESETS tuple exactly [15, 30, 60]', () => {
    expect([...DURATION_PRESETS]).toEqual([15, 30, 60]);
  });

  it('keeps every template’s preset list unchanged and gives steam-review [20]', () => {
    expect([...durationPresetsForTemplate('three-scene')]).toEqual([15, 30, 60]);
    expect([...durationPresetsForTemplate('day1')]).toEqual([15, 30, 60]);
    expect([...durationPresetsForTemplate('day1-quad')]).toEqual([15, 30]);
    expect([...durationPresetsForTemplate('kv-loop')]).toEqual([15, 30, 60]);
    expect([...durationPresetsForTemplate('steam-review')]).toEqual([20]);
  });

  // D-1 — the section-axis floor dropped to 1, the kv-loop slot floor did not.
  it('still rejects a one-slot kv-loop document', () => {
    const project = kvLoopProjectFixture();
    const settings = kvLoopSettingsOf(project);
    const oneSlot: EditorProject = {
      ...project,
      sections: [{...project.sections[0], durationMs: 7_500} as never],
      templateSettings: {
        ...settings,
        slots: settings.slots.slice(0, 1),
      },
    };

    expect(parseProject(oneSlot).ok).toBe(false);
  });

  it('still refuses setKvCount(1)', () => {
    const project = kvLoopProjectFixture();

    expect(setKvCount(project, 1)).toBe(project);
    expect(kvLoopSettingsOf(setKvCount(project, 3)).slots).toHaveLength(3);
  });

  it('parses every existing template fixture unchanged', () => {
    expect(parseProject(createProject(15)).ok).toBe(true);
    expect(parseProject(day1ProjectFixture()).ok).toBe(true);
    expect(parseProject(day1QuadProjectFixture()).ok).toBe(true);
    expect(parseProject(kvLoopProjectFixture()).ok).toBe(true);
  });
});
