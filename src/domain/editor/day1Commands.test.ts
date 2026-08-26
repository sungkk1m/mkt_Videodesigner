// Day1 Design Ref: §6.1 template switch, §6.3 inspector commands.
import {describe, expect, it} from 'vitest';

import {
  DEFAULT_DAY1_SETTINGS,
  applyDurationPreset,
  createProject,
  day1MissingPanels,
  day1Of,
  day1PanelAt,
  day1QuadOf,
  panelKeysOf,
  day1PanelsShorterThanSection,
  hasRatioOverride,
  moveTimelineBoundary,
  parseProject,
  relinkDay1PanelSource,
  resetDay1Transform,
  setDay1EndCardTrimInMs,
  setDay1EndCardTrimLengthMs,
  setDay1EndCardVideo,
  setDay1LabelText,
  setDay1PanelSource,
  setDay1PanelSourceStatus,
  setDay1RatioOverride,
  setDay1TrimInMs,
  setDay1TrimOutMs,
  switchTemplate,
  threeSceneOf,
  updateDay1EndCard,
  updateDay1LabelStyle,
  updateDay1Split,
  updateDay1Transform,
} from './project';
import {testMediaReference} from '../../test/fixtures/media';
import {
  DAY1_QUAD_SECTION_ORDER,
  DEFAULT_DAY1_PANEL_TRANSFORM,
} from './types';
import {
  day1ProjectFixture,
  day1QuadProjectFixture,
  day1QuadSettingsOf,
  day1SettingsOf,
} from '../../test/fixtures/project';
import type {EditorProject, LocalizedCopy} from './types';

const day1 = (project: EditorProject) => day1SettingsOf(project);

const withPanels = (): EditorProject => {
  const base = switchTemplate(createProject(), 'day1');
  const withA = setDay1PanelSource(
    base,
    'panelA',
    testMediaReference({id: 'media_a', durationMs: 12_000}),
  );

  return setDay1PanelSource(
    withA,
    'panelB',
    testMediaReference({id: 'media_b', durationMs: 12_000}),
  );
};

describe('switchTemplate', () => {
  it('replaces the payload and the section axis with the Day1 defaults', () => {
    const project = switchTemplate(createProject(), 'day1');

    expect(project.sections.map((section) => section.id)).toEqual([
      'panel-a',
      'panel-b',
      'endcard',
    ]);
    expect(day1(project)).toEqual(DEFAULT_DAY1_SETTINGS);
    expect(threeSceneOf(project)).toBeNull();
  });

  it('produces a document the v2 schema accepts in both directions', () => {
    const toDay1 = switchTemplate(createProject(), 'day1');
    const back = switchTemplate(toDay1, 'three-scene');

    expect(parseProject(toDay1).ok).toBe(true);
    expect(parseProject(back).ok).toBe(true);
    expect(back.sections.map((section) => section.id)).toEqual([
      'hook',
      'gameplay',
      'cta',
    ]);
  });

  it('keeps the common fields and drops only the template payload', () => {
    const before: EditorProject = {
      ...createProject(30),
      name: 'day1-comparison',
      selectedRatio: '1:1',
      selectedLocale: 'en',
    };
    const after = switchTemplate(before, 'day1');

    expect(after.name).toBe('day1-comparison');
    expect(after.selectedRatio).toBe('1:1');
    expect(after.selectedLocale).toBe('en');
    expect(after.durationPreset).toBe(30);
    expect(after.copy).toEqual(before.copy);
    expect(after.audio).toEqual(before.audio);
    expect(after.render).toEqual(before.render);
  });

  it('splits the preset evenly with a three second end card', () => {
    const durations = switchTemplate(createProject(30), 'day1').sections.map(
      (section) => section.durationMs,
    );

    expect(durations).toEqual([13_500, 13_500, 3000]);
    expect(durations.reduce((sum, value) => sum + value, 0)).toBe(30_000);
  });

  it('is a no-op when the project already uses that template', () => {
    const project = createProject();

    expect(switchTemplate(project, 'three-scene')).toBe(project);
  });
});

