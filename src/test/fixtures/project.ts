// Day1 Design Ref: §3.2 — `scenes` and `source` moved under `templateSettings`
// in schema v2. Tests that only ever build three-scene projects narrow through
// these helpers instead of repeating the discriminant check.
import type {EditorProject, ThreeSceneSettings} from '../../domain/editor/types';

export const scenesOf = (project: EditorProject): ThreeSceneSettings['scenes'] =>
  (project.templateSettings as ThreeSceneSettings).scenes;

export const sourceOf = (project: EditorProject): ThreeSceneSettings['source'] =>
  (project.templateSettings as ThreeSceneSettings).source;

/** Section durations, which schema v2 moved off the individual scenes. */
export const sectionDurations = (project: EditorProject): number[] =>
  project.sections.map((section) => section.durationMs);
