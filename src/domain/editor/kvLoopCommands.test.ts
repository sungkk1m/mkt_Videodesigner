// key-visual-looping Design Ref: §8.1 — the schema arm (§3.2/§3.4) and the
// commands that produce a looping project (§11.3 module-2).
import {describe, expect, it} from 'vitest';

import {testMediaReference, testUrlResolver} from '../../test/fixtures/media';
import {kvLoopProjectFixture, kvLoopSettingsOf} from '../../test/fixtures/project';
import {
  applyDurationPreset,
  buildKvLoopProps,
  createProject,
  kvLoopOf,
  parseProject,
  switchTemplate,
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
    expect(props?.slots[0]).toMatchObject({
      fit: 'cover',
      scale: 1,
      x: 0,
      y: 0,
      kenBurns: true,
    });
  });

  it('renders with no title and no disclaimer — SC5', () => {
    const props = buildKvLoopProps(filled(), testUrlResolver());

    expect(props?.title.url).toBeNull();
    expect(props?.disclaimer.text).toBe('');
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

    expect(
      buildKvLoopProps(project, testUrlResolver())?.transitionInFrames,
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
});
