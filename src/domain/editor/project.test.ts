import {describe, expect, it} from 'vitest';

import {
  activeTransform,
  applyDurationPreset,
  applySourceToAllScenes,
  buildCompositionProps,
  createProject,
  isSceneShorterThanSection,
  moveTimelineBoundary,
  parseProject,
  resetSceneTransform,
  scenesShorterThanSection,
  setRenderFps,
  setRenderProfile,
  setSceneTrimInMs,
  updateCtaSettings,
  updateSceneTransform,
} from './project';
import {EDITOR_FPS} from './types';
import {
  TEST_SOURCE_URL,
  testMediaReference,
  testUrlResolver,
} from '../../test/fixtures/media';
import {
  scenesOf,
  sectionDurations,
  sourceOf,
} from '../../test/fixtures/project';

const source = testMediaReference();

const withSource = (durationMs = source.durationMs) =>
  applySourceToAllScenes(createProject(15), {...source, durationMs});

describe('createProject', () => {
  it('starts as a 15-second 30fps project with the approved scene defaults', () => {
    const project = createProject();

    // day1-render-fps U-01 — both fps fields start at the 30fps default.
    expect(project.fps).toBe(30);
    expect(project.fps).toBe(EDITOR_FPS);
    expect(project.render.fps).toBe(EDITOR_FPS);
    expect(scenesOf(project).map((scene) => scene.kind)).toEqual([
      'hook',
      'gameplay',
      'cta',
    ]);
    expect(sectionDurations(project)).toEqual([2000, 10000, 3000]);
    expect(project.sections.map((section) => section.id)).toEqual([
      'hook',
      'gameplay',
      'cta',
    ]);
    expect(sourceOf(project)).toBeNull();
  });
});

describe('applySourceToAllScenes', () => {
  it('gives all three scenes a source interval from the uploaded footage', () => {
    const project = withSource();

    expect(sourceOf(project)?.name).toBe('gameplay.mp4');
    expect(scenesOf(project).map((scene) => scene.trim)).toEqual([
      {inMs: 0, outMs: 2000},
      {inMs: 0, outMs: 10000},
      {inMs: 0, outMs: 3000},
    ]);
  });

  it('resets previously adjusted trims when the footage is re-applied', () => {
    const edited = setSceneTrimInMs(withSource(), 'gameplay', 8000);

    expect(scenesOf(edited)[1].trim.inMs).toBe(8000);
    expect(
      scenesOf(applySourceToAllScenes(edited, source))[1].trim.inMs,
    ).toBe(0);
  });
});

describe('applyDurationPreset', () => {
  it('reloads the approved defaults and re-clamps trims', () => {
    const project = applyDurationPreset(
      setSceneTrimInMs(withSource(), 'gameplay', 18000),
      30,
    );

    expect(sectionDurations(project)).toEqual([3000, 24000, 3000]);
    expect(scenesOf(project)[1].trim).toEqual({inMs: 0, outMs: 24000});
  });
});

describe('moveTimelineBoundary', () => {
  it('keeps the total duration and grows the trim window with the scene', () => {
    const project = moveTimelineBoundary(withSource(), 0, 5000);
    const total = sectionDurations(project).reduce(
      (sum, durationMs) => sum + durationMs,
      0,
    );

    expect(sectionDurations(project)).toEqual([5000, 7000, 3000]);
    expect(total).toBe(15_000);
    expect(scenesOf(project)[0].trim).toEqual({inMs: 0, outMs: 5000});
  });

  it('pulls the trim in point back when the scene no longer fits the source', () => {
    const project = setSceneTrimInMs(withSource(), 'gameplay', 22_000);
    expect(scenesOf(project)[1].trim).toEqual({inMs: 20_000, outMs: 30_000});

    const widened = moveTimelineBoundary(project, 1, 14_000);

    expect(widened.sections[1].durationMs).toBe(12_000);
    expect(scenesOf(widened)[1].trim).toEqual({inMs: 18_000, outMs: 30_000});
  });
});

describe('scene trim commands', () => {
  it('clamps a trim in point to the end of the source', () => {
    const project = setSceneTrimInMs(withSource(), 'hook', 999_999);

    expect(scenesOf(project)[0].trim).toEqual({inMs: 28_000, outMs: 30_000});
  });

  it('derives the out point from the in point and the section length', () => {
    const project = setSceneTrimInMs(withSource(), 'gameplay', 15_000);

    expect(scenesOf(project)[1].trim).toEqual({inMs: 15_000, outMs: 25_000});
  });
});

