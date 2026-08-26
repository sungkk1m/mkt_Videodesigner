import {describe, expect, it} from 'vitest';

import {testMediaReference} from '../../test/fixtures/media';
import {
  createProject,
  day1QuadOf,
  kvLoopOf,
  parseProject,
  switchTemplate,
  threeSceneOf,
} from './project';
import {
  day1ProjectFixture,
  day1QuadProjectFixture,
  kvLoopProjectFixture,
} from '../../test/fixtures/project';
import {MAX_LABEL_GLOW_PX} from './constants';
import type {EditorProject, Section, ThreeSceneSettings} from './types';

const valid = (): EditorProject => createProject(15);

/** The section axis is a variable length array, so mutating one narrows first. */
const sectionAt = (project: EditorProject, index: number) =>
  project.sections[index] as Section;

/** Every test here builds a three-scene project, so narrowing is unconditional. */
const scenesOf = (project: EditorProject) =>
  (project.templateSettings as ThreeSceneSettings).scenes;

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

describe('parseProject', () => {
  it('accepts a project produced by the domain commands', () => {
    const result = parseProject(valid());

    expect(result.ok).toBe(true);
  });

  it('rejects an unknown schema version', () => {
    const result = parseProject({...valid(), schemaVersion: 3});

    expect(result).toMatchObject({ok: false, error: {code: 'PROJECT_INVALID'}});
  });

  it('rejects section durations that do not add up to the preset', () => {
    const project = valid();
    sectionAt(project, 0).durationMs = 5000;

    expect(issuePaths(project)).toContain('sections');
  });

  it('rejects a section shorter than one second', () => {
    const project = valid();
    sectionAt(project, 0).durationMs = 500;
    sectionAt(project, 1).durationMs = 11500;

    expect(issuePaths(project)).toContain('sections.0.durationMs');
  });

  it('rejects a section count the template does not have', () => {
    const project = valid();

    // key-visual-looping Design Ref: §3.1 — the axis takes 2-8 sections now, so
    // the three-scene count is pinned by the refinement rather than by the shape.
    // The two sections still total the preset, so the count is the only breach.
    project.sections = [
      sectionAt(project, 0),
      {...sectionAt(project, 1), durationMs: 13_000},
    ];

    expect(issuePaths(project)).toEqual(['sections']);
  });

  it('rejects section ids that do not match the template order', () => {
    const project = valid();
    sectionAt(project, 0).id = 'cta';

    expect(issuePaths(project)).toContain('sections.0.id');
  });

  it('rejects a reordered scene list', () => {
    const project = valid();
    scenesOf(project)[0].kind = 'cta';

    expect(issuePaths(project)).toContain('templateSettings.scenes.0.kind');
  });

  it('rejects a transform outside the supported range', () => {
    const project = valid();
    scenesOf(project)[1].transforms.base.scale = 12;

    expect(issuePaths(project)).toContain(
      'templateSettings.scenes.1.transforms.base.scale',
    );
  });

  it('rejects a trim window that leaves the source', () => {
    const project = valid();
    const settings = threeSceneOf(project) as ThreeSceneSettings;
    settings.source = testMediaReference({durationMs: 5000});
    settings.scenes[1].trim = {inMs: 0, outMs: 9000};

    expect(issuePaths(project)).toContain(
      'templateSettings.scenes.1.trim.outMs',
    );
  });

  it('returns an actionable error rather than throwing on garbage input', () => {
    const result = parseProject('not a project');

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'PROJECT_INVALID',
        retryable: false,
        action: {target: 'diagnostics'},
      },
    });
  });
});

/**
 * Day1 Design Ref: §3.2 and §3.5. The Day1 payload is only reachable through a
 * hand-written document until module 5 adds the template selector, so the
 * schema is the one thing standing between such a document and the editor.
 */
