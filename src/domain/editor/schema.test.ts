import {describe, expect, it} from 'vitest';

import {testMediaReference} from '../../test/fixtures/media';
import {createProject, parseProject} from './project';
import type {EditorProject} from './types';

const valid = (): EditorProject => createProject(15);

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
    const result = parseProject({...valid(), schemaVersion: 2});

    expect(result).toMatchObject({ok: false, error: {code: 'PROJECT_INVALID'}});
  });

  it('rejects scene durations that do not add up to the preset', () => {
    const project = valid();
    project.scenes[0].durationMs = 5000;

    expect(issuePaths(project)).toContain('scenes');
  });

  it('rejects a scene shorter than one second', () => {
    const project = valid();
    project.scenes[0].durationMs = 500;
    project.scenes[1].durationMs = 11500;

    expect(issuePaths(project)).toContain('scenes.0.durationMs');
  });

  it('rejects a reordered scene list', () => {
    const project = valid();
    project.scenes[0].kind = 'cta';

    expect(issuePaths(project)).toContain('scenes.0.kind');
  });

  it('rejects a transform outside the supported range', () => {
    const project = valid();
    project.scenes[1].transforms.base.scale = 12;

    expect(issuePaths(project)).toContain('scenes.1.transforms.base.scale');
  });

  it('rejects a trim window that leaves the source', () => {
    const project: EditorProject = {
      ...valid(),
      source: testMediaReference({durationMs: 5000}),
    };
    project.scenes[1].trim = {inMs: 0, outMs: 9000};

    expect(issuePaths(project)).toContain('scenes.1.trim.outMs');
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
