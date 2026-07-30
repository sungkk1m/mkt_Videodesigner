// Day1 Design Ref: §6.1 template switch, §6.3 inspector commands.
import {describe, expect, it} from 'vitest';

import {
  DEFAULT_DAY1_SETTINGS,
  applyDurationPreset,
  createProject,
  day1MissingPanels,
  day1Of,
  hasRatioOverride,
  moveTimelineBoundary,
  parseProject,
  relinkDay1PanelSource,
  resetDay1Transform,
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
import {day1ProjectFixture, day1SettingsOf} from '../../test/fixtures/project';
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
      fit: 'cover',
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
      fit: 'cover',
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
    ).toEqual({fit: 'cover', scale: 1, x: 0, y: 0});
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