describe('Day1 panel sources', () => {
  it('sets one panel without touching the other', () => {
    const project = setDay1PanelSource(
      switchTemplate(createProject(), 'day1'),
      'panelA',
      testMediaReference({durationMs: 12_000}),
    );

    expect(day1(project).panelA.source).not.toBeNull();
    expect(day1(project).panelB.source).toBeNull();
  });

  it('clamps the new panel trim to its own section', () => {
    const project = withPanels();

    // panel-a is 6000ms of the 15s preset, so a 12s source yields a 6s window.
    expect(day1(project).panelA.trim).toEqual({inMs: 0, outMs: 6000});
    expect(day1(project).panelB.trim).toEqual({inMs: 0, outMs: 6000});
  });

  it('keeps the edit on relink but restarts it on a fresh upload', () => {
    const trimmed = setDay1TrimInMs(withPanels(), 'panelA', 2000);
    const replacement = testMediaReference({id: 'media_a', durationMs: 12_000});

    expect(day1(relinkDay1PanelSource(trimmed, 'panelA', replacement)).panelA.trim)
      .toEqual({inMs: 2000, outMs: 8000});
    expect(day1(setDay1PanelSource(trimmed, 'panelA', replacement)).panelA.trim)
      .toEqual({inMs: 0, outMs: 6000});
  });

  it('marks a single panel source as missing', () => {
    const project = setDay1PanelSourceStatus(withPanels(), 'panelB', 'missing');

    expect(day1(project).panelA.source?.status).toBe('available');
    expect(day1(project).panelB.source?.status).toBe('missing');
  });

  it('reports the panels still missing a video (FR-D03)', () => {
    const empty = switchTemplate(createProject(), 'day1');

    expect(day1MissingPanels(empty)).toEqual(['panelA', 'panelB']);
    expect(
      day1MissingPanels(
        setDay1PanelSource(empty, 'panelA', testMediaReference({durationMs: 9000})),
      ),
    ).toEqual(['panelB']);
    expect(day1MissingPanels(withPanels())).toEqual([]);
    expect(day1MissingPanels(createProject())).toEqual([]);
  });

  // Day1 Trim UX FR-S01. The 15s preset gives each panel a 6s section, so a 12s
  // source fills it and a 4s source cannot.
  it('reports the panels whose source cannot fill their section (FR-S01)', () => {
    const short = setDay1PanelSource(
      withPanels(),
      'panelA',
      testMediaReference({id: 'media_short', durationMs: 4000}),
    );

    expect(day1PanelsShorterThanSection(short)).toEqual(['panelA']);
    expect(day1PanelsShorterThanSection(withPanels())).toEqual([]);
  });

  it('leaves a panel with no source to day1MissingPanels, not this one', () => {
    const empty = switchTemplate(createProject(), 'day1');

    expect(day1MissingPanels(empty)).toEqual(['panelA', 'panelB']);
    expect(day1PanelsShorterThanSection(empty)).toEqual([]);
  });

  it('does not report a source that exactly fills its section', () => {
    const exact = setDay1PanelSource(
      withPanels(),
      'panelA',
      testMediaReference({id: 'media_exact', durationMs: 6000}),
    );

    expect(day1PanelsShorterThanSection(exact)).toEqual([]);
  });

  it('reports both panels when neither source is long enough', () => {
    const base = switchTemplate(createProject(), 'day1');
    const withA = setDay1PanelSource(
      base,
      'panelA',
      testMediaReference({id: 'short_a', durationMs: 2000}),
    );

    expect(
      day1PanelsShorterThanSection(
        setDay1PanelSource(
          withA,
          'panelB',
          testMediaReference({id: 'short_b', durationMs: 3000}),
        ),
      ),
    ).toEqual(['panelA', 'panelB']);
  });

  it('never reports anything for a three-scene project', () => {
    expect(day1PanelsShorterThanSection(createProject())).toEqual([]);
  });

  // Shrinking the section is the escape hatch the warning points at (Plan SC5),
  // so the detector has to clear once the boundary moves.
  it('clears once the section shrinks below the source', () => {
    const short = setDay1PanelSource(
      withPanels(),
      'panelA',
      testMediaReference({id: 'media_short', durationMs: 4000}),
    );

    expect(day1PanelsShorterThanSection(short)).toEqual(['panelA']);

    const shrunk = moveTimelineBoundary(short, 0, 3500);

    expect(day1PanelsShorterThanSection(shrunk)).toEqual([]);
  });
});

