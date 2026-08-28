// failure-video Design §8.1 — the template switch, the defaults, and the
// commands the failure payload shares with the panelled templates.
import {describe, expect, it} from 'vitest';

import {
  DEFAULT_FAILURE_SETTINGS,
  applyDurationPreset,
  createProject,
  day1Of,
  day1PanelsOf,
  day1QuadOf,
  endCardSettingsOf,
  failureMissingPanels,
  failureOf,
  failurePanelAt,
  failurePanelsShorterThanSection,
  moveTimelineBoundary,
  panelKeysOf,
  parseProject,
  relinkFailurePanelSource,
  resetFailureTransform,
  setDay1EndCardTrimInMs,
  setDay1EndCardTrimLengthMs,
  setDay1EndCardVideo,
  setDay1PanelSource,
  setDay1TrimInMs,
  setFailureLabelText,
  setFailurePanelSource,
  setFailurePanelSourceStatus,
  setFailureRatioOverride,
  setFailureTrimInMs,
  setFailureTrimOutMs,
  setSelectedRatio,
  switchTemplate,
  threeSceneOf,
  toggleRenderRatio,
  updateDay1EndCard,
  updateDay1LabelStyle,
  updateDay1Split,
  updateFailureCaption,
  updateFailureFail,
  updateFailureTransform,
} from './project';
import {testMediaReference} from '../../test/fixtures/media';
import {
  DEFAULT_DAY1_PANEL_TRANSFORM,
  FAILURE_SECTION_ORDER,
  MAX_CAPTION_FONT_SIZE,
  MAX_OFFSET_PERCENT,
} from './types';
import {
  day1ProjectFixture,
  day1QuadProjectFixture,
  failureProjectFixture,
  failureSettingsOf,
  kvLoopProjectFixture,
} from '../../test/fixtures/project';
import type {EditorProject, LocalizedCopy} from './types';

describe('switchTemplate to failure', () => {
  it('builds the four-section axis and the two-orientation payload', () => {
    const project = switchTemplate(createProject(30), 'failure');

    expect(project.sections.map((section) => section.id)).toEqual([
      ...FAILURE_SECTION_ORDER,
    ]);
    expect(project.sections.map((section) => section.label)).toEqual([
      '레벨 1',
      '레벨 20',
      '레벨 99',
      '엔드카드',
    ]);
    expect(project.sections.map((section) => section.durationMs)).toEqual([
      5400, 2700, 18_900, 3000,
    ]);

    const settings = failureOf(project);

    expect(settings).not.toBeNull();
    expect(day1Of(project)).toBeNull();
    expect(day1QuadOf(project)).toBeNull();
    // Plan Q2 — six empty slots, three per orientation.
    expect([
      settings?.vertical.panelA.source,
      settings?.vertical.panelB.source,
      settings?.vertical.panelC.source,
      settings?.horizontal.panelA.source,
      settings?.horizontal.panelB.source,
      settings?.horizontal.panelC.source,
    ]).toEqual([null, null, null, null, null, null]);
    // Design §5.5 — an upload still starts lossless, as in every panelled
    // template. The reference's width-filling crop is one `cover` click away.
    expect(settings?.vertical.panelA.transforms.base).toEqual(
      DEFAULT_DAY1_PANEL_TRANSFORM,
    );
    expect(parseProject(project).ok).toBe(true);
  });

  it('carries the measured caption and FAIL defaults', () => {
    const settings = failureSettingsOf(switchTemplate(createProject(30), 'failure'));

    expect(settings.caption).toEqual({
      fontSize: 100,
      textColor: '#ffffff',
      barColor: '#000000',
    });
    // Plan D-5 — every element on, so a new project reproduces the reference.
    expect(settings.fail).toEqual({
      stampEnabled: true,
      zoomEnabled: true,
      desaturateEnabled: true,
      shakeEnabled: true,
      sfxEnabled: true,
      focusX: 0,
      focusY: 0,
    });
  });

  it('fills the caption text in every locale (Q1)', () => {
    const project = switchTemplate(createProject(30), 'failure');

    for (const locale of ['ko', 'en', 'ja', 'zh-TW'] as const) {
      expect((project.copy[locale] as LocalizedCopy).failureLabels).toEqual({
        a: 'LEVEL 1',
        b: 'LEVEL 20',
        c: 'LEVEL 99',
      });
    }
  });

  // Plan Q4 / Design §4.3 — the preset half of the three-point set.
  it('coerces a 15s project to 30s and leaves 30/60 alone', () => {
    const fifteen = switchTemplate(createProject(15), 'failure');

    expect(fifteen.durationPreset).toBe(30);
    expect(fifteen.sections.map((section) => section.durationMs)).toEqual([
      5400, 2700, 18_900, 3000,
    ]);
    expect(parseProject(fifteen).ok).toBe(true);

    expect(switchTemplate(createProject(30), 'failure').durationPreset).toBe(30);
    expect(switchTemplate(createProject(60), 'failure').durationPreset).toBe(60);
  });

  // Plan Q2 / Design §4.3 — the ratio half of the same set.
  it('drops 1:1 from the batch selection and from the preview ratio', () => {
    const base = createProject(30);
    const project = switchTemplate(
      {
        ...base,
        selectedRatio: '1:1',
        render: {...base.render, selectedRatios: ['9:16', '1:1', '16:9']},
      },
      'failure',
    );

    expect(project.render.selectedRatios).toEqual(['9:16', '16:9']);
    expect(project.selectedRatio).toBe('9:16');
    expect(parseProject(project).ok).toBe(true);
  });

  // `renderSettingsSchema` requires at least one ratio, so a 1:1-only batch
  // cannot simply be filtered down to nothing.
  it('falls back to 9:16 when the batch held 1:1 alone', () => {
    const base = createProject(30);
    const project = switchTemplate(
      {
        ...base,
        selectedRatio: '1:1',
        render: {...base.render, selectedRatios: ['1:1']},
      },
      'failure',
    );

    expect(project.render.selectedRatios).toEqual(['9:16']);
    expect(parseProject(project).ok).toBe(true);
  });

  it('keeps a 16:9-only batch selection intact', () => {
    const base = createProject(60);
    const project = switchTemplate(
      {
        ...base,
        selectedRatio: '16:9',
        render: {...base.render, selectedRatios: ['16:9']},
      },
      'failure',
    );

    expect(project.render.selectedRatios).toEqual(['16:9']);
    expect(project.selectedRatio).toBe('16:9');
    expect(parseProject(project).ok).toBe(true);
  });
});

