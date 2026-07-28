// Plan SC3 / Day1 Design Ref: §8.1 — the v1 fixture is a real pre-v2 document
// with every field populated, so a lossy migration shows up as a diff here
// rather than as silent data loss in a user's saved project.
import {describe, expect, it} from 'vitest';

import v1File from '../../../tests/fixtures/project-v1.json';
import {migrateProject} from './migrate';
import {createProject} from './project';
import type {EditorProject, ThreeSceneSettings} from './types';

const v1Project = () =>
  structuredClone(v1File.project) as Record<string, unknown> & {
    scenes: Array<Record<string, unknown>>;
  };

const migrated = (): EditorProject => {
  const result = migrateProject(v1Project());

  if (!result.ok) {
    throw new Error(
      `migration failed: ${JSON.stringify(result.error.details ?? result.error.message)}`,
    );
  }

  return result.value;
};

const threeScene = (project: EditorProject) =>
  project.templateSettings as ThreeSceneSettings;

describe('migrateProject — v1 to v2', () => {
  it('upgrades a v1 document', () => {
    expect(migrateProject(v1Project()).ok).toBe(true);
  });

  it('stamps the current schema version', () => {
    expect(migrated().schemaVersion).toBe(2);
  });

  it('marks the document as a three-scene project', () => {
    expect(threeScene(migrated()).template).toBe('three-scene');
  });

  it('moves each scene duration onto its section, in order', () => {
    const project = migrated();

    expect(project.sections.map((section) => section.id)).toEqual([
      'hook',
      'gameplay',
      'cta',
    ]);
    expect(project.sections.map((section) => section.durationMs)).toEqual([
      2500, 9500, 3000,
    ]);
    expect(project.sections.map((section) => section.label)).toEqual([
      'Hook',
      'Gameplay',
      'CTA',
    ]);
  });

  it('carries every scene field across untouched, minus durationMs', () => {
    const before = v1Project();
    const after = threeScene(migrated()).scenes;

    before.scenes.forEach((scene, index) => {
      const {durationMs, ...expected} = scene;

      expect(durationMs).toBeTypeOf('number');
      expect(after[index]).toEqual(expected);
    });
  });

  it('carries the source under templateSettings', () => {
    expect(threeScene(migrated()).source).toEqual(v1Project().source);
  });

  it('leaves every other top-level field byte-identical', () => {
    const before = v1Project();
    const after = migrated();

    for (const key of [
      'id',
      'name',
      'createdAt',
      'updatedAt',
      'durationPreset',
      'fps',
      'copy',
      'audio',
      'render',
      'selectedLocale',
      'selectedRatio',
    ] as const) {
      expect(after[key]).toEqual(before[key]);
    }
  });

  it('drops the v1 top-level scenes and source keys', () => {
    const after = migrated() as unknown as Record<string, unknown>;

    expect(after.scenes).toBeUndefined();
    expect(after.source).toBeUndefined();
  });
});

describe('migrateProject — other versions', () => {
  it('validates a v2 document without changing it', () => {
    const project = createProject(30);
    const result = migrateProject(project);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual(project);
  });

  it('rejects an unknown schema version with SCHEMA_UNSUPPORTED', () => {
    const result = migrateProject({...v1Project(), schemaVersion: 99});

    expect(result).toMatchObject({
      ok: false,
      error: {code: 'SCHEMA_UNSUPPORTED', retryable: false},
    });
  });

  it('rejects a non-object document', () => {
    expect(migrateProject('not a project')).toMatchObject({
      ok: false,
      error: {code: 'SCHEMA_UNSUPPORTED'},
    });
    expect(migrateProject(null)).toMatchObject({ok: false});
    expect(migrateProject([])).toMatchObject({ok: false});
  });

  it('reports a corrupt v1 document as invalid instead of throwing', () => {
    const broken = v1Project();
    broken.scenes = 'not an array' as never;

    const result = migrateProject(broken);

    expect(result).toMatchObject({ok: false, error: {code: 'PROJECT_INVALID'}});
  });

  it('reports a v1 scene missing its duration as invalid', () => {
    const broken = v1Project();
    delete (broken.scenes[1] as Record<string, unknown>).durationMs;

    expect(migrateProject(broken)).toMatchObject({
      ok: false,
      error: {code: 'PROJECT_INVALID'},
    });
  });
});