describe('Day1 panel trims', () => {
  it('clamps the in point so the window stays inside the source', () => {
    const project = setDay1TrimInMs(withPanels(), 'panelA', 99_000);

    expect(day1(project).panelA.trim).toEqual({inMs: 6000, outMs: 12_000});
  });

  it('moves the in point by the window when the out point is set', () => {
    const project = setDay1TrimOutMs(withPanels(), 'panelB', 9000);

    expect(day1(project).panelB.trim).toEqual({inMs: 3000, outMs: 9000});
  });

  it('re-clamps both panels after a boundary drag shortens a section', () => {
    const trimmed = setDay1TrimInMs(withPanels(), 'panelA', 6000);
    const moved = moveTimelineBoundary(trimmed, 0, 10_000);

    expect(moved.sections[0]?.durationMs).toBe(10_000);
    // The longer section needs a longer window, which pulls the in point back.
    expect(day1(moved).panelA.trim).toEqual({inMs: 2000, outMs: 12_000});
  });

  it('restarts panel trims when the duration preset changes', () => {
    const project = applyDurationPreset(
      setDay1TrimInMs(withPanels(), 'panelA', 3000),
      30,
    );

    expect(project.sections.map((section) => section.durationMs)).toEqual([
      13_500, 13_500, 3000,
    ]);
    // The 12s source is now shorter than its 13.5s section, so it fills it.
    expect(day1(project).panelA.trim).toEqual({inMs: 0, outMs: 12_000});
  });
});

describe('Day1 panel framing', () => {
  it('writes to the base transform without an override', () => {
    const project = updateDay1Transform(withPanels(), 'panelA', '9:16', {
      scale: 1.4,
      x: 10,
    });

    expect(day1(project).panelA.transforms.base).toEqual({
      fit: 'contain',
      scale: 1.4,
      x: 10,
      y: 0,
    });
    expect(day1(project).panelA.transforms.overrides).toEqual({});
  });

  it('seeds an override from what is on screen and writes there after', () => {
    const based = updateDay1Transform(withPanels(), 'panelB', '9:16', {scale: 1.2});
    const enabled = setDay1RatioOverride(based, 'panelB', '1:1', true);
    const written = updateDay1Transform(enabled, 'panelB', '1:1', {y: -8});

    expect(hasRatioOverride(day1(written).panelB, '1:1')).toBe(true);
    expect(day1(written).panelB.transforms.overrides['1:1']).toEqual({
      fit: 'contain',
      scale: 1.2,
      x: 0,
      y: -8,
    });
    // The base and the other ratio are untouched.
    expect(day1(written).panelB.transforms.base.y).toBe(0);
    expect(hasRatioOverride(day1(written).panelB, '9:16')).toBe(false);
  });

  it('drops the override without changing the base', () => {
    const enabled = setDay1RatioOverride(withPanels(), 'panelA', '16:9', true);
    const written = updateDay1Transform(enabled, 'panelA', '16:9', {scale: 1.9});
    const disabled = setDay1RatioOverride(written, 'panelA', '16:9', false);

    expect(hasRatioOverride(day1(disabled).panelA, '16:9')).toBe(false);
    expect(day1(disabled).panelA.transforms.base.scale).toBe(1);
  });

  it('clamps out of range framing and resets to the default', () => {
    const clamped = updateDay1Transform(withPanels(), 'panelA', '9:16', {
      scale: 99,
      x: -999,
    });

    expect(day1(clamped).panelA.transforms.base.scale).toBe(3);
    expect(day1(clamped).panelA.transforms.base.x).toBe(-50);
    expect(
      day1(resetDay1Transform(clamped, 'panelA', '9:16')).panelA.transforms.base,
    ).toEqual({fit: 'contain', scale: 1, x: 0, y: 0});
  });

  // day1-video — footage must never be cropped by something the operator did
  // not choose, so a panel opens lossless and an upload puts it back there.
  it('opens a panel on the lossless framing', () => {
    expect(day1(withPanels()).panelA.transforms.base).toEqual({
      fit: 'contain',
      scale: 1,
      x: 0,
      y: 0,
    });
  });

  it('resets the framing when a new source is uploaded', () => {
    const cropped = updateDay1Transform(withPanels(), 'panelA', '9:16', {
      fit: 'cover',
      scale: 2,
      y: 20,
    });
    const replaced = setDay1PanelSource(
      cropped,
      'panelA',
      testMediaReference({id: 'media_a2', durationMs: 9_000}),
    );

    expect(day1(replaced).panelA.transforms.base).toEqual({
      fit: 'contain',
      scale: 1,
      x: 0,
      y: 0,
    });
    // A relink is the path that keeps the edit.
    expect(
      day1(
        relinkDay1PanelSource(
          cropped,
          'panelA',
          testMediaReference({id: 'media_a', durationMs: 12_000}),
        ),
      ).panelA.transforms.base.fit,
    ).toBe('cover');
  });

  it('leaves the other panel alone', () => {
    const project = updateDay1Transform(withPanels(), 'panelA', '9:16', {scale: 2});

    expect(day1(project).panelB.transforms.base.scale).toBe(1);
  });
});

