// Day1 Design Ref: §3.2 — `scenes` and `source` moved under `templateSettings`
// in schema v2. Tests that only ever build three-scene projects narrow through
// these helpers instead of repeating the discriminant check.
import {createProject, switchTemplate} from '../../domain/editor/project';
import {
  type Day1Settings,
  type DurationPreset,
  type EditorProject,
  type KvLoopSettings,
  type ThreeSceneSettings,
} from '../../domain/editor/types';

export const scenesOf = (project: EditorProject): ThreeSceneSettings['scenes'] =>
  (project.templateSettings as ThreeSceneSettings).scenes;

export const sourceOf = (project: EditorProject): ThreeSceneSettings['source'] =>
  (project.templateSettings as ThreeSceneSettings).source;

/** Section durations, which schema v2 moved off the individual scenes. */
export const sectionDurations = (project: EditorProject): number[] =>
  project.sections.map((section) => section.durationMs);

export const day1SettingsOf = (project: EditorProject): Day1Settings =>
  project.templateSettings as Day1Settings;

/**
 * A valid Day1 project on top of the real `switchTemplate` command, so a fixture
 * can never drift from what the editor produces. Day1 Design Ref: §6.1.
 */
export const day1ProjectFixture = (
  settings: Partial<Day1Settings> = {},
  preset: DurationPreset = 15,
): EditorProject => {
  const base = switchTemplate(createProject(preset), 'day1');

  return {
    ...base,
    templateSettings: {...day1SettingsOf(base), ...settings},
  };
};

export const kvLoopSettingsOf = (project: EditorProject): KvLoopSettings =>
  project.templateSettings as KvLoopSettings;

/**
 * A valid looping project, built the way the editor builds one so the fixture
 * cannot drift from `switchTemplate`. key-visual-looping Design Ref: §6.1.
 */
export const kvLoopProjectFixture = (
  settings: Partial<KvLoopSettings> = {},
  preset: DurationPreset = 15,
): EditorProject => {
  const base = switchTemplate(createProject(preset), 'kv-loop');

  return {
    ...base,
    templateSettings: {...kvLoopSettingsOf(base), ...settings},
  };
};
