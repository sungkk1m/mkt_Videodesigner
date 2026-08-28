// Day1 Design Ref: §3.2 — the payload lives under `templateSettings`. Tests that
// only ever build one template's project narrow through these helpers instead of
// repeating the discriminant check.
import {createProject, switchTemplate} from '../../domain/editor/project';
import {
  type Day1QuadSettings,
  type Day1Settings,
  type DurationPreset,
  type EditorProject,
  type KvLoopSettings,
} from '../../domain/editor/types';

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

export const day1QuadSettingsOf = (
  project: EditorProject,
): Day1QuadSettings => project.templateSettings as Day1QuadSettings;

/** day1-quad Design §9.1 — built through the real command, like the Day1 one. */
export const day1QuadProjectFixture = (
  settings: Partial<Day1QuadSettings> = {},
  preset: DurationPreset = 15,
): EditorProject => {
  const base = switchTemplate(createProject(preset), 'day1-quad');

  return {
    ...base,
    templateSettings: {...day1QuadSettingsOf(base), ...settings},
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