describe('Day1 split, labels, and end card', () => {
  it('takes a split colour and clamps the line width', () => {
    const project = updateDay1Split(withPanels(), {
      lineColor: '#38bdf8',
      lineWidthPx: 99,
    });

    expect(day1(project).split).toEqual({lineColor: '#38bdf8', lineWidthPx: 24});
    expect(parseProject(project).ok).toBe(true);
  });

  it('clamps the label font size and outline width', () => {
    const project = updateDay1LabelStyle(withPanels(), {
      fontSize: 999,
      outlineWidthPx: 99,
      position: 'center',
    });

    expect(day1(project).labelStyle.fontSize).toBe(120);
    expect(day1(project).labelStyle.outlineWidthPx).toBe(16);
    expect(day1(project).labelStyle.position).toBe('center');
  });

  it('patches the end card layers and presets', () => {
    const banner = testMediaReference({id: 'banner', kind: 'image'});
    const project = updateDay1EndCard(withPanels(), {
      banner,
      iconAnimation: 'glow',
      cardMotion: 'fade',
    });

    expect(day1(project).endCard.banner?.id).toBe('banner');
    expect(day1(project).endCard.appIcon).toBeNull();
    expect(day1(project).endCard.iconAnimation).toBe('glow');
    expect(day1(project).endCard.cardMotion).toBe('fade');
  });

  it('patches the icon nudge partially and clamps it (FR-D13)', () => {
    const nudged = updateDay1EndCard(withPanels(), {iconAdjust: {dx: 0.1}});
    const clamped = updateDay1EndCard(nudged, {iconAdjust: {dy: 9, scale: 9}});

    expect(day1(clamped).endCard.iconAdjust).toEqual({
      dx: 0.1,
      dy: 0.5,
      scale: 2,
    });
    expect(parseProject(clamped).ok).toBe(true);
  });

  // Endcard-Video Design §8.2 U-03..U-07.
  it('setting the end-card video resets its trim to the 3s window (U-03/U-04)', () => {
    const long = setDay1EndCardVideo(
      withPanels(),
      testMediaReference({id: 'ec-long', durationMs: 5000}),
    );
    const short = setDay1EndCardVideo(
      withPanels(),
      testMediaReference({id: 'ec-short', durationMs: 2000}),
    );

    expect(day1(long).endCard.videoTrim).toEqual({inMs: 0, outMs: 3000});
    // A source shorter than the card gets a window covering all of it; the
    // always-on loop fills the remainder (D-01).
    expect(day1(short).endCard.videoTrim).toEqual({inMs: 0, outMs: 2000});
    expect(parseProject(long).ok).toBe(true);
    expect(parseProject(short).ok).toBe(true);
  });

  it('moves the end-card trim window and clamps it inside the source (U-05)', () => {
    const base = setDay1EndCardVideo(
      withPanels(),
      testMediaReference({id: 'ec', durationMs: 5000}),
    );

    expect(
      day1(setDay1EndCardTrimInMs(base, 1000)).endCard.videoTrim,
    ).toEqual({inMs: 1000, outMs: 4000});
    // Same clamp the panels use: the window slides back to stay inside.
    expect(
      day1(setDay1EndCardTrimInMs(base, 4000)).endCard.videoTrim,
    ).toEqual({inMs: 2000, outMs: 5000});
  });

  // day1-trim-preview FR-05/FR-08 — the window length becomes adjustable so a
  // single cut of a multi-cut carousel can loop the 3s card (Plan SC1).
  it('adjusts the end-card window length within 0.5s–3s and the source', () => {
    const base = setDay1EndCardVideo(
      withPanels(),
      testMediaReference({id: 'ec', durationMs: 12_000}),
    );

    expect(
      day1(setDay1EndCardTrimLengthMs(base, 2000)).endCard.videoTrim,
    ).toEqual({inMs: 0, outMs: 2000});
    expect(
      day1(setDay1EndCardTrimLengthMs(base, 100)).endCard.videoTrim,
    ).toEqual({inMs: 0, outMs: 500});
    expect(
      day1(setDay1EndCardTrimLengthMs(base, 9000)).endCard.videoTrim,
    ).toEqual({inMs: 0, outMs: 3000});

    // A source shorter than the requested length caps the window at the source.
    const short = setDay1EndCardVideo(
      withPanels(),
      testMediaReference({id: 'ec-short', durationMs: 1500}),
    );

    expect(
      day1(setDay1EndCardTrimLengthMs(short, 3000)).endCard.videoTrim,
    ).toEqual({inMs: 0, outMs: 1500});
    expect(parseProject(setDay1EndCardTrimLengthMs(base, 2000)).ok).toBe(true);
  });

  // day1-quad Design §4.1 — the window used to be capped at the 3s constant, so
  // dragging the end card longer left the extra time unreachable: the operator
  // could only pick 3s and the rest was filled by looping. The cap is the end
  // card section's own length now.
  it('caps the end-card window at the section length, not at 3s', () => {
    const video = testMediaReference({id: 'ec', durationMs: 12_000});
    // 15s preset opens as [6000, 6000, 3000]; boundary 1 sits at 12_000ms.
    // Dragging it to 9000 leaves the end card 6s long.
    const longCard = setDay1EndCardVideo(
      moveTimelineBoundary(withPanels(), 1, 9000),
      video,
    );

    expect(longCard.sections.map((section) => section.durationMs)).toEqual([
      6000, 3000, 6000,
    ]);
    // Picking the video opens the window at the whole card, not 3s.
    expect(day1(longCard).endCard.videoTrim).toEqual({inMs: 0, outMs: 6000});
    // A 6s window is now reachable, and 9s still clamps — to the card, not to 3s.
    expect(
      day1(setDay1EndCardTrimLengthMs(longCard, 6000)).endCard.videoTrim,
    ).toEqual({inMs: 0, outMs: 6000});
    expect(
      day1(setDay1EndCardTrimLengthMs(longCard, 9000)).endCard.videoTrim,
    ).toEqual({inMs: 0, outMs: 6000});
    expect(parseProject(longCard).ok).toBe(true);

    // Shrinking the card shrinks the cap the same way.
    const shortCard = setDay1EndCardVideo(
      moveTimelineBoundary(withPanels(), 1, 13_000),
      video,
    );

    expect(shortCard.sections[2]?.durationMs).toBe(2000);
    expect(
      day1(setDay1EndCardTrimLengthMs(shortCard, 3000)).endCard.videoTrim,
    ).toEqual({inMs: 0, outMs: 2000});
  });

  it('keeps the in point on length changes and the length on moves (FR-05)', () => {
    const base = setDay1EndCardVideo(
      withPanels(),
      testMediaReference({id: 'ec', durationMs: 12_000}),
    );
    const moved = setDay1EndCardTrimInMs(base, 4000);

    expect(
      day1(setDay1EndCardTrimLengthMs(moved, 1000)).endCard.videoTrim,
    ).toEqual({inMs: 4000, outMs: 5000});

    const two = setDay1EndCardTrimLengthMs(base, 2000);

    expect(day1(setDay1EndCardTrimInMs(two, 3000)).endCard.videoTrim).toEqual({
      inMs: 3000,
      outMs: 5000,
    });
    // The same clamp the panels use, at the chosen length instead of 3s.
    expect(
      day1(setDay1EndCardTrimInMs(two, 11_500)).endCard.videoTrim,
    ).toEqual({inMs: 10_000, outMs: 12_000});
  });

  // day1-endcard-audio Plan SC2 — audio settings ride the existing patch
  // command, with the same clamp treatment as iconAdjust.
  it('patches the end-card audio toggle and clamps its volume', () => {
    const base = withPanels();

    expect(
      day1(updateDay1EndCard(base, {videoAudioEnabled: false})).endCard
        .videoAudioEnabled,
    ).toBe(false);
    expect(
      day1(updateDay1EndCard(base, {videoAudioVolume: 5})).endCard
        .videoAudioVolume,
    ).toBe(1);
    expect(
      day1(updateDay1EndCard(base, {videoAudioVolume: -1})).endCard
        .videoAudioVolume,
    ).toBe(0);
    expect(
      day1(updateDay1EndCard(base, {videoAudioVolume: 0.4})).endCard
        .videoAudioVolume,
    ).toBe(0.4);
  });

  it('keeps the other treatment intact across mode switches (U-07 / SC1)', () => {
    const banner = testMediaReference({id: 'banner', kind: 'image'});
    const video = testMediaReference({id: 'ec', durationMs: 5000});

    let project = updateDay1EndCard(withPanels(), {
      banner,
      iconAdjust: {dx: 0.1},
    });

    project = setDay1EndCardVideo(project, video);
    project = updateDay1EndCard(project, {mode: 'video'});
    project = updateDay1EndCard(project, {mode: 'banner'});

    // Nothing was erased on the way there and back.
    expect(day1(project).endCard.banner?.id).toBe('banner');
    expect(day1(project).endCard.iconAdjust.dx).toBe(0.1);
    expect(day1(project).endCard.video?.id).toBe('ec');
    expect(day1(project).endCard.videoTrim).toEqual({inMs: 0, outMs: 3000});
    expect(day1(project).endCard.mode).toBe('banner');
    expect(parseProject(project).ok).toBe(true);
  });

  it('writes panel labels per locale (FR-D09)', () => {
    const ko = setDay1LabelText(withPanels(), 'ko', 'a', 'DAY 1');
    const both = setDay1LabelText(ko, 'ko', 'b', 'DAY 30');
    const en = setDay1LabelText(both, 'en', 'a', 'Day 1');

    expect((en.copy.ko as LocalizedCopy).day1Labels).toEqual({
      a: 'DAY 1',
      b: 'DAY 30',
    });
    expect((en.copy.en as LocalizedCopy).day1Labels).toEqual({a: 'Day 1', b: ''});
    expect(parseProject(en).ok).toBe(true);
  });
});

