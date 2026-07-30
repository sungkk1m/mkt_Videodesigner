// Day1 Design Ref: §2.2 — the render snapshot the Player and the render job share.
import {describe, expect, it} from 'vitest';

import {APP_ICON_RECT, placedIconRect} from '../day1/endCard';
import {splitLayout} from '../day1/layout';
import {
  DEFAULT_DAY1_SETTINGS,
  buildCompositionProps,
  buildDay1Props,
  createProject,
  parseProject,
} from './project';
import {
  TEST_SOURCE_URL,
  testMediaReference,
  testUrlResolver,
} from '../../test/fixtures/media';
import {day1ProjectFixture, day1SettingsOf} from '../../test/fixtures/project';
import type {
  Day1Panel,
  Day1Settings,
  EditorProject,
  LocalizedCopy,
} from './types';

const panelWithSource = (inMs = 0, outMs = 6000): Day1Panel => ({
  source: testMediaReference({durationMs: 12_000}),
  trim: {inMs, outMs},
  transforms: {base: {fit: 'cover', scale: 1, x: 0, y: 0}, overrides: {}},
});

const loadedDay1 = (): EditorProject =>
  day1ProjectFixture({
    panelA: panelWithSource(),
    panelB: panelWithSource(1000, 7000),
  });

const withLabels = (project: EditorProject, a: string, b: string) => ({
  ...project,
  copy: {
    ...project.copy,
    ko: {...(project.copy.ko as LocalizedCopy), day1Labels: {a, b}},
  },
});

describe('day1 project fixture', () => {
  it('is a project the v2 schema accepts', () => {
    const result = parseProject(loadedDay1());

    expect(result.ok).toBe(true);
  });
});

describe('buildDay1Props', () => {
  it('returns null for a three-scene project', () => {
    expect(buildDay1Props(createProject(), testUrlResolver())).toBeNull();
  });

  it('lays the three sections end to end across the full preset', () => {
    const props = buildDay1Props(loadedDay1(), testUrlResolver());
    const sections = props?.sections ?? [];

    expect(sections.map((section) => section.id)).toEqual([
      'panel-a',
      'panel-b',
      'endcard',
    ]);
    expect(sections.map((section) => section.fromFrame)).toEqual([0, 360, 720]);
    // 15s preset at 60fps: 6000/6000/3000ms.
    expect(sections.map((section) => section.durationInFrames)).toEqual([
      360, 360, 180,
    ]);
    expect(
      sections.reduce((sum, section) => sum + section.durationInFrames, 0),
    ).toBe(15 * 60);
  });

  it('maps the active panel onto the section axis, with none on the end card', () => {
    const props = buildDay1Props(loadedDay1(), testUrlResolver());

    expect(props?.sections.map((section) => section.activePanel)).toEqual([
      'a',
      'b',
      null,
    ]);
  });

  it('resolves each panel URL and trim window independently', () => {
    const props = buildDay1Props(loadedDay1(), testUrlResolver());

    expect(props?.panelA.url).toBe(TEST_SOURCE_URL);
    expect(props?.panelB.url).toBe(TEST_SOURCE_URL);
    expect(props?.panelA.trimBeforeFrames).toBe(0);
    expect(props?.panelA.trimAfterFrames).toBe(360);
    // Panel B starts one second into its own source.
    expect(props?.panelB.trimBeforeFrames).toBe(60);
    expect(props?.panelB.trimAfterFrames).toBe(420);
  });

  it('keeps a missing panel source as a null URL so the preview can prompt', () => {
    const props = buildDay1Props(
      day1ProjectFixture({panelA: panelWithSource()}),
      testUrlResolver(),
    );

    expect(props?.panelA.url).toBe(TEST_SOURCE_URL);
    expect(props?.panelB.url).toBeNull();
  });

  it('carries the split geometry for the selected ratio', () => {
    const project = loadedDay1();
    const props = buildDay1Props(
      {...project, selectedRatio: '16:9'},
      testUrlResolver(),
    );

    expect(props?.layout).toEqual(
      splitLayout('16:9', day1SettingsOf(project).split.lineWidthPx),
    );
    expect(props?.layout.orientation).toBe('horizontal');
    expect(props?.lineColor).toBe('#9ca3af');
  });

  it('applies a per-ratio framing override to the panel it belongs to', () => {
    const panelA = panelWithSource();
    const project = day1ProjectFixture({
      panelA: {
        ...panelA,
        transforms: {
          base: {fit: 'cover', scale: 1, x: 0, y: 0},
          overrides: {'1:1': {fit: 'cover', scale: 1.4, x: 10, y: -5}},
        },
      },
      panelB: panelWithSource(),
    });

    const square = buildDay1Props(
      {...project, selectedRatio: '1:1'},
      testUrlResolver(),
    );
    const portrait = buildDay1Props(
      {...project, selectedRatio: '9:16'},
      testUrlResolver(),
    );

    expect(square?.panelA).toMatchObject({scale: 1.4, x: 10, y: -5});
    expect(square?.panelB).toMatchObject({scale: 1, x: 0, y: 0});
    expect(portrait?.panelA).toMatchObject({scale: 1, x: 0, y: 0});
  });

  it('takes each panel label from the selected locale', () => {
    const project = withLabels(loadedDay1(), 'DAY 1', 'DAY 30');
    const props = buildDay1Props(project, testUrlResolver());

    expect(props?.panelA.label).toBe('DAY 1');
    expect(props?.panelB.label).toBe('DAY 30');
    // A locale with no labels yields empty strings, which hides the overlay.
    expect(
      buildDay1Props({...project, selectedLocale: 'en'}, testUrlResolver())
        ?.panelA.label,
    ).toBe('');
  });

  it('carries BGM but no narration, since Day1 is outside the TTS scope', () => {
    const props = buildDay1Props(loadedDay1(), testUrlResolver());

    expect(props?.audio.narration).toEqual([]);
    expect(props?.audio.originalVolume).toBe(
      loadedDay1().audio.originalVolume,
    );
  });

  it('freezes the snapshot so a running render cannot see later edits', () => {
    const props = buildDay1Props(loadedDay1(), testUrlResolver());

    expect(Object.isFrozen(props)).toBe(true);
    expect(Object.isFrozen(props?.panelA)).toBe(true);
    expect(Object.isFrozen(props?.sections[0])).toBe(true);
    expect(Object.isFrozen(props?.endCard)).toBe(true);
  });
});