// Three-Scene Trim Parity FR-S01, FR-S02.
describe('scenesShorterThanSection', () => {
  const gameplayScene = () => scenesOf(withSource())[1];
  const ctaScene = () => scenesOf(withSource())[2];

  it('reports nothing while the project has no source at all', () => {
    // The missing source is the `영상 소재가 없습니다` preflight message's
    // concern, so this must not report the same problem a second time.
    expect(scenesShorterThanSection(createProject(15))).toEqual([]);
  });

  it('reports only the scenes the source cannot fill', () => {
    // 15s preset is [2s, 10s, 3s], so a 4s source runs out during gameplay only.
    expect(scenesShorterThanSection(withSource(4000))).toEqual(['gameplay']);
  });

  it('reports every scene when the source is shorter than all of them', () => {
    // The CTA is exempt by default (generated background), so it stays out.
    expect(scenesShorterThanSection(withSource(1000))).toEqual([
      'hook',
      'gameplay',
    ]);
  });

  it('reports nothing when the source fills every section', () => {
    expect(scenesShorterThanSection(withSource())).toEqual([]);
  });

  it('treats a section exactly as long as the source as filled', () => {
    expect(isSceneShorterThanSection(gameplayScene(), 10_000, 10_000)).toBe(
      false,
    );
  });

  it('ignores a scene with no source rather than calling it short', () => {
    expect(isSceneShorterThanSection(gameplayScene(), 0, 10_000)).toBe(false);
  });

  it('exempts a CTA that plays its own footage instead of the source', () => {
    const withCtaMedia = updateCtaSettings(withSource(1000), {
      media: {...source, id: 'cta-media'},
      useGeneratedBackground: false,
    });

    expect(scenesShorterThanSection(withCtaMedia)).toEqual([
      'hook',
      'gameplay',
    ]);
  });

  it('exempts a CTA whose background is generated from a frozen frame', () => {
    expect(
      isSceneShorterThanSection(ctaScene(), 1000, 3000),
    ).toBe(false);
  });

  it('flags a CTA that falls back to playing the shared source', () => {
    const plainCta = updateCtaSettings(withSource(1000), {
      useGeneratedBackground: false,
    });

    expect(scenesShorterThanSection(plainCta)).toEqual([
      'hook',
      'gameplay',
      'cta',
    ]);
  });

  it('applies the CTA exemption only to the CTA scene', () => {
    // `hook` and `gameplay` carry no `cta` field, so the exemption cannot reach
    // them however the CTA is configured.
    expect(isSceneShorterThanSection(gameplayScene(), 1000, 10_000)).toBe(true);
  });
});

describe('scene transform commands', () => {
  it('clamps scale and offsets to the supported range', () => {
    const project = updateSceneTransform(withSource(), 'hook', '9:16', {
      scale: 99,
      x: -400,
      y: 12,
    });

    expect(activeTransform(scenesOf(project)[0], '9:16')).toEqual({
      fit: 'cover',
      scale: 3,
      x: -50,
      y: 12,
    });
  });

  it('restores the default framing on reset', () => {
    const project = resetSceneTransform(
      updateSceneTransform(withSource(), 'cta', '9:16', {
        scale: 2,
        x: 20,
        y: -20,
      }),
      'cta',
      '9:16',
    );

    expect(activeTransform(scenesOf(project)[2], '9:16')).toEqual({
      fit: 'cover',
      scale: 1,
      x: 0,
      y: 0,
    });
  });
});

describe('buildCompositionProps', () => {
  it('maps scenes to contiguous frame ranges that fill the preset exactly', () => {
    const props = buildCompositionProps(withSource(), testUrlResolver());

    expect(props.src).toBe('blob:mock-url');
    expect(props.scenes.map((scene) => scene.fromFrame)).toEqual([0, 60, 360]);
    expect(props.scenes.map((scene) => scene.durationInFrames)).toEqual([
      60, 300, 90,
    ]);
    expect(
      props.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0),
    ).toBe(450);
  });

  it('converts the source interval into trim frames', () => {
    const props = buildCompositionProps(
      setSceneTrimInMs(withSource(), 'gameplay', 12_000),
      testUrlResolver(),
    );

    expect(props.scenes[1]).toMatchObject({
      trimBeforeFrames: 360,
      trimAfterFrames: 660,
    });
  });

  it('freezes the snapshot so a running render cannot be mutated', () => {
    const props = buildCompositionProps(withSource(), testUrlResolver());

    expect(Object.isFrozen(props)).toBe(true);
    expect(Object.isFrozen(props.scenes)).toBe(true);
    expect(Object.isFrozen(props.scenes[0])).toBe(true);
  });

  it('renders no scene source before an upload', () => {
    expect(buildCompositionProps(createProject(), testUrlResolver(null)).src).toBeNull();
  });
});

// day1-render-fps Design Ref: §3.1 — the header displays project.fps while
// writes go through setRenderFps, so the two fps fields must never diverge.
describe('render fps', () => {
  it('keeps project.fps and render.fps identical through any call order (U-03)', () => {
    let project = createProject();

    project = setRenderFps(project, 60);
    expect(project.fps).toBe(60);
    expect(project.render.fps).toBe(60);

    project = setRenderProfile(project, 'fast');
    expect(project.fps).toBe(project.render.fps);

    project = setRenderProfile(project, 'high');
    project = setRenderFps(project, 30);
    expect(project.fps).toBe(30);
    expect(project.render.fps).toBe(30);
  });

  it('clamps a frame rate the profile does not allow (U-04)', () => {
    const fast = setRenderProfile(createProject(), 'fast');

    // Fast is 30fps only, so a 60fps request must not stick.
    expect(setRenderFps(fast, 60).render.fps).toBe(30);
  });

  it('keeps a stored 60fps document at 60fps (U-06)', () => {
    // A saved project carries its own fps; the 30fps default is for new
    // projects only and must never rewrite an explicit choice (D-07).
    const saved = JSON.parse(JSON.stringify(setRenderFps(createProject(), 60)));
    const result = parseProject(saved);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.fps).toBe(60);
      expect(result.value.render.fps).toBe(60);
    }
  });
});
