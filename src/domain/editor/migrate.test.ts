// The three-scene template is gone, so the documents that carried one no longer
// open. The v1 fixture is a real pre-v2 document, kept as the regression case
// for the rejection: it must fail with a message that names the reason, and it
// must fail without the caller having to touch the original.
import {describe, expect, it} from 'vitest';

import v1File from '../../../tests/fixtures/project-v1.json';
import {migrateProject} from './migrate';
import {createProject, switchTemplate} from './project';

const v1Project = () =>
  structuredClone(v1File.project) as Record<string, unknown> & {
    scenes: Array<Record<string, unknown>>;
  };

describe('migrateProject — a three-scene document', () => {
  it('rejects a v1 document, which was always three-scene', () => {
    expect(migrateProject(v1Project())).toMatchObject({
      ok: false,
      error: {
        code: 'SCHEMA_UNSUPPORTED',
        retryable: false,
        details: {schemaVersion: 1, template: 'three-scene'},
      },
    });
  });

  it('rejects a v2 document whose payload is three-scene', () => {
    const stored = {
      ...createProject(30),
      templateSettings: {template: 'three-scene', source: null, scenes: []},
    };

    expect(migrateProject(stored)).toMatchObject({
      ok: false,
      error: {
        code: 'SCHEMA_UNSUPPORTED',
        details: {schemaVersion: 2, template: 'three-scene'},
      },
    });
  });

  // The point of the dedicated arm: a removed template is not a corrupt file,
  // so the operator gets a sentence instead of a field-by-field schema dump.
  it('says why rather than reporting a list of schema violations', () => {
    const result = migrateProject(v1Project());

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error.message).toContain(
      '3장면 템플릿은 더 이상 지원하지 않습니다',
    );
  });

  it('never mutates the document it rejects', () => {
    const document = v1Project();
    const before = structuredClone(document);

    migrateProject(document);

    expect(document).toEqual(before);
  });
});

describe('migrateProject — other versions', () => {
  it('validates a v2 document without changing it', () => {
    const project = createProject(30);
    const result = migrateProject(project);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual(project);
  });

  it('opens every template the editor still has', () => {
    for (const template of ['day1', 'day1-quad', 'kv-loop'] as const) {
      const project = switchTemplate(createProject(15), template);

      expect(migrateProject(project).ok).toBe(true);
    }
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

  it('reports a corrupt v2 document as invalid instead of throwing', () => {
    const broken = {...createProject(15), sections: 'not an array'};

    expect(migrateProject(broken)).toMatchObject({
      ok: false,
      error: {code: 'PROJECT_INVALID'},
    });
  });
});