// Day1 Design Ref: §5.3 — SC5 (icon within 2px of the baked-in one) is decided
// here, in the geometry the composition is handed, not in the composition.
describe('buildDay1Props end card', () => {
  const withEndCard = (endCard: Partial<Day1Settings['endCard']> = {}) =>
    day1ProjectFixture({
      panelA: panelWithSource(),
      panelB: panelWithSource(),
      endCard: {
        ...DEFAULT_DAY1_SETTINGS.endCard,
        banner: testMediaReference({id: 'banner', kind: 'image'}),
        appIcon: testMediaReference({id: 'icon', kind: 'image'}),
        ...endCard,
      },
    });

  it('resolves both layer URLs and carries the chosen presets', () => {
    const props = buildDay1Props(withEndCard(), testUrlResolver());

    expect(props?.endCard.bannerUrl).toBe(TEST_SOURCE_URL);
    expect(props?.endCard.iconUrl).toBe(TEST_SOURCE_URL);
    expect(props?.endCard.iconAnimation).toBe('pop');
    expect(props?.endCard.cardMotion).toBe('ken-burns');
  });

  it('leaves an un-uploaded layer as a null URL', () => {
    const props = buildDay1Props(
      withEndCard({appIcon: null}),
      testUrlResolver(),
    );

    expect(props?.endCard.bannerUrl).toBe(TEST_SOURCE_URL);
    expect(props?.endCard.iconUrl).toBeNull();
  });

  it('places the icon on the bannerdesigner coordinates for the selected ratio', () => {
    const project = withEndCard();

    for (const ratio of ['1:1', '9:16'] as const) {
      const props = buildDay1Props(
        {...project, selectedRatio: ratio},
        testUrlResolver(),
      );

      expect(props?.endCard.iconRect).toEqual(APP_ICON_RECT[ratio]);
    }
  });

  it('falls back to the centred rectangle on 16:9, which has no layout', () => {
    const props = buildDay1Props(
      {...withEndCard(), selectedRatio: '16:9'},
      testUrlResolver(),
    );

    const rect = placedIconRect('16:9');

    expect(props?.endCard.iconRect).toEqual(rect);
    expect(rect.x + rect.w / 2).toBeCloseTo(0.5, 10);
  });

  it('folds iconAdjust into the rectangle so the composition needs no maths', () => {
    const adjust = {dx: 0.02, dy: -0.03, scale: 1.25};
    const project = withEndCard({iconAdjust: adjust});
    const props = buildDay1Props(project, testUrlResolver());

    expect(props?.endCard.iconRect).toEqual(
      placedIconRect(project.selectedRatio, adjust),
    );
  });
});

describe('buildCompositionProps on a Day1 project', () => {
  it('stays a harmless empty snapshot rather than reading Day1 fields', () => {
    const props = buildCompositionProps(loadedDay1(), testUrlResolver());

    expect(props.src).toBeNull();
    expect(props.scenes).toEqual([]);
  });
});