describe('template isolation', () => {
  it('leaves a three-scene project untouched', () => {
    const project = createProject();

    // `setDay1PanelSource` runs the shared reconcile pass, which rebuilds the
    // three-scene payload, so this one is compared by value rather than identity.
    expect(
      setDay1PanelSource(project, 'panelA', testMediaReference()),
    ).toStrictEqual(project);
    expect(setDay1TrimInMs(project, 'panelA', 1000)).toBe(project);
    expect(setDay1TrimOutMs(project, 'panelA', 1000)).toBe(project);
    expect(updateDay1Transform(project, 'panelA', '9:16', {scale: 2})).toBe(
      project,
    );
    expect(setDay1RatioOverride(project, 'panelA', '9:16', true)).toBe(project);
    expect(updateDay1Split(project, {lineWidthPx: 2})).toBe(project);
    expect(updateDay1LabelStyle(project, {fontSize: 80})).toBe(project);
    expect(updateDay1EndCard(project, {iconAnimation: 'none'})).toBe(project);
    expect(day1Of(project)).toBeNull();
  });

  it('leaves a Day1 project untouched by three-scene commands', () => {
    const project = day1ProjectFixture();

    expect(threeSceneOf(project)).toBeNull();
    expect(day1Of(project)).not.toBeNull();
  });
});