describe('parseProject — Day1 payload', () => {
  const day1Project = (): EditorProject => {
    const base = valid();

    return {
      ...base,
      sections: [
        {id: 'panel-a', label: '패널 A', durationMs: 6000},
        {id: 'panel-b', label: '패널 B', durationMs: 6000},
        {id: 'endcard', label: '엔드카드', durationMs: 3000},
      ],
      templateSettings: {
        template: 'day1',
        panelA: {
          source: null,
          trim: {inMs: 0, outMs: 0},
          transforms: {base: {fit: 'cover', scale: 1, x: 0, y: 0}, overrides: {}},
        },
        panelB: {
          source: null,
          trim: {inMs: 0, outMs: 0},
          transforms: {base: {fit: 'cover', scale: 1, x: 0, y: 0}, overrides: {}},
        },
        split: {lineColor: '#9ca3af', lineWidthPx: 6},
        labelStyle: {
          fontSize: 64,
          textColor: '#ffffff',
          outlineColor: '#000000',
          outlineWidthPx: 8,
          position: 'center',
          showBackground: false,
          backgroundColor: '#000000',
          backgroundOpacity: 0.6,
          glowEnabled: false,
          glowColor: '#000000',
          glowStrengthPx: 16,
        },
        endCard: {
          mode: 'banner',
          banner: null,
          appIcon: null,
          iconAdjust: {dx: 0, dy: 0, scale: 1},
          iconAnimation: 'pop',
          cardMotion: 'ken-burns',
          video: null,
          videoTrim: {inMs: 0, outMs: 0},
          videoAudioEnabled: true,
          videoAudioVolume: 1,
        },
      },
    };
  };

  it('accepts a well-formed Day1 project', () => {
    expect(parseProject(day1Project()).ok).toBe(true);
  });

  it('accepts a Day1 project with no panel sources yet', () => {
    // FR-D03 is a render preflight gate, not a schema rule — a half-uploaded
    // project still has to save.
    const project = day1Project();

    expect(parseProject(project).ok).toBe(true);
  });

  it('defaults a legacy endCard without the video fields to banner mode (U-01/SC2)', () => {
    // A v2 document saved before endcard-video has no mode/video/videoTrim
    // keys. The zod defaults are the entire migration story — this parsing
    // succeeding is what lets the cycle ship no migration code.
    const project = day1Project();
    const {mode: _m, video: _v, videoTrim: _t, ...legacyEndCard} =
      project.templateSettings.template === 'day1'
        ? project.templateSettings.endCard
        : (() => {
            throw new Error('fixture must be day1');
          })();
    const legacy = {
      ...project,
      templateSettings: {...project.templateSettings, endCard: legacyEndCard},
    };

    const result = parseProject(legacy);

    expect(result.ok).toBe(true);

    if (result.ok && result.value.templateSettings.template === 'day1') {
      const {endCard} = result.value.templateSettings;

      expect(endCard.mode).toBe('banner');
      expect(endCard.video).toBeNull();
      expect(endCard.videoTrim).toEqual({inMs: 0, outMs: 0});
    }
  });

  // day1-endcard-audio Plan SC1 — the same zero-migration story: a document
  // saved before this cycle has no audio keys and parses as audible at 100%.
  it('defaults a legacy endCard without the audio fields to enabled at 1', () => {
    const project = day1Project();
    const {
      videoAudioEnabled: _e,
      videoAudioVolume: _vol,
      ...legacyEndCard
    } = project.templateSettings.template === 'day1'
      ? project.templateSettings.endCard
      : (() => {
          throw new Error('fixture must be day1');
        })();
    const legacy = {
      ...project,
      templateSettings: {...project.templateSettings, endCard: legacyEndCard},
    };

    const result = parseProject(legacy);

    expect(result.ok).toBe(true);

    if (result.ok && result.value.templateSettings.template === 'day1') {
      const {endCard} = result.value.templateSettings;

      expect(endCard.videoAudioEnabled).toBe(true);
      expect(endCard.videoAudioVolume).toBe(1);
    }
  });

  // day1-label-effects Plan SC1 — the same zero-migration story once more: a
  // document saved before this cycle has no box or glow keys and parses as the
  // outline-only label it was saved with.
  it('defaults a legacy labelStyle without the effect fields to both effects off', () => {
    const project = day1Project();
    const {
      showBackground: _b,
      backgroundColor: _bc,
      backgroundOpacity: _bo,
      glowEnabled: _g,
      glowColor: _gc,
      glowStrengthPx: _gs,
      ...legacyLabelStyle
    } = project.templateSettings.template === 'day1'
      ? project.templateSettings.labelStyle
      : (() => {
          throw new Error('fixture must be day1');
        })();
    const legacy = {
      ...project,
      templateSettings: {
        ...project.templateSettings,
        labelStyle: legacyLabelStyle,
      },
    };

    const result = parseProject(legacy);

    expect(result.ok).toBe(true);

    if (result.ok && result.value.templateSettings.template === 'day1') {
      const {labelStyle} = result.value.templateSettings;

      expect(labelStyle.showBackground).toBe(false);
      expect(labelStyle.backgroundColor).toBe('#000000');
      expect(labelStyle.backgroundOpacity).toBe(0.6);
      expect(labelStyle.glowEnabled).toBe(false);
      expect(labelStyle.glowColor).toBe('#000000');
      expect(labelStyle.glowStrengthPx).toBe(16);
    }
  });

  it('rejects an out-of-range label box opacity (SC1)', () => {
    const project = day1Project();

    if (project.templateSettings.template !== 'day1') {
      throw new Error('fixture must be day1');
    }

    project.templateSettings.labelStyle.backgroundOpacity = 1.5;

    expect(parseProject(project).ok).toBe(false);
  });

  it('rejects a label glow past the maximum blur radius (SC1)', () => {
    const project = day1Project();

    if (project.templateSettings.template !== 'day1') {
      throw new Error('fixture must be day1');
    }

    project.templateSettings.labelStyle.glowStrengthPx = MAX_LABEL_GLOW_PX + 1;

    expect(parseProject(project).ok).toBe(false);
  });

  it('rejects an out-of-range end-card audio volume (SC1)', () => {
    const project = day1Project();

    if (project.templateSettings.template !== 'day1') {
      throw new Error('fixture must be day1');
    }

    project.templateSettings.endCard.videoAudioVolume = 1.5;

    expect(parseProject(project).ok).toBe(false);
  });

  it('rejects an end-card trim window past its source (U-08)', () => {
    const project = day1Project();

    if (project.templateSettings.template !== 'day1') {
      throw new Error('fixture must be day1');
    }

    project.templateSettings.endCard = {
      ...project.templateSettings.endCard,
      video: {
        id: 'ec',
        kind: 'video',
        name: 'endcard.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 1,
        lastModified: 0,
        durationMs: 2000,
        fingerprint: 'f',
        status: 'available',
      },
      videoTrim: {inMs: 0, outMs: 3000},
    };

    expect(parseProject(project).ok).toBe(false);
  });

  it('rejects three-scene section ids on a Day1 project', () => {
    const project = day1Project();
    sectionAt(project, 0).id = 'hook';

    expect(issuePaths(project)).toContain('sections.0.id');
  });

  it('rejects a split line colour that is not a hex value', () => {
    const project = day1Project();
    (
      project.templateSettings as Extract<
        EditorProject['templateSettings'],
        {template: 'day1'}
      >
    ).split.lineColor = 'skyblue';

    expect(issuePaths(project)).toContain(
      'templateSettings.split.lineColor',
    );
  });

  it('rejects a panel trim that leaves its own source', () => {
    const project = day1Project();
    const settings = project.templateSettings as Extract<
      EditorProject['templateSettings'],
      {template: 'day1'}
    >;
    settings.panelA.source = testMediaReference({durationMs: 5000});
    settings.panelA.trim = {inMs: 0, outMs: 9000};

    expect(issuePaths(project)).toContain(
      'templateSettings.panelA.trim.outMs',
    );
  });
});