// The arm the quad's comment warns about: without it the preset switch falls
// through to the three-scene lengths and the last sections become NaN.
describe('applyDurationPreset on the failure template', () => {
  it('resizes 30s → 60s to four finite sections totalling the preset', () => {
    const project = applyDurationPreset(failureProjectFixture(), 60);

    expect(project.sections.map((section) => section.durationMs)).toEqual([
      11_400, 5700, 39_900, 3000,
    ]);
    expect(project.durationPreset).toBe(60);
    expect(parseProject(project).ok).toBe(true);
  });

  it('resizes back 60s → 30s', () => {
    const sixty = applyDurationPreset(failureProjectFixture(), 60);
    const project = applyDurationPreset(sixty, 30);

    expect(project.sections.map((section) => section.durationMs)).toEqual([
      5400, 2700, 18_900, 3000,
    ]);
    expect(parseProject(project).ok).toBe(true);
  });
});

// Design §4.1-3 / D-2 — the four end-card commands were rewired to
// `endCardSettingsOf`, so they have to reach the failure payload while the
// panel and split commands, which stayed on `day1PanelsOf`, must not.
describe('end-card commands shared with the failure payload', () => {
  it('narrows every end-card owner and nothing else', () => {
    expect(endCardSettingsOf(day1ProjectFixture())).not.toBeNull();
    expect(endCardSettingsOf(day1QuadProjectFixture())).not.toBeNull();
    expect(endCardSettingsOf(failureProjectFixture())).not.toBeNull();
    expect(endCardSettingsOf(createProject(15))).toBeNull();
    expect(endCardSettingsOf(kvLoopProjectFixture())).toBeNull();
  });

  it('switches the failure end card to video mode and sets its source', () => {
    const mode = updateDay1EndCard(failureProjectFixture(), {mode: 'video'});

    expect(failureSettingsOf(mode).endCard.mode).toBe('video');

    const project = setDay1EndCardVideo(
      mode,
      testMediaReference({id: 'media_endcard', durationMs: 10_000}),
    );
    const {endCard} = failureSettingsOf(project);

    expect(endCard.video?.id).toBe('media_endcard');
    // The window opens at the card's own 3s section, reconciled like Day1's.
    expect(endCard.videoTrim).toEqual({inMs: 0, outMs: 3000});
    expect(parseProject(project).ok).toBe(true);
  });

  it('moves the failure end-card trim through the reconciling commands', () => {
    const withVideo = setDay1EndCardVideo(
      updateDay1EndCard(failureProjectFixture(), {mode: 'video'}),
      testMediaReference({id: 'media_endcard', durationMs: 10_000}),
    );
    const shortened = setDay1EndCardTrimLengthMs(withVideo, 1500);

    expect(failureSettingsOf(shortened).endCard.videoTrim).toEqual({
      inMs: 0,
      outMs: 1500,
    });

    const moved = setDay1EndCardTrimInMs(shortened, 4000);

    expect(failureSettingsOf(moved).endCard.videoTrim).toEqual({
      inMs: 4000,
      outMs: 5500,
    });
    expect(parseProject(moved).ok).toBe(true);
  });
});