// day1-quad Design §5.4, §4.4 — the switch into the four-panel template.
describe('switchTemplate to day1-quad', () => {
  it('builds the five-section axis and the four-panel payload', () => {
    const project = switchTemplate(createProject(), 'day1-quad');

    expect(project.sections.map((section) => section.id)).toEqual([
      ...DAY1_QUAD_SECTION_ORDER,
    ]);
    expect(project.sections.map((section) => section.durationMs)).toEqual([
      3000, 3000, 3000, 3000, 3000,
    ]);

    const settings = day1QuadOf(project);

    expect(settings).not.toBeNull();
    expect(day1Of(project)).toBeNull();
    // Plan Q6 — four panels, all of them empty until the operator uploads.
    expect([
      settings?.panelA.source,
      settings?.panelB.source,
      settings?.panelC.source,
      settings?.panelD.source,
    ]).toEqual([null, null, null, null]);
    // Plan Q4 — uploads still start lossless, exactly as Day1 does.
    expect(settings?.panelA.transforms.base).toEqual(
      DEFAULT_DAY1_PANEL_TRANSFORM,
    );
    // Design §5.4 — the one value that differs from Day1: a quad cell is half
    // as wide, so 72px would overflow it.
    expect(settings?.labelStyle.fontSize).toBe(44);
    expect(parseProject(project).ok).toBe(true);
  });

  it('fills the panel labels in every locale (Q9)', () => {
    const project = switchTemplate(createProject(), 'day1-quad');

    for (const locale of ['ko', 'en', 'ja', 'zh-TW'] as const) {
      expect((project.copy[locale] as LocalizedCopy).day1Labels).toEqual({
        a: 'Day1',
        b: 'Day2',
        c: 'Day3',
        d: 'Day7',
      });
    }
  });

  // Plan Q8a — 60s over four panels is 14.25s each, so the template does not
  // offer it and a 60s project is coerced rather than left invalid.
  it('coerces a 60s project to 30s on the way in', () => {
    const sixty = switchTemplate(createProject(60), 'day1-quad');

    expect(sixty.durationPreset).toBe(30);
    expect(sixty.sections.map((section) => section.durationMs)).toEqual([
      6750, 6750, 6750, 6750, 3000,
    ]);
    expect(parseProject(sixty).ok).toBe(true);

    // 15s and 30s pass through untouched.
    expect(switchTemplate(createProject(15), 'day1-quad').durationPreset).toBe(15);
    expect(switchTemplate(createProject(30), 'day1-quad').durationPreset).toBe(30);
  });

  it('leaves Day1 labels empty — Q10 keeps the two-panel template unchanged', () => {
    const day1Project = switchTemplate(createProject(), 'day1');

    expect(
      (day1Project.copy.ko as LocalizedCopy).day1Labels,
    ).toBeUndefined();
  });
});

