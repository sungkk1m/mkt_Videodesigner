// key-visual-looping Design Ref: §8.1 — the schema arm (§3.2/§3.4) and the
// commands that produce a looping project (§11.3 module-2).
import {describe, expect, it} from 'vitest';

import {testMediaReference, testUrlResolver} from '../../test/fixtures/media';
import {kvLoopProjectFixture, kvLoopSettingsOf} from '../../test/fixtures/project';
import {MAX_KV_EFFECTS_PER_SLOT} from './constants';
import {
  addKvEffect,
  applyDurationPreset,
  buildEditorSnapshot,
  buildKvLoopProps,
  createProject,
  kvLoopOf,
  moveKvImage,
  parseProject,
  removeKvEffect,
  resetKvSlotTransform,
  setKvCount,
  setKvImage,
  setKvImageStatus,
  setKvDefaultMotion,
  setKvMotion,
  setKvLoopCount,
  setKvTitleImage,
  switchTemplate,
  updateKvDisclaimerStyle,
  updateKvEffect,
  updateKvLoopSettings,
  updateKvSlotTransform,
  updateKvTitleTransform,
} from './project';
import type {EditorProject, LocalizedCopy, MediaReference} from './types';

const kvImage = (name: string): MediaReference =>
  testMediaReference({
    id: `media_${name}`,
    kind: 'image',
    name: `${name}.png`,
    mimeType: 'image/png',
    durationMs: undefined,
    width: 1080,
    height: 1920,
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

const issueMessages = (project: unknown) => {
  const result = parseProject(project);

  if (result.ok) {
    return [];
  }

  const issues = result.error.details?.issues as
    | Array<{path: string; message: string}>
    | undefined;

  return issues?.map((issue) => issue.message) ?? [];
};

describe('switchTemplate to kv-loop', () => {
  it('lays out one section per key visual, sharing one cycle', () => {
    const project = switchTemplate(createProject(15), 'kv-loop');

    expect(project.sections.map((section) => section.id)).toEqual([
      'kv-0',
      'kv-1',
      'kv-2',
      'kv-3',
    ]);
    expect(project.sections.map((section) => section.durationMs)).toEqual([
      1875, 1875, 1875, 1875,
    ]);
    // Plan L1 — the axis is one cycle, and two of them make the 15s preset.
    expect(kvLoopOf(project)?.loopCount).toBe(2);
  });

  it('forces the output ratio to 9:16 — FR-L14 / D-06', () => {
    const wide: EditorProject = {
      ...createProject(15),
      render: {
        ...createProject(15).render,
        selectedRatios: ['16:9', '1:1'],
      },
      selectedRatio: '16:9',
    };
    const project = switchTemplate(wide, 'kv-loop');

    expect(project.render.selectedRatios).toEqual(['9:16']);
    expect(project.selectedRatio).toBe('9:16');
  });

  it('produces a project the schema accepts', () => {
    expect(parseProject(switchTemplate(createProject(15), 'kv-loop')).ok).toBe(
      true,
    );
    expect(parseProject(switchTemplate(createProject(60), 'kv-loop')).ok).toBe(
      true,
    );
  });

  it('round-trips across all three templates', () => {
    const looping = switchTemplate(createProject(30), 'kv-loop');
    const three = switchTemplate(looping, 'three-scene');
    const day1 = switchTemplate(three, 'day1');
    const back = switchTemplate(day1, 'kv-loop');

    expect(three.templateSettings.template).toBe('three-scene');
    expect(day1.templateSettings.template).toBe('day1');
    expect(back.templateSettings.template).toBe('kv-loop');
    expect(parseProject(three).ok).toBe(true);
    expect(parseProject(day1).ok).toBe(true);
    expect(parseProject(back).ok).toBe(true);
  });

  it('keeps the name, copy, audio, and render settings', () => {
    const before = {...createProject(15), name: 'kv-teaser'};
    const after = switchTemplate(before, 'kv-loop');

    expect(after.name).toBe('kv-teaser');
    expect(after.copy).toEqual(before.copy);
    expect(after.audio).toEqual(before.audio);
    expect(after.render.profile).toBe(before.render.profile);
  });
});

describe('applyDurationPreset on a looping project', () => {
  it('redivides the cycle and keeps the invariant', () => {
    const longer = applyDurationPreset(
      switchTemplate(createProject(15), 'kv-loop'),
      30,
    );

    expect(longer.sections.map((section) => section.durationMs)).toEqual([
      3750, 3750, 3750, 3750,
    ]);
    expect(parseProject(longer).ok).toBe(true);
  });
});

describe('the kv-loop schema arm', () => {
  it('rejects a slot count that does not match the sections — D-02', () => {
    const project = kvLoopProjectFixture();
    const settings = kvLoopSettingsOf(project);

    expect(
      issuePaths({
        ...project,
        templateSettings: {...settings, slots: settings.slots.slice(0, 3)},
      }),
    ).toContain('templateSettings.slots');
  });

  it('rejects any output ratio other than 9:16 — FR-L14', () => {
    const project = kvLoopProjectFixture();

    expect(
      issuePaths({
        ...project,
        render: {...project.render, selectedRatios: ['9:16', '1:1']},
      }),
    ).toContain('render.selectedRatios');
    expect(issuePaths({...project, selectedRatio: '1:1'})).toContain(
      'selectedRatio',
    );
  });

  it('multiplies the axis by the repeat count — D-01', () => {
    const project = kvLoopProjectFixture();
    const settings = kvLoopSettingsOf(project);

    // The cycle is 7.5s, which is the 15s preset at two repeats but not three.
    expect(
      issuePaths({
        ...project,
        templateSettings: {...settings, loopCount: 3},
      }),
    ).toContain('sections');
    expect(
      issueMessages({...project, templateSettings: {...settings, loopCount: 3}}),
    ).toContainEqual(
      'A cycle of 7.5 seconds repeated 3 times is 22.5 seconds, which must equal the 15 second preset.',
    );
  });

  it('leaves the other templates’ invariant message alone', () => {
    const project = createProject(15);

    expect(
      issueMessages({
        ...project,
        sections: project.sections.map((section, index) =>
          index === 0 ? {...section, durationMs: 5000} : section,
        ),
      }),
    ).toContainEqual(
      'Section durations must total 15 seconds, received 18.',
    );
  });

  it('requires the generated section ids', () => {
    const project = kvLoopProjectFixture();

    expect(
      issuePaths({
        ...project,
        sections: project.sections.map((section, index) =>
          index === 1 ? {...section, id: 'hook'} : section,
        ),
      }),
    ).toContain('sections.1.id');
  });

  it('accepts a half-filled image set, because uploads are saved as they land', () => {
    const project = kvLoopProjectFixture({
      images: {ko: [kvImage('ko-1'), null, null, null]},
    });

    expect(parseProject(project).ok).toBe(true);
  });

  it('accepts a looping project with no overlays at all — Plan L5', () => {
    const settings = kvLoopSettingsOf(kvLoopProjectFixture());

    expect(settings.title.images).toEqual({});
    expect(parseProject(kvLoopProjectFixture()).ok).toBe(true);
  });
});

describe('buildKvLoopProps', () => {
  const filled = () =>
    kvLoopProjectFixture({
      images: {
        ko: [kvImage('a'), kvImage('b'), kvImage('c'), kvImage('d')],
      },
    });

  it('flattens the cycle across repeats and fills the preset exactly', () => {
    const props = buildKvLoopProps(filled(), testUrlResolver());

    expect(props?.segments).toHaveLength(8);
    expect(props?.totalFrames).toBe(450);
    expect(
      props?.segments.reduce(
        (sum, segment) => sum + segment.durationInFrames,
        0,
      ),
    ).toBe(450);
  });

  it('resolves one slot per key visual, in cycle order', () => {
    const props = buildKvLoopProps(filled(), testUrlResolver('blob:kv'));

    expect(props?.slots.map((slot) => slot.url)).toEqual([
      'blob:kv',
      'blob:kv',
      'blob:kv',
      'blob:kv',
    ]);
    // The keyframes are resolved here so the Player and the render job read the
    // same pair (kv-motion-effects §2.2). The default loop preset is zoomIn, so
    // slot 0 inherits "whole frame → centred crop" — and a new loop round-trips
    // it with the forced easeInOut (kv-loop-reference-motion R-1/D-03).
    expect(props?.slots[0]).toMatchObject({
      fit: 'cover',
      scale: 1,
      x: 0,
      y: 0,
      motion: {
        from: {x: 0, y: 0, size: 1},
        easing: 'easeInOut',
        roundTrip: true,
      },
    });
    expect(props?.slots[0]?.motion.to.size).toBeLessThan(1);
  });

  it('renders with no title and no disclaimer — SC5', () => {
    const props = buildKvLoopProps(filled(), testUrlResolver());

    expect(props?.title.url).toBeNull();
    expect(props?.disclaimer.text).toBe('');
  });

  it('opens a title overlay on contain, so a logo is never cropped', () => {
    expect(buildKvLoopProps(filled(), testUrlResolver())?.title.fit).toBe(
      'contain',
    );
  });

  it('carries the locale disclaimer when one is written — FR-L11', () => {
    const project = filled();
    const copy = project.copy.ko as LocalizedCopy;
    const withDisclaimer: EditorProject = {
      ...project,
      copy: {...project.copy, ko: {...copy, kvLoopDisclaimer: '확률형 아이템 포함'}},
    };

    expect(
      buildKvLoopProps(withDisclaimer, testUrlResolver())?.disclaimer.text,
    ).toBe('확률형 아이템 포함');
  });

  it('clamps the crossfade to half of the shortest segment', () => {
    const project = filled();
    const settings = kvLoopSettingsOf(project);

    // The new-project default is a cut (FR-R07), so the clamp case sets the
    // crossfade explicitly.
    expect(
      buildKvLoopProps(project, testUrlResolver())?.transitionInFrames,
    ).toBe(0);
    expect(
      buildKvLoopProps(
        {...project, templateSettings: {...settings, transitionMs: 400}},
        testUrlResolver(),
      )?.transitionInFrames,
    ).toBe(12);

    // A one-second transition cannot fit inside a 1.875s hold at 30fps: the
    // half-segment ceiling is 28 frames, which is what a 30-frame request gets.
    expect(
      buildKvLoopProps(
        {...project, templateSettings: {...settings, transitionMs: 1000}},
        testUrlResolver(),
      )?.transitionInFrames,
    ).toBe(28);
  });

  it('returns null for another template', () => {
    expect(buildKvLoopProps(createProject(15), testUrlResolver())).toBeNull();
  });

  it('is what buildEditorSnapshot tags a looping project with — SC1', () => {
    const snapshot = buildEditorSnapshot(filled(), testUrlResolver());

    expect(snapshot.template).toBe('kv-loop');

    if (snapshot.template !== 'kv-loop') {
      return;
    }

    expect(snapshot.props.segments).toHaveLength(8);
    expect(buildEditorSnapshot(createProject(15), testUrlResolver()).template).toBe(
      'three-scene',
    );
  });
});

describe('the looping commands', () => {
  const withImages = () =>
    kvLoopProjectFixture({
      images: {
        ko: [kvImage('a'), kvImage('b'), kvImage('c'), kvImage('d')],
        en: [kvImage('e1'), kvImage('e2'), kvImage('e3'), kvImage('e4')],
      },
    });

  it('uploads, replaces, and clears one key visual — FR-L03', () => {
    const uploaded = setKvImage(kvLoopProjectFixture(), 'ko', 1, kvImage('b'));

    expect(kvLoopSettingsOf(uploaded).images.ko).toEqual([
      null,
      kvImage('b'),
      null,
      null,
    ]);
    expect(
      kvLoopSettingsOf(setKvImage(uploaded, 'ko', 1, null)).images.ko,
    ).toEqual([null, null, null, null]);
    expect(parseProject(uploaded).ok).toBe(true);
  });

  it('marks one key visual missing without touching the others', () => {
    const project = setKvImageStatus(withImages(), 'ko', 2, 'missing');
    const images = kvLoopSettingsOf(project).images.ko;

    expect(images?.[2]?.status).toBe('missing');
    expect(images?.[1]?.status).toBe('available');
  });

  it('reorders the framing and every locale with the key visual — FR-L03', () => {
    const moved = moveKvImage(withImages(), 0, 2);
    const settings = kvLoopSettingsOf(moved);

    expect(settings.images.ko?.map((reference) => reference?.id)).toEqual([
      'media_b',
      'media_c',
      'media_a',
      'media_d',
    ]);
    expect(settings.images.en?.map((reference) => reference?.id)).toEqual([
      'media_e2',
      'media_e3',
      'media_e1',
      'media_e4',
    ]);
    // The hold times belong to timeline positions, not to the art.
    expect(moved.sections).toEqual(withImages().sections);
  });

  it('carries a slot’s framing with it when it moves', () => {
    const framed = updateKvSlotTransform(withImages(), 0, {scale: 1.5});
    const moved = moveKvImage(framed, 0, 3);

    expect(kvLoopSettingsOf(moved).slots.map((slot) => slot.transform.scale)).toEqual(
      [1, 1, 1, 1.5],
    );
  });

  it('leaves the project alone for an out-of-range move', () => {
    const project = withImages();

    expect(moveKvImage(project, 0, 9)).toBe(project);
    expect(moveKvImage(project, 2, 2)).toBe(project);
  });

  it('adds and removes key visuals, redividing the cycle — FR-L03', () => {
    const six = setKvCount(kvLoopProjectFixture(), 6);

    expect(six.sections.map((section) => section.id)).toEqual([
      'kv-0',
      'kv-1',
      'kv-2',
      'kv-3',
      'kv-4',
      'kv-5',
    ]);
    expect(six.sections.map((section) => section.durationMs)).toEqual([
      1250, 1250, 1250, 1250, 1250, 1250,
    ]);
    expect(kvLoopSettingsOf(six).slots).toHaveLength(6);
    expect(parseProject(six).ok).toBe(true);

    const two = setKvCount(six, 2);

    expect(two.sections).toHaveLength(2);
    expect(kvLoopSettingsOf(two).slots).toHaveLength(2);
    expect(parseProject(two).ok).toBe(true);
  });

  it('keeps the images it can when the count shrinks and grows', () => {
    const shrunk = setKvCount(withImages(), 2);

    expect(
      kvLoopSettingsOf(shrunk).images.ko?.map((reference) => reference?.id),
    ).toEqual(['media_a', 'media_b']);

    const grown = setKvCount(shrunk, 4);

    expect(
      kvLoopSettingsOf(grown).images.ko?.map((reference) => reference?.id),
    ).toEqual(['media_a', 'media_b', undefined, undefined]);
  });

  it('changes the repeat count and redivides the cycle — FR-L06', () => {
    const once = setKvLoopCount(kvLoopProjectFixture(), 1);

    expect(once.sections.map((section) => section.durationMs)).toEqual([
      3750, 3750, 3750, 3750,
    ]);
    expect(kvLoopOf(once)?.loopCount).toBe(1);
    expect(parseProject(once).ok).toBe(true);
  });

  it('refuses a combination that cannot hold a second per key visual — FR-L07', () => {
    const project = kvLoopProjectFixture();

    // 15s over eight key visuals twice is 0.94s each, so the count is refused
    // rather than corrected: the UI shows the reason from `kvLoopCombination`.
    expect(setKvCount(project, 8)).toBe(project);
    expect(setKvLoopCount(project, 4)).toBe(project);
    expect(setKvCount(project, 9)).toBe(project);
    expect(setKvLoopCount(project, 5)).toBe(project);
  });

  it('clamps the framing and the motion values it is given', () => {
    const framed = updateKvSlotTransform(kvLoopProjectFixture(), 0, {
      scale: 99,
      x: -400,
      fit: 'contain',
    });
    const slot = kvLoopSettingsOf(framed).slots[0];

    expect(slot?.transform).toMatchObject({scale: 3, x: -50, fit: 'contain'});
    expect(
      kvLoopSettingsOf(resetKvSlotTransform(framed, 0)).slots[0]?.transform,
    ).toEqual({fit: 'cover', scale: 1, x: 0, y: 0});

    const motion = updateKvLoopSettings(kvLoopProjectFixture(), {
      kenBurnsIntensity: 4,
      transitionMs: 9000,
      fadeOutMs: -5,
    });

    expect(kvLoopSettingsOf(motion)).toMatchObject({
      kenBurnsIntensity: 1,
      transitionMs: 1000,
      fadeOutMs: 0,
    });
    expect(parseProject(motion).ok).toBe(true);
  });

  it('holds one key visual still and leaves the rest inheriting — FR-M01', () => {
    const project = setKvMotion(kvLoopProjectFixture(), 2, {
      kind: 'preset',
      preset: 'still',
    });

    expect(kvLoopSettingsOf(project).slots.map((slot) => slot.motion)).toEqual([
      null,
      null,
      {kind: 'preset', preset: 'still'},
      null,
    ]);
  });

  it('moves every inheriting slot when the loop default changes — FR-M02', () => {
    const project = setKvDefaultMotion(
      setKvMotion(kvLoopProjectFixture(), 1, {kind: 'preset', preset: 'still'}),
      {kind: 'preset', preset: 'panLeftToRight'},
    );
    const settings = kvLoopSettingsOf(project);

    expect(settings.motion).toEqual({kind: 'preset', preset: 'panLeftToRight'});
    // The one that opted out keeps its own choice.
    expect(settings.slots[1]?.motion).toEqual({kind: 'preset', preset: 'still'});
  });

  it('hands a slot back to the default with null — FR-M02', () => {
    const project = setKvMotion(
      setKvMotion(kvLoopProjectFixture(), 0, {kind: 'preset', preset: 'zoomOut'}),
      0,
      null,
    );

    expect(kvLoopSettingsOf(project).slots[0]?.motion).toBeNull();
  });

  it('adds and removes a per-locale title — FR-L10', () => {
    const added = setKvTitleImage(
      kvLoopProjectFixture(),
      'ko',
      kvImage('title'),
    );

    expect(kvLoopSettingsOf(added).title.images.ko?.id).toBe('media_title');

    const removed = setKvTitleImage(added, 'ko', null);

    expect(kvLoopSettingsOf(removed).title.images).toEqual({});
    expect(parseProject(removed).ok).toBe(true);
  });

  it('moves and sizes the title, and styles the disclaimer', () => {
    const project = updateKvDisclaimerStyle(
      updateKvTitleTransform(kvLoopProjectFixture(), {y: -30, scale: 0.8}),
      {fontSize: 999, textColor: '#ff0000'},
    );
    const settings = kvLoopSettingsOf(project);

    expect(settings.title.transform).toMatchObject({y: -30, scale: 0.8});
    expect(settings.disclaimer).toEqual({fontSize: 120, textColor: '#ff0000'});
    expect(parseProject(project).ok).toBe(true);
  });

  it('leaves another template’s project untouched', () => {
    const project = createProject(15);

    expect(setKvImage(project, 'ko', 0, kvImage('a'))).toBe(project);
    expect(setKvCount(project, 6)).toBe(project);
    expect(setKvMotion(project, 0, {kind: 'preset', preset: 'still'})).toBe(
      project,
    );
    expect(
      setKvDefaultMotion(project, {kind: 'preset', preset: 'zoomOut'}),
    ).toBe(project);
    expect(updateKvLoopSettings(project, {fadeOutMs: 0})).toBe(project);
  });
});

// kv-loop-reference-motion — the round trip, the cut, and the gaussian
// bookends. Plan FR-R06/R07/R11/R12; Design §2-§3.
describe('the reference-motion cycle', () => {
  it('opens a new loop on the reference grammar: cut, round trip, bookends', () => {
    const settings = kvLoopSettingsOf(kvLoopProjectFixture());

    expect(settings).toMatchObject({
      roundTrip: true,
      transitionMs: 0,
      // D-06 — the bookends replace the black fade; the field stays.
      fadeOutMs: 0,
      blur: {durationMs: 333, amountPx: 30},
    });
  });

  it('parses a stored document with none of the new fields as all-off — FR-R12', () => {
    const project = kvLoopProjectFixture();
    const {
      roundTrip: _roundTrip,
      blur: _blur,
      ...stored
    } = kvLoopSettingsOf(project) as Record<string, unknown> & {
      roundTrip: boolean;
      blur: unknown;
    };
    const result = parseProject({
      ...project,
      templateSettings: {...stored, transitionMs: 400},
    });

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    // The defaults preserve the one-way, crossfaded, unblurred behaviour the
    // document was saved with (SC6).
    expect(kvLoopSettingsOf(result.value)).toMatchObject({
      roundTrip: false,
      transitionMs: 400,
      blur: {durationMs: 0, amountPx: 0},
    });
  });

  it('accepts zero as a transition — a cut — and clamps below it', () => {
    const cut = updateKvLoopSettings(kvLoopProjectFixture(), {
      transitionMs: -50,
    });

    expect(kvLoopSettingsOf(cut).transitionMs).toBe(0);
    expect(parseProject(cut).ok).toBe(true);
    expect(buildKvLoopProps(cut, testUrlResolver())?.transitionInFrames).toBe(0);
  });

  it('folds the round trip into every slot with the forced easeInOut — D-03', () => {
    const project = kvLoopProjectFixture();
    const props = buildKvLoopProps(project, testUrlResolver());

    for (const slot of props?.slots ?? []) {
      expect(slot.motion.roundTrip).toBe(true);
      expect(slot.motion.easing).toBe('easeInOut');
    }

    // Off keeps the resolved easing, so a stored one-way project renders as
    // it always did.
    const oneWay = updateKvLoopSettings(project, {roundTrip: false});
    const slot = buildKvLoopProps(oneWay, testUrlResolver())?.slots[0];

    expect(slot?.motion.roundTrip).toBe(false);
    expect(slot?.motion.easing).toBe('easeOut');
  });

  it('resolves the bookends to frames and clamps their patch — FR-R11', () => {
    const project = kvLoopProjectFixture();

    // 333ms at the editor's 30fps preview is 10 frames — the reference's own
    // frame count (reference-measurement §4); a 60fps render doubles it.
    expect(buildKvLoopProps(project, testUrlResolver())).toMatchObject({
      blurInFrames: 10,
      blurAmountPx: 30,
    });

    const clamped = kvLoopSettingsOf(
      updateKvLoopSettings(project, {blurDurationMs: 9000, blurAmountPx: -4}),
    );

    expect(clamped.blur).toEqual({durationMs: 1000, amountPx: 0});

    const off = updateKvLoopSettings(project, {blurDurationMs: 0});

    expect(buildKvLoopProps(off, testUrlResolver())?.blurInFrames).toBe(0);
    expect(parseProject(off).ok).toBe(true);
  });
});

// kv-object-animation — the designated objects on a slot. Design §7.1: the
// schema default is the migration, the commands clamp, foreign templates no-op.
describe('the effect-object commands', () => {
  it('parses a stored slot with no effects field as an empty list — FR-O08', () => {
    const project = kvLoopProjectFixture();
    const {effects: _effects, ...storedSlot} = kvLoopSettingsOf(project)
      .slots[0] as Record<string, unknown> & {effects: unknown};
    const stored = {
      ...project,
      templateSettings: {
        ...kvLoopSettingsOf(project),
        slots: [storedSlot, ...kvLoopSettingsOf(project).slots.slice(1)],
      },
    };
    const result = parseProject(stored);

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    expect(kvLoopSettingsOf(result.value).slots[0]?.effects).toEqual([]);
  });

  it('adds each kind with a stored seed, and declines a full slot — FR-O01', () => {
    const one = addKvEffect(kvLoopProjectFixture(), 0, 'particles');
    const two = addKvEffect(one, 0, 'glow');
    const effects = kvLoopSettingsOf(two).slots[0]?.effects ?? [];

    expect(effects.map((effect) => effect.kind)).toEqual([
      'particles',
      'glow',
    ]);
    // D-03 — the one draw of randomness happens at creation and is persisted.
    expect(effects[0]?.kind === 'particles' && effects[0].seed).toBeTypeOf(
      'number',
    );
    expect(parseProject(two).ok).toBe(true);

    let full = two;
    for (let index = 0; index < 10; index += 1) {
      full = addKvEffect(full, 0, 'glow');
    }

    expect(kvLoopSettingsOf(full).slots[0]?.effects).toHaveLength(
      MAX_KV_EFFECTS_PER_SLOT,
    );
    // The untouched slots stay untouched.
    expect(kvLoopSettingsOf(full).slots[1]?.effects).toEqual([]);
  });

  it('patches with clamps and ignores keys foreign to the kind — FR-O06/FR-O07', () => {
    const project = addKvEffect(kvLoopProjectFixture(), 0, 'particles');
    const id = kvLoopSettingsOf(project).slots[0]?.effects[0]?.id as string;
    const patched = updateKvEffect(project, 0, id, {
      region: {x: 0.9, y: 0.9, width: 0.5, height: 0.5},
      density: 7,
      sizePx: 999,
      // Foreign to particles — must be ignored, not crash or leak in.
      periodMs: 100,
    });
    const effect = kvLoopSettingsOf(patched).slots[0]?.effects[0];

    expect(effect).toMatchObject({
      kind: 'particles',
      region: {x: 0.5, y: 0.5, width: 0.5, height: 0.5},
      density: 1,
      sizePx: 16,
    });
    expect(effect && 'periodMs' in effect).toBe(false);
    expect(parseProject(patched).ok).toBe(true);
  });

  it('removes one object and reaches the render props — FR-O01/§2.3', () => {
    const project = addKvEffect(kvLoopProjectFixture(), 0, 'glow');
    const withImages = setKvImage(
      setKvImage(project, 'ko', 0, kvImage('a')),
      'ko',
      1,
      kvImage('b'),
    );
    const id = kvLoopSettingsOf(project).slots[0]?.effects[0]?.id as string;

    expect(
      buildKvLoopProps(withImages, testUrlResolver())?.slots[0]?.effects,
    ).toHaveLength(1);

    const removed = removeKvEffect(withImages, 0, id);

    expect(kvLoopSettingsOf(removed).slots[0]?.effects).toEqual([]);
    expect(removeKvEffect(withImages, 0, 'effect_missing')).toBe(withImages);
  });

  it('leaves another template’s project untouched', () => {
    const project = createProject(15);

    expect(addKvEffect(project, 0, 'particles')).toBe(project);
    expect(updateKvEffect(project, 0, 'effect_x', {density: 1})).toBe(project);
    expect(removeKvEffect(project, 0, 'effect_x')).toBe(project);
  });
});