// Design §5.6 — the segment commands, over the orientation axis.
describe('failure segment commands', () => {
  const withSource = (
    project: EditorProject,
    orientation: 'vertical' | 'horizontal',
    key: 'panelA' | 'panelB' | 'panelC',
    durationMs = 30_000,
  ) =>
    setFailurePanelSource(
      project,
      orientation,
      key,
      testMediaReference({id: `${orientation}_${key}`, durationMs}),
    );

  it('writes one orientation without touching the other', () => {
    const project = withSource(failureProjectFixture(), 'vertical', 'panelB');
    const settings = failureSettingsOf(project);

    expect(settings.vertical.panelB.source?.id).toBe('vertical_panelB');
    expect(settings.vertical.panelA.source).toBeNull();
    expect(settings.horizontal.panelB.source).toBeNull();
    expect(settings.horizontal).toEqual(
      failureSettingsOf(failureProjectFixture()).horizontal,
    );
    expect(parseProject(project).ok).toBe(true);
  });

  it('holds both orientations of the same segment at once', () => {
    const both = withSource(
      withSource(failureProjectFixture(), 'vertical', 'panelA'),
      'horizontal',
      'panelA',
    );
    const settings = failureSettingsOf(both);

    expect(settings.vertical.panelA.source?.id).toBe('vertical_panelA');
    expect(settings.horizontal.panelA.source?.id).toBe('horizontal_panelA');
  });

  it('opens a new source on the whole section, lossless', () => {
    const project = withSource(failureProjectFixture(), 'vertical', 'panelA');
    const panel = failurePanelAt(project, 'vertical', 'panelA');

    // Section 0 of the 30s preset is 5.4s, and the source is longer.
    expect(panel?.trim).toEqual({inMs: 0, outMs: 5400});
    expect(panel?.transforms.base).toEqual(DEFAULT_DAY1_PANEL_TRANSFORM);
  });

  it('resets the trim and framing on a new source, but not on a relink', () => {
    const framed = updateFailureTransform(
      setFailureTrimInMs(
        withSource(failureProjectFixture(), 'vertical', 'panelA'),
        'vertical',
        'panelA',
        4000,
      ),
      'vertical',
      'panelA',
      '9:16',
      {fit: 'cover', scale: 1.5},
    );

    expect(failurePanelAt(framed, 'vertical', 'panelA')?.trim.inMs).toBe(4000);

    const relinked = relinkFailurePanelSource(
      framed,
      'vertical',
      'panelA',
      testMediaReference({id: 'vertical_panelA', durationMs: 30_000}),
    );

    expect(failurePanelAt(relinked, 'vertical', 'panelA')?.trim.inMs).toBe(4000);
    expect(
      failurePanelAt(relinked, 'vertical', 'panelA')?.transforms.base.scale,
    ).toBe(1.5);

    const replaced = withSource(framed, 'vertical', 'panelA');

    expect(failurePanelAt(replaced, 'vertical', 'panelA')?.trim.inMs).toBe(0);
    expect(
      failurePanelAt(replaced, 'vertical', 'panelA')?.transforms.base,
    ).toEqual(DEFAULT_DAY1_PANEL_TRANSFORM);
  });

  it('keeps the trim window inside the source and as long as the section', () => {
    const project = withSource(
      failureProjectFixture(),
      'vertical',
      'panelC',
      20_000,
    );
    // Section 2 of the 30s preset is 18.9s, so a 20s source leaves 1.1s of slack.
    const late = setFailureTrimInMs(project, 'vertical', 'panelC', 999_999);

    expect(failurePanelAt(late, 'vertical', 'panelC')?.trim).toEqual({
      inMs: 1100,
      outMs: 20_000,
    });

    const fromEnd = setFailureTrimOutMs(project, 'vertical', 'panelC', 19_000);

    expect(failurePanelAt(fromEnd, 'vertical', 'panelC')?.trim).toEqual({
      inMs: 100,
      outMs: 19_000,
    });
  });

  it('reframes and resets one slot at a time', () => {
    const project = updateFailureTransform(
      withSource(failureProjectFixture(), 'horizontal', 'panelB'),
      'horizontal',
      'panelB',
      '16:9',
      {fit: 'cover', scale: 2, x: 10},
    );

    expect(
      failurePanelAt(project, 'horizontal', 'panelB')?.transforms.base,
    ).toEqual({fit: 'cover', scale: 2, x: 10, y: 0});
    expect(
      failurePanelAt(project, 'vertical', 'panelB')?.transforms.base,
    ).toEqual(DEFAULT_DAY1_PANEL_TRANSFORM);

    const reset = resetFailureTransform(project, 'horizontal', 'panelB', '16:9');

    expect(
      failurePanelAt(reset, 'horizontal', 'panelB')?.transforms.base,
    ).toEqual(DEFAULT_DAY1_PANEL_TRANSFORM);
  });

  it('seeds a ratio override from what is on screen, and clears it', () => {
    const framed = updateFailureTransform(
      withSource(failureProjectFixture(), 'vertical', 'panelA'),
      'vertical',
      'panelA',
      '9:16',
      {scale: 1.4},
    );
    const on = setFailureRatioOverride(
      framed,
      'vertical',
      'panelA',
      '9:16',
      true,
    );

    expect(
      failurePanelAt(on, 'vertical', 'panelA')?.transforms.overrides['9:16'],
    ).toMatchObject({scale: 1.4});

    const off = setFailureRatioOverride(on, 'vertical', 'panelA', '9:16', false);

    expect(
      failurePanelAt(off, 'vertical', 'panelA')?.transforms.overrides['9:16'],
    ).toBeUndefined();
    expect(parseProject(off).ok).toBe(true);
  });

  it('carries a source status change without disturbing the edit', () => {
    const project = setFailurePanelSourceStatus(
      withSource(failureProjectFixture(), 'vertical', 'panelA'),
      'vertical',
      'panelA',
      'missing',
    );

    expect(failurePanelAt(project, 'vertical', 'panelA')?.source?.status).toBe(
      'missing',
    );
  });

  it('clamps the caption style and the FAIL focus', () => {
    const caption = updateFailureCaption(failureProjectFixture(), {
      fontSize: 9999,
      textColor: '#ff0000',
    });

    expect(failureSettingsOf(caption).caption).toEqual({
      fontSize: MAX_CAPTION_FONT_SIZE,
      textColor: '#ff0000',
      barColor: '#000000',
    });

    const fail = updateFailureFail(failureProjectFixture(), {
      stampEnabled: false,
      focusX: -300,
      focusY: 300,
    });

    expect(failureSettingsOf(fail).fail).toMatchObject({
      stampEnabled: false,
      zoomEnabled: true,
      focusX: -MAX_OFFSET_PERCENT,
      focusY: MAX_OFFSET_PERCENT,
    });
    expect(parseProject(fail).ok).toBe(true);
  });

  it('edits a caption locale at a time', () => {
    const project = setFailureLabelText(
      failureProjectFixture(),
      'en',
      'b',
      'LEVEL 25',
    );

    expect((project.copy.en as LocalizedCopy).failureLabels).toEqual({
      a: 'LEVEL 1',
      b: 'LEVEL 25',
      c: 'LEVEL 99',
    });
    expect((project.copy.ko as LocalizedCopy).failureLabels?.b).toBe('LEVEL 20');
    expect(parseProject(project).ok).toBe(true);
  });

  it('no-ops on a foreign template', () => {
    const day1 = day1ProjectFixture();

    // `setFailurePanelSource` runs the shared reconcile pass, which rebuilds
    // the Day1 payload, so this one is compared by value rather than identity —
    // exactly as the Day1 command is against a three-scene project.
    expect(
      setFailurePanelSource(day1, 'vertical', 'panelA', testMediaReference()),
    ).toStrictEqual(day1);
    expect(setFailureTrimInMs(day1, 'vertical', 'panelA', 1000)).toBe(day1);
    expect(updateFailureCaption(day1, {fontSize: 40})).toBe(day1);
    expect(updateFailureFail(day1, {stampEnabled: false})).toBe(day1);
    expect(failurePanelAt(day1, 'vertical', 'panelA')).toBeNull();
  });
});

