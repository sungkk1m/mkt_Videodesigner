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
  failureOf,
  panelKeysOf,
  parseProject,
  setDay1EndCardTrimInMs,
  setDay1EndCardTrimLengthMs,
  setDay1EndCardVideo,
  setDay1PanelSource,
  setDay1TrimInMs,
  switchTemplate,
  threeSceneOf,
  updateDay1EndCard,
  updateDay1LabelStyle,
  updateDay1Split,
} from './project';
import {testMediaReference} from '../../test/fixtures/media';
import {
  DEFAULT_DAY1_PANEL_TRANSFORM,
  FAILURE_SECTION_ORDER,
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