// day1-quad Design §5.2 — a fourth arm on the discriminated union, five sections
// on the shared axis, and one rule Day1 does not have (the narrowed preset).
describe('parseProject — Day1-quad payload', () => {
  it('accepts the four-panel payload on a five-section axis', () => {
    const project = day1QuadProjectFixture();
    const result = parseProject(project);

    expect(result.ok).toBe(true);
    expect(project.sections.map((section) => section.id)).toEqual([
      'panel-a',
      'panel-b',
      'panel-c',
      'panel-d',
      'endcard',
    ]);
    expect(day1QuadOf(project)).not.toBeNull();
  });

  it('rejects a section count or order that is not the quad axis', () => {
    const dropped = day1QuadProjectFixture();
    // Four sections cannot total the preset either, so both issues surface.
    expect(
      issuePaths({...dropped, sections: dropped.sections.slice(0, 4)}),
    ).toContain('sections');

    const reordered = day1QuadProjectFixture();
    const swapped = [...reordered.sections];
    const [c, d] = [swapped[2], swapped[3]];
    swapped[2] = d as Section;
    swapped[3] = c as Section;

    expect(issuePaths({...reordered, sections: swapped})).toContain(
      'sections.2.id',
    );
  });

  // Plan Q8a — `switchTemplate` coerces, so the editor never produces this; an
  // imported JSON can, and it must not silently render at 60s.
  it('rejects the 60s preset', () => {
    const sixty = day1QuadProjectFixture();
    const at60: EditorProject = {
      ...sixty,
      durationPreset: 60,
      sections: sixty.sections.map((section, index) => ({
        ...section,
        durationMs: index === 4 ? 3000 : 14_250,
      })),
    };

    expect(issuePaths(at60)).toContain('durationPreset');
    // 15s and 30s are accepted.
    expect(parseProject(day1QuadProjectFixture({}, 15)).ok).toBe(true);
    expect(parseProject(day1QuadProjectFixture({}, 30)).ok).toBe(true);
  });

  it('bounds a panel trim window inside its source, like Day1', () => {
    const project = day1QuadProjectFixture();
    const settings = day1QuadOf(project);

    expect(
      issuePaths({
        ...project,
        templateSettings: {
          ...settings,
          panelC: {
            ...settings?.panelC,
            source: testMediaReference({durationMs: 4000}),
            trim: {inMs: 0, outMs: 9000},
          },
        },
      }),
    ).toContain('templateSettings.panelC.trim.outMs');
  });

  // Design §5.3 — `c`/`d` are optional so a stored Day1 copy block, which only
  // ever had `a` and `b`, parses with no migration.
  it('parses a Day1 copy block that has no c/d labels', () => {
    const day1 = switchTemplate(day1ProjectFixture(), 'day1');
    const legacyCopy = {
      ...day1,
      copy: {
        ...day1.copy,
        ko: {...day1.copy.ko, day1Labels: {a: 'DAY 1', b: 'DAY 30'}},
      },
    };
    const result = parseProject(legacyCopy);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.copy.ko?.day1Labels).toEqual({
        a: 'DAY 1',
        b: 'DAY 30',
      });
    }
  });
});