// Design §5.6 — a boundary drag has to re-clamp both orientations, not just the
// one on screen: the other group's sources render the other ratio, and a window
// left pointing past a shortened section would only surface at render time.
describe('reconcileFailureTrims', () => {
  it('re-clamps all six segments after a boundary move', () => {
    const seeded = (['vertical', 'horizontal'] as const).reduce(
      (project, orientation) =>
        (['panelA', 'panelB', 'panelC'] as const).reduce(
          (current, key) =>
            setFailurePanelSource(
              current,
              orientation,
              key,
              testMediaReference({
                id: `${orientation}_${key}`,
                durationMs: 30_000,
              }),
            ),
          project,
        ),
      failureProjectFixture(),
    );

    expect(failurePanelAt(seeded, 'vertical', 'panelA')?.trim.outMs).toBe(5400);
    expect(failurePanelAt(seeded, 'horizontal', 'panelA')?.trim.outMs).toBe(5400);

    // Drag the level-1 / level-20 boundary back to 2s.
    const moved = moveTimelineBoundary(seeded, 0, 2000);

    expect(moved.sections[0]?.durationMs).toBe(2000);
    expect(failurePanelAt(moved, 'vertical', 'panelA')?.trim.outMs).toBe(2000);
    expect(failurePanelAt(moved, 'horizontal', 'panelA')?.trim.outMs).toBe(2000);
    // The segment on the other side of the boundary grew, and follows too.
    expect(failurePanelAt(moved, 'vertical', 'panelB')?.trim.outMs).toBe(
      moved.sections[1]?.durationMs,
    );
    expect(parseProject(moved).ok).toBe(true);
  });
});

