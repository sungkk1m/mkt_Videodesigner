import {describe, expect, it} from 'vitest';

import {
  DEFAULT_DAY1_SETTINGS,
  applyDurationPreset,
  createProject,
  moveTimelineBoundary,
  parseProject,
  setRenderFps,
  setRenderProfile,
} from './project';
import {EDITOR_FPS} from './types';
import {sectionDurations} from '../../test/fixtures/project';

describe('createProject', () => {
  it('starts as a 15-second 30fps Day1 project with the approved defaults', () => {
    const project = createProject();

    // day1-render-fps U-01 — both fps fields start at the 30fps default.
    expect(project.fps).toBe(30);
    expect(project.fps).toBe(EDITOR_FPS);
    expect(project.render.fps).toBe(EDITOR_FPS);
    expect(project.templateSettings).toEqual(DEFAULT_DAY1_SETTINGS);
    expect(project.sections.map((section) => section.id)).toEqual([
      'panel-a',
      'panel-b',
      'endcard',
    ]);
    // Day1 Design Ref: §1.2 — the panels split what the end card leaves.
    expect(sectionDurations(project)).toEqual([6000, 6000, 3000]);
  });

  it('produces a document the schema accepts', () => {
    expect(parseProject(createProject(60)).ok).toBe(true);
  });
});

describe('applyDurationPreset', () => {
  it('reloads the template’s own section lengths', () => {
    const project = applyDurationPreset(createProject(15), 30);

    expect(project.durationPreset).toBe(30);
    expect(sectionDurations(project)).toEqual([13_500, 13_500, 3000]);
    expect(parseProject(project).ok).toBe(true);
  });
});

describe('moveTimelineBoundary', () => {
  it('keeps the total duration when a boundary moves', () => {
    const project = moveTimelineBoundary(createProject(15), 0, 5000);
    const total = sectionDurations(project).reduce(
      (sum, durationMs) => sum + durationMs,
      0,
    );

    expect(sectionDurations(project)).toEqual([5000, 7000, 3000]);
    expect(total).toBe(15_000);
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
