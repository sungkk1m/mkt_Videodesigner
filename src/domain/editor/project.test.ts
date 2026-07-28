import {describe, expect, it} from 'vitest';

import {
  activeTransform,
  applyDurationPreset,
  applySourceToAllScenes,
  buildCompositionProps,
  createProject,
  moveTimelineBoundary,
  resetSceneTransform,
  scenesShorterThanSource,
  setSceneTrimInMs,
  setSceneTrimOutMs,
  updateSceneTransform,
} from './project';
import {EDITOR_FPS} from './types';
import {
  TEST_SOURCE_URL,
  testMediaReference,
  testUrlResolver,
} from '../../test/fixtures/media';

const source = testMediaReference();

const withSource = (durationMs = source.durationMs) =>
  applySourceToAllScenes(createProject(15), {...source, durationMs});

describe('createProject', () => {
  it('starts as a 15-second 60fps project with the approved scene defaults', () => {
    const project = createProject();

    expect(project.fps).toBe(EDITOR_FPS);
    expect(project.scenes.map((scene) => scene.kind)).toEqual([
      'hook',
      'gameplay',
      'cta',
    ]);
    expect(project.scenes.map((scene) => scene.durationMs)).toEqual([
      2000, 10000, 3000,
    ]);
    expect(project.source).toBeNull();
  });
});

describe('applySourceToAllScenes', () => {
  it('gives all three scenes a source interval from the uploaded footage', () => {
    const project = withSource();

    expect(project.source?.name).toBe('gameplay.mp4');
    expect(project.scenes.map((scene) => scene.trim)).toEqual([
      {inMs: 0, outMs: 2000},
      {inMs: 0, outMs: 10000},
      {inMs: 0, outMs: 3000},
    ]);
  });

  it('resets previously adjusted trims when the footage is re-applied', () => {
    const edited = setSceneTrimInMs(withSource(), 'gameplay', 8000);

    expect(edited.scenes[1].trim.inMs).toBe(8000);
    expect(
      applySourceToAllScenes(edited, source).scenes[1].trim.inMs,
    ).toBe(0);
  });
});

describe('applyDurationPreset', () => {
  it('reloads the approved defaults and re-clamps trims', () => {
    const project = applyDurationPreset(
      setSceneTrimInMs(withSource(), 'gameplay', 18000),
      30,
    );

    expect(project.scenes.map((scene) => scene.durationMs)).toEqual([
      3000, 24000, 3000,
    ]);
    expect(project.scenes[1].trim).toEqual({inMs: 0, outMs: 24000});
  });
});

describe('moveTimelineBoundary', () => {
  it('keeps the total duration and grows the trim window with the scene', () => {
    const project = moveTimelineBoundary(withSource(), 0, 5000);
    const total = project.scenes.reduce(
      (sum, scene) => sum + scene.durationMs,
      0,
    );

    expect(project.scenes.map((scene) => scene.durationMs)).toEqual([
      5000, 7000, 3000,
    ]);
    expect(total).toBe(15_000);
    expect(project.scenes[0].trim).toEqual({inMs: 0, outMs: 5000});
  });

  it('pulls the trim in point back when the scene no longer fits the source', () => {
    const project = setSceneTrimInMs(withSource(), 'gameplay', 22_000);
    expect(project.scenes[1].trim).toEqual({inMs: 20_000, outMs: 30_000});

    const widened = moveTimelineBoundary(project, 1, 14_000);

    expect(widened.scenes[1].durationMs).toBe(12_000);
    expect(widened.scenes[1].trim).toEqual({inMs: 18_000, outMs: 30_000});
  });
});

describe('scene trim commands', () => {
  it('clamps a trim in point to the end of the source', () => {
    const project = setSceneTrimInMs(withSource(), 'hook', 999_999);

    expect(project.scenes[0].trim).toEqual({inMs: 28_000, outMs: 30_000});
  });

  it('moves the interval when the out point is edited', () => {
    const project = setSceneTrimOutMs(withSource(), 'gameplay', 25_000);

    expect(project.scenes[1].trim).toEqual({inMs: 15_000, outMs: 25_000});
  });

  it('flags scenes whose source window is shorter than the scene', () => {
    const project = withSource(4000);

    expect(scenesShorterThanSource(project).map((scene) => scene.kind)).toEqual([
      'gameplay',
    ]);
    expect(project.scenes[1].trim).toEqual({inMs: 0, outMs: 4000});
  });
});

describe('scene transform commands', () => {
  it('clamps scale and offsets to the supported range', () => {
    const project = updateSceneTransform(withSource(), 'hook', '9:16', {
      scale: 99,
      x: -400,
      y: 12,
    });

    expect(activeTransform(project.scenes[0], '9:16')).toEqual({
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

    expect(activeTransform(project.scenes[2], '9:16')).toEqual({
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
    expect(props.scenes.map((scene) => scene.fromFrame)).toEqual([0, 120, 720]);
    expect(props.scenes.map((scene) => scene.durationInFrames)).toEqual([
      120, 600, 180,
    ]);
    expect(
      props.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0),
    ).toBe(900);
  });

  it('converts the source interval into trim frames', () => {
    const props = buildCompositionProps(
      setSceneTrimInMs(withSource(), 'gameplay', 12_000),
      testUrlResolver(),
    );

    expect(props.scenes[1]).toMatchObject({
      trimBeforeFrames: 720,
      trimAfterFrames: 1320,
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