// Design §7.5 / Plan Q2 — the preflight asks per ratio, so a vertical-only
// batch never demands horizontal footage and adding 16:9 to it does.
describe('failure render preflight', () => {
  const verticalOnly = () =>
    (['panelA', 'panelB', 'panelC'] as const).reduce(
      (project, key) =>
        setFailurePanelSource(
          project,
          'vertical',
          key,
          testMediaReference({id: `vertical_${key}`, durationMs: 30_000}),
        ),
      failureProjectFixture(),
    );

  it('passes a 9:16-only render with the vertical group filled', () => {
    expect(failureMissingPanels(verticalOnly(), ['9:16'])).toEqual([]);
  });

  it('blocks the moment 16:9 joins the batch', () => {
    const missing = failureMissingPanels(verticalOnly(), ['9:16', '16:9']);

    expect(missing).toEqual([
      {orientation: 'horizontal', key: 'panelA'},
      {orientation: 'horizontal', key: 'panelB'},
      {orientation: 'horizontal', key: 'panelC'},
    ]);
  });

  it('names every empty slot of an untouched project', () => {
    expect(failureMissingPanels(failureProjectFixture(), ['9:16'])).toHaveLength(
      3,
    );
    expect(failureMissingPanels(failureProjectFixture(), [])).toEqual([]);
  });

  it('reports a source that cannot fill its section, and only once', () => {
    const short = setFailurePanelSource(
      verticalOnly(),
      'vertical',
      'panelC',
      testMediaReference({id: 'vertical_panelC', durationMs: 5000}),
    );

    // Section 2 of the 30s preset is 18.9s.
    expect(failurePanelsShorterThanSection(short, ['9:16'])).toEqual([
      {orientation: 'vertical', key: 'panelC'},
    ]);
    // An empty slot belongs to `failureMissingPanels`, not to this list.
    expect(
      failurePanelsShorterThanSection(failureProjectFixture(), ['9:16']),
    ).toEqual([]);
  });

  it('returns nothing at all on a foreign template', () => {
    expect(failureMissingPanels(day1ProjectFixture(), ['9:16'])).toEqual([]);
    expect(
      failurePanelsShorterThanSection(day1ProjectFixture(), ['9:16']),
    ).toEqual([]);
  });
});