describe('parseProject — motion migration (kv-motion-effects §3.2)', () => {
  /** A stored looping document, as it was written before `motion` existed. */
  const storedWithBoolean = (kenBurns: boolean[]) => {
    const project = kvLoopProjectFixture();
    const settings = kvLoopOf(project);

    if (!settings) {
      throw new Error('fixture is not a looping project');
    }

    const {motion: _loopMotion, ...rest} = settings;

    return JSON.parse(
      JSON.stringify({
        ...project,
        templateSettings: {
          ...rest,
          slots: kenBurns.map((enabled, index) => {
            const slot = settings.slots[index];
            const {motion: _slotMotion, ...slotRest} = slot ?? {
              transform: {fit: 'cover', scale: 1, x: 0, y: 0},
              motion: null,
            };

            return {...slotRest, kenBurns: enabled};
          }),
        },
      }),
    ) as unknown;
  };

  it('reads `kenBurns: true` as zoom in — U-11', () => {
    const parsed = parseProject(storedWithBoolean([true, true, true, true]));

    expect(parsed.ok).toBe(true);
    expect(
      parsed.ok ? kvLoopOf(parsed.value)?.slots.map((slot) => slot.motion) : null,
    ).toEqual(
      Array.from({length: 4}, () => ({kind: 'preset', preset: 'zoomIn'})),
    );
  });

  it('reads `kenBurns: false` as a still — U-12', () => {
    // The distinction the boolean could not carry: an unchecked box and a chosen
    // still now land on the same explicit value, per slot.
    const parsed = parseProject(storedWithBoolean([true, false, true, true]));

    expect(
      parsed.ok ? kvLoopOf(parsed.value)?.slots[1]?.motion : null,
    ).toEqual({kind: 'preset', preset: 'still'});
  });

  it('leaves an already-migrated slot alone — U-13', () => {
    const project = kvLoopProjectFixture();
    const settings = kvLoopOf(project);
    const own = {kind: 'preset', preset: 'panLeftToRight'} as const;
    const stored = JSON.parse(
      JSON.stringify({
        ...project,
        templateSettings: {
          ...settings,
          slots: settings?.slots.map((slot, index) => ({
            ...slot,
            // Both fields present: the newer one has to win.
            kenBurns: false,
            motion: index === 0 ? own : null,
          })),
        },
      }),
    ) as unknown;
    const parsed = parseProject(stored);

    expect(parsed.ok).toBe(true);
    expect(
      parsed.ok ? kvLoopOf(parsed.value)?.slots.map((slot) => slot.motion) : null,
    ).toEqual([own, null, null, null]);
  });

  it('gives a stored document the loop-wide default it never had', () => {
    const parsed = parseProject(storedWithBoolean([true, true, true, true]));

    expect(parsed.ok ? kvLoopOf(parsed.value)?.motion : null).toEqual({
      kind: 'preset',
      preset: 'zoomIn',
    });
  });

  it('leaves a three-scene document untouched — U-14', () => {
    const parsed = parseProject(
      JSON.parse(JSON.stringify(createProject(15))) as unknown,
    );

    expect(parsed.ok).toBe(true);
    expect(parsed.ok ? parsed.value.templateSettings.template : null).toBe(
      'three-scene',
    );
  });
});