// day1-quad Design §5.5 — one command set for both templates, keyed by panel.
describe('Day1 commands over four panels', () => {
  const quadWithPanels = (): EditorProject =>
    panelKeysOf(day1QuadProjectFixture().templateSettings).reduce(
      (project, key, index) =>
        setDay1PanelSource(
          project,
          key,
          testMediaReference({id: `media_${index}`, durationMs: 12_000}),
        ),
      day1QuadProjectFixture(),
    );

  it('sets each of the four panels independently', () => {
    const project = quadWithPanels();
    const settings = day1QuadSettingsOf(project);

    expect([
      settings.panelA.source?.id,
      settings.panelB.source?.id,
      settings.panelC.source?.id,
      settings.panelD.source?.id,
    ]).toEqual(['media_0', 'media_1', 'media_2', 'media_3']);
    expect(parseProject(project).ok).toBe(true);
  });

  it('clamps each panel trim to its own section', () => {
    // 15s quad: every panel section is 3s, so a 12s source yields a 3s window.
    const project = quadWithPanels();

    panelKeysOf(project.templateSettings).forEach((key) => {
      expect(day1PanelAt(project, key)?.trim).toEqual({inMs: 0, outMs: 3000});
    });
  });

  it('reports all four as missing until each is uploaded (Q6)', () => {
    const empty = day1QuadProjectFixture();

    expect(day1MissingPanels(empty)).toEqual([
      'panelA',
      'panelB',
      'panelC',
      'panelD',
    ]);
    expect(day1MissingPanels(quadWithPanels())).toEqual([]);
  });

  it('reports a quad panel whose source cannot fill its section', () => {
    const short = setDay1PanelSource(
      quadWithPanels(),
      'panelC',
      testMediaReference({id: 'short', durationMs: 1500}),
    );

    expect(day1PanelsShorterThanSection(short)).toEqual(['panelC']);
  });

  // The no-op contract: a Day1 payload simply has no panelC.
  it('no-ops a panelC command on a two-panel Day1 project', () => {
    const day1Project = day1ProjectFixture();
    const after = setDay1PanelSource(
      day1Project,
      'panelC',
      testMediaReference({id: 'ignored', durationMs: 9000}),
    );

    // `setDay1PanelSource` still runs the reconcilers, so this is value
    // equality rather than reference equality — nothing about the project moved.
    expect(after).toEqual(day1Project);
    expect(day1PanelAt(day1Project, 'panelC')).toBeNull();
    expect(panelKeysOf(day1Project.templateSettings)).toEqual([
      'panelA',
      'panelB',
    ]);
  });

  it('returns no panel keys for templates that have none', () => {
    expect(panelKeysOf(createProject().templateSettings)).toEqual([]);
  });

  it('moves a quad panel trim and reframes it like a Day1 panel', () => {
    const project = setDay1TrimInMs(quadWithPanels(), 'panelD', 2000);

    expect(day1PanelAt(project, 'panelD')?.trim).toEqual({
      inMs: 2000,
      outMs: 5000,
    });

    const framed = updateDay1Transform(project, 'panelD', '9:16', {scale: 1.4});

    expect(day1PanelAt(framed, 'panelD')?.transforms.base.scale).toBe(1.4);
    expect(day1PanelAt(framed, 'panelA')?.transforms.base.scale).toBe(1);
    expect(parseProject(framed).ok).toBe(true);
  });

  it('writes labels into the c and d slots', () => {
    const project = setDay1LabelText(
      day1QuadProjectFixture(),
      'ko',
      'd',
      'DAY 30',
    );

    expect((project.copy.ko as LocalizedCopy).day1Labels).toEqual({
      a: 'Day1',
      b: 'Day2',
      c: 'Day3',
      d: 'DAY 30',
    });
    expect(parseProject(project).ok).toBe(true);
  });
});