describe('template isolation — failure', () => {
  it('has no Day1 panel keys, so every Day1 panel command no-ops', () => {
    const project = failureProjectFixture();

    expect(panelKeysOf(project.templateSettings)).toEqual([]);
    expect(day1PanelsOf(project)).toBeNull();
    expect(threeSceneOf(project)).toBeNull();

    expect(
      setDay1PanelSource(project, 'panelA', testMediaReference()),
    ).toStrictEqual(project);
    expect(setDay1TrimInMs(project, 'panelA', 1000)).toBe(project);
    // Split and label style are Day1 fields the failure payload does not have.
    expect(updateDay1Split(project, {lineWidthPx: 2})).toBe(project);
    expect(updateDay1LabelStyle(project, {fontSize: 80})).toBe(project);
  });

  it('leaves the other templates untouched by an end-card command', () => {
    const project: EditorProject = createProject(15);

    expect(updateDay1EndCard(project, {mode: 'video'})).toBe(project);
    expect(failureOf(project)).toBeNull();
  });

  it('keeps DEFAULT_FAILURE_SETTINGS from sharing state between projects', () => {
    const first = switchTemplate(createProject(30), 'failure');
    const second = switchTemplate(createProject(30), 'failure');

    expect(failureSettingsOf(first).endCard).not.toBe(
      DEFAULT_FAILURE_SETTINGS.endCard,
    );
    expect(failureSettingsOf(first).vertical).not.toBe(
      failureSettingsOf(second).vertical,
    );
  });
});

/**
 * The bug the ratio narrowing introduced, and the rule that closes it.
 *
 * `refineFailure` rejects a project whose ratios include 1:1, but
 * `toggleRenderRatio` and `setSelectedRatio` were template-agnostic — so the
 * Batch dialog could put one there. The document autosaved, failed to parse on
 * the next load, and the editor opened an empty three-scene project instead:
 * the operator's work was gone with nothing said. The looping template had the
 * same hole, since its own refine pins the ratio to 9:16.
 */
describe('ratio commands refuse what the schema rejects', () => {
  it('refuses to add 1:1 to a failure batch', () => {
    const project = failureProjectFixture();
    const toggled = toggleRenderRatio(project, '1:1');

    expect(toggled).toBe(project);
    expect(parseProject(toggled).ok).toBe(true);
  });

  it('still adds and removes the ratios the template does allow', () => {
    const withBoth = toggleRenderRatio(failureProjectFixture(), '16:9');

    expect(withBoth.render.selectedRatios).toEqual(['9:16', '16:9']);
    expect(parseProject(withBoth).ok).toBe(true);

    const backToOne = toggleRenderRatio(withBoth, '16:9');

    expect(backToOne.render.selectedRatios).toEqual(['9:16']);
  });

  it('refuses 1:1 as the preview ratio, and takes 16:9', () => {
    const project = failureProjectFixture();

    expect(setSelectedRatio(project, '1:1')).toBe(project);
    expect(setSelectedRatio(project, '16:9').selectedRatio).toBe('16:9');
    expect(parseProject(setSelectedRatio(project, '16:9')).ok).toBe(true);
  });

  it('closes the same hole on the looping template', () => {
    const loop = kvLoopProjectFixture();

    expect(toggleRenderRatio(loop, '16:9')).toBe(loop);
    expect(setSelectedRatio(loop, '16:9')).toBe(loop);
  });

  it('leaves every ratio available to the templates that take them all', () => {
    for (const project of [
      createProject(15),
      day1ProjectFixture(),
      day1QuadProjectFixture(),
    ]) {
      const toggled = toggleRenderRatio(project, '1:1');

      expect(toggled.render.selectedRatios).toContain('1:1');
      expect(setSelectedRatio(project, '1:1').selectedRatio).toBe('1:1');
      expect(parseProject(toggled).ok).toBe(true);
    }
  });

  // A ratio already stored stays removable even if it should not be there —
  // otherwise an imported document could never be brought back into range.
  it('lets a forbidden ratio already in the list be removed', () => {
    const project = failureProjectFixture();
    const stuck: EditorProject = {
      ...project,
      render: {...project.render, selectedRatios: ['9:16', '1:1']},
    };

    expect(toggleRenderRatio(stuck, '1:1').render.selectedRatios).toEqual([
      '9:16',
    ]);
  });
});
