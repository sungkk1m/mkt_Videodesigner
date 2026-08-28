// Day1 Design Ref: §2.2 — the render snapshot the Player and the render job share.
import {describe, expect, it} from 'vitest';

import {APP_ICON_RECT, appIconRect} from '../day1/endCard';
import {quadLayout, splitLayout} from '../day1/layout';
import {
  DEFAULT_DAY1_SETTINGS,
  buildDay1Props,
  buildDay1QuadProps,
  buildEditorSnapshot,
  createProject,
  setDay1LabelText,
  setDay1PanelSource,
  updateDay1LabelStyle,
  parseProject,
  switchTemplate,
  updateDay1Transform,
} from './project';
import {
  TEST_SOURCE_URL,
  testMediaReference,
  testUrlResolver,
} from '../../test/fixtures/media';
import {
  day1ProjectFixture,
  day1QuadProjectFixture,
  day1SettingsOf,
} from '../../test/fixtures/project';
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
  it('returns null for a template that is not Day1', () => {
    expect(
      buildDay1Props(switchTemplate(createProject(), 'kv-loop'), testUrlResolver()),
    ).toBeNull();
  });

  it('lays the three sections end to end across the full preset', () => {
    const props = buildDay1Props(loadedDay1(), testUrlResolver());
    const sections = props?.sections ?? [];

    expect(sections.map((section) => section.id)).toEqual([
      'panel-a',
      'panel-b',
      'endcard',
    ]);
    expect(sections.map((section) => section.fromFrame)).toEqual([0, 180, 360]);
    // 15s preset at 30fps: 6000/6000/3000ms.
    expect(sections.map((section) => section.durationInFrames)).toEqual([
      180, 180, 90,
    ]);
    expect(
      sections.reduce((sum, section) => sum + section.durationInFrames, 0),
    ).toBe(15 * 30);
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
    expect(props?.panelA.trimAfterFrames).toBe(180);
    // Panel B starts one second into its own source.
    expect(props?.panelB.trimBeforeFrames).toBe(30);
    expect(props?.panelB.trimAfterFrames).toBe(210);
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

  // day1-video — the composition branches on this, so it has to survive the
  // prop builder rather than being re-derived there.
  it('carries each panel fit into the render props', () => {
    const loaded = loadedDay1();

    expect(buildDay1Props(loaded, testUrlResolver())?.panelA.fit).toBe('cover');

    const contained = updateDay1Transform(loaded, 'panelA', '9:16', {
      fit: 'contain',
    });
    const props = buildDay1Props(contained, testUrlResolver());

    expect(props?.panelA.fit).toBe('contain');
    // The other panel is untouched — fit is per panel, not per project.
    expect(props?.panelB.fit).toBe('cover');
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

  // day1-label-effects Plan SC3 — the effect fields ride the same spread the
  // rest of `labelStyle` does, so the composition sees exactly what was stored.
  it('carries the label box and glow settings into the render props', () => {
    const project = updateDay1LabelStyle(loadedDay1(), {
      showBackground: true,
      backgroundColor: '#123456',
      backgroundOpacity: 0.8,
      glowEnabled: true,
      glowColor: '#ff00ff',
      glowStrengthPx: 24,
    });
    const props = buildDay1Props(project, testUrlResolver());

    expect(props?.labelStyle).toMatchObject({
      showBackground: true,
      backgroundColor: '#123456',
      backgroundOpacity: 0.8,
      glowEnabled: true,
      glowColor: '#ff00ff',
      glowStrengthPx: 24,
    });
  });

  // FR-07 — the plate's own halo rides the same spread, with its own values.
  it('carries the box glow settings separately from the glyph glow', () => {
    const project = updateDay1LabelStyle(loadedDay1(), {
      showBackground: true,
      glowEnabled: true,
      glowColor: '#ff0000',
      boxGlowEnabled: true,
      boxGlowColor: '#00ff00',
      boxGlowStrengthPx: 28,
    });
    const props = buildDay1Props(project, testUrlResolver());

    expect(props?.labelStyle).toMatchObject({
      glowColor: '#ff0000',
      boxGlowEnabled: true,
      boxGlowColor: '#00ff00',
      boxGlowStrengthPx: 28,
    });
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

  it('uses the bannerdesigner 16:9 coordinates on a landscape render', () => {
    const props = buildDay1Props(
      {...withEndCard(), selectedRatio: '16:9'},
      testUrlResolver(),
    );

    expect(props?.endCard.iconRect).toEqual(APP_ICON_RECT['16:9']);
  });

  it('carries the video mode with its trim window in frames (U-06)', () => {
    // 5s source, window moved to 1s..4s, at the 30fps default.
    const props = buildDay1Props(
      withEndCard({
        mode: 'video',
        video: testMediaReference({id: 'ec', durationMs: 5000}),
        videoTrim: {inMs: 1000, outMs: 4000},
      }),
      testUrlResolver(),
    );

    expect(props?.endCard.mode).toBe('video');
    expect(props?.endCard.videoUrl).toBe(TEST_SOURCE_URL);
    expect(props?.endCard.videoTrimBeforeFrames).toBe(30);
    expect(props?.endCard.videoTrimAfterFrames).toBe(120);
    // The banner side still resolves — inactive, not erased (D-02).
    expect(props?.endCard.bannerUrl).toBe(TEST_SOURCE_URL);
  });

  // day1-trim-preview Plan SC2 — a user-shortened window reaches the renderer
  // frame-exact; the always-on loop then fills the 3s card from these frames.
  it('carries a shortened 2s window in frames for the loop to fill (SC2)', () => {
    const props = buildDay1Props(
      withEndCard({
        mode: 'video',
        video: testMediaReference({id: 'ec', durationMs: 12_000}),
        videoTrim: {inMs: 2600, outMs: 4600},
      }),
      testUrlResolver(),
    );

    expect(props?.endCard.videoTrimBeforeFrames).toBe(78);
    expect(props?.endCard.videoTrimAfterFrames).toBe(138);
  });

  // day1-endcard-audio Plan SC1 — the audio settings reach the composition.
  it('carries the end-card audio toggle and volume (SC1)', () => {
    const props = buildDay1Props(
      withEndCard({
        mode: 'video',
        video: testMediaReference({id: 'ec', durationMs: 5000}),
        videoTrim: {inMs: 0, outMs: 3000},
        videoAudioEnabled: true,
        videoAudioVolume: 0.7,
      }),
      testUrlResolver(),
    );

    expect(props?.endCard.videoAudioEnabled).toBe(true);
    expect(props?.endCard.videoAudioVolume).toBe(0.7);
  });

  it('folds iconAdjust into the rectangle so the composition needs no maths', () => {
    const adjust = {dx: 0.02, dy: -0.03, scale: 1.25};
    const project = withEndCard({iconAdjust: adjust});
    const props = buildDay1Props(project, testUrlResolver());

    expect(props?.endCard.iconRect).toEqual(
      appIconRect(project.selectedRatio, adjust),
    );
  });
});

// day1-quad Design §6.4 — the four-panel render snapshot.
describe('buildDay1QuadProps', () => {
  const withFourPanels = (): EditorProject =>
    (['panelA', 'panelB', 'panelC', 'panelD'] as const).reduce(
      (project, key, index) =>
        setDay1PanelSource(
          project,
          key,
          testMediaReference({id: `m${index}`, durationMs: 12_000}),
        ),
      day1QuadProjectFixture(),
    );

  it('returns null for every other template', () => {
    expect(buildDay1QuadProps(createProject(), testUrlResolver())).toBeNull();
    expect(
      buildDay1QuadProps(day1ProjectFixture(), testUrlResolver()),
    ).toBeNull();
  });

  it('bakes the grid geometry and the four resolved panels', () => {
    const project = withFourPanels();
    const props = buildDay1QuadProps(project, testUrlResolver());

    expect(props).not.toBeNull();
    expect(props?.layout).toEqual(quadLayout('9:16', 6));
    expect(props?.panels).toHaveLength(4);
    props?.panels.forEach((panel) => {
      expect(panel.url).toBe(TEST_SOURCE_URL);
      // Plan Q4 — panels start `contain`, so the backdrop path is live.
      expect(panel.fit).toBe('contain');
    });
  });

  // day1-label-effects FR-05 — one shared style set, so the quad's props carry
  // the same effects as Day1's.
  it('carries the label box and glow settings into the quad render props', () => {
    const project = updateDay1LabelStyle(withFourPanels(), {
      showBackground: true,
      glowEnabled: true,
      glowStrengthPx: 24,
    });
    const props = buildDay1QuadProps(project, testUrlResolver());

    expect(props?.labelStyle).toMatchObject({
      showBackground: true,
      glowEnabled: true,
      glowStrengthPx: 24,
    });
  });

  it('lays the five sections out on the frame axis in reading order', () => {
    const props = buildDay1QuadProps(withFourPanels(), testUrlResolver());

    expect(props?.sections.map((section) => section.activePanel)).toEqual([
      'a',
      'b',
      'c',
      'd',
      null,
    ]);
    // 15s at 30fps: four 3s panels then the 3s card, back to back.
    expect(props?.sections.map((section) => section.fromFrame)).toEqual([
      0, 90, 180, 270, 360,
    ]);
    expect(
      props?.sections.reduce(
        (sum, section) => sum + section.durationInFrames,
        0,
      ),
    ).toBe(450);
  });

  it('resolves each panel label from the selected locale', () => {
    const project = setDay1LabelText(withFourPanels(), 'ko', 'c', 'DAY 14');
    const props = buildDay1QuadProps(project, testUrlResolver());

    expect(props?.panels.map((panel) => panel.label)).toEqual([
      'Day1',
      'Day2',
      'DAY 14',
      'Day7',
    ]);
  });

  it('tags the snapshot so the render path branches exactly once', () => {
    const snapshot = buildEditorSnapshot(withFourPanels(), testUrlResolver());

    expect(snapshot.template).toBe('day1-quad');
    // The other templates still resolve to their own arms.
    expect(buildEditorSnapshot(day1ProjectFixture(), testUrlResolver()).template)
      .toBe('day1');
    expect(
      buildEditorSnapshot(
        switchTemplate(createProject(), 'kv-loop'),
        testUrlResolver(),
      ).template,
    ).toBe('kv-loop');
  });

  it('reuses the Day1 end card untouched (Q7)', () => {
    const props = buildDay1QuadProps(withFourPanels(), testUrlResolver());
    const day1Props = buildDay1Props(day1ProjectFixture(), testUrlResolver());

    expect(props?.endCard.iconRect).toEqual(day1Props?.endCard.iconRect);
    expect(props?.endCard.mode).toBe(day1Props?.endCard.mode);
    expect(props?.endCard.cardMotion).toBe(day1Props?.endCard.cardMotion);
  });
});