// day1-quad Design §5.5 regression — the shared-field commands (split, label
// style, the end card and its trims) read `day1Of` when the quad template
// shipped, so on a quad project every one of them returned the project
// unchanged: the split colour would not take, and the end card could not even
// switch to video mode. Each test below fails against that guard.
describe('shared-field commands on the four-panel template', () => {
  it('takes a split colour and width on a quad project', () => {
    const project = updateDay1Split(day1QuadProjectFixture(), {
      lineColor: '#ff00ff',
      lineWidthPx: 10,
    });

    expect(day1QuadSettingsOf(project).split).toEqual({
      lineColor: '#ff00ff',
      lineWidthPx: 10,
    });
    expect(parseProject(project).ok).toBe(true);
  });

  it('takes a label style patch on a quad project', () => {
    const project = updateDay1LabelStyle(day1QuadProjectFixture(), {
      position: 'center',
      fontSize: 60,
    });

    expect(day1QuadSettingsOf(project).labelStyle.position).toBe('center');
    expect(day1QuadSettingsOf(project).labelStyle.fontSize).toBe(60);
  });

  it('switches the end card to video mode on a quad project', () => {
    const project = updateDay1EndCard(day1QuadProjectFixture(), {mode: 'video'});

    expect(day1QuadSettingsOf(project).endCard.mode).toBe('video');
  });

  it('sets the end card video and its trim on a quad project', () => {
    const reference = testMediaReference({id: 'card', durationMs: 8_000});
    const withVideo = setDay1EndCardVideo(day1QuadProjectFixture(), reference);

    expect(day1QuadSettingsOf(withVideo).endCard.video?.id).toBe('card');

    const moved = setDay1EndCardTrimInMs(withVideo, 2_000);

    expect(day1QuadSettingsOf(moved).endCard.videoTrim.inMs).toBe(2_000);

    const sized = setDay1EndCardTrimLengthMs(moved, 1_000);
    const trim = day1QuadSettingsOf(sized).endCard.videoTrim;

    expect(trim.outMs - trim.inMs).toBe(1_000);
    expect(parseProject(sized).ok).toBe(true);
  });
});
