import {describe, expect, it} from 'vitest';

import {testMediaReference} from '../../test/fixtures/media';
import {createProject, parseProject, threeSceneOf} from './project';
import type {EditorProject, ThreeSceneSettings} from './types';

const valid = (): EditorProject => createProject(15);

/** Every test here builds a three-scene project, so narrowing is unconditional. */
const scenesOf = (project: EditorProject) =>
  (project.templateSettings as ThreeSceneSettings).scenes;

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
    const result = parseProject({...valid(), schemaVersion: 3});

    expect(result).toMatchObject({ok: false, error: {code: 'PROJECT_INVALID'}});
  });

  it('rejects section durations that do not add up to the preset', () => {
    const project = valid();
    project.sections[0].durationMs = 5000;

    expect(issuePaths(project)).toContain('sections');
  });

  it('rejects a section shorter than one second', () => {
    const project = valid();
    project.sections[0].durationMs = 500;
    project.sections[1].durationMs = 11500;

    expect(issuePaths(project)).toContain('sections.0.durationMs');
  });

  it('rejects section ids that do not match the template order', () => {
    const project = valid();
    project.sections[0].id = 'cta';

    expect(issuePaths(project)).toContain('sections.0.id');
  });

  it('rejects a reordered scene list', () => {
    const project = valid();
    scenesOf(project)[0].kind = 'cta';

    expect(issuePaths(project)).toContain('templateSettings.scenes.0.kind');
  });

  it('rejects a transform outside the supported range', () => {
    const project = valid();
    scenesOf(project)[1].transforms.base.scale = 12;

    expect(issuePaths(project)).toContain(
      'templateSettings.scenes.1.transforms.base.scale',
    );
  });

  it('rejects a trim window that leaves the source', () => {
    const project = valid();
    const settings = threeSceneOf(project) as ThreeSceneSettings;
    settings.source = testMediaReference({durationMs: 5000});
    settings.scenes[1].trim = {inMs: 0, outMs: 9000};

    expect(issuePaths(project)).toContain(
      'templateSettings.scenes.1.trim.outMs',
    );
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

/**
 * Day1 Design Ref: §3.2 and §3.5. The Day1 payload is only reachable through a
 * hand-written document until module 5 adds the template selector, so the
 * schema is the one thing standing between such a document and the editor.
 */
describe('parseProject — Day1 payload', () => {
  const day1Project = (): EditorProject => {
    const base = valid();

    return {
      ...base,
      sections: [
        {id: 'panel-a', label: '패널 A', durationMs: 6000},
        {id: 'panel-b', label: '패널 B', durationMs: 6000},
        {id: 'endcard', label: '엔드카드', durationMs: 3000},
      ],
      templateSettings: {
        template: 'day1',
        panelA: {
          source: null,
          trim: {inMs: 0, outMs: 0},
          transforms: {base: {fit: 'cover', scale: 1, x: 0, y: 0}, overrides: {}},
        },
        panelB: {
          source: null,
          trim: {inMs: 0, outMs: 0},
          transforms: {base: {fit: 'cover', scale: 1, x: 0, y: 0}, overrides: {}},
        },
        split: {lineColor: '#9ca3af', lineWidthPx: 6},
        labelStyle: {
          fontSize: 64,
          textColor: '#ffffff',
          outlineColor: '#000000',
          outlineWidthPx: 8,
          position: 'center',
        },
        endCard: {
          banner: null,
          appIcon: null,
          iconAdjust: {dx: 0, dy: 0, scale: 1},
          iconAnimation: 'pop',
          cardMotion: 'ken-burns',
        },
      },
    };
  };

  it('accepts a well-formed Day1 project', () => {
    expect(parseProject(day1Project()).ok).toBe(true);
  });

  it('accepts a Day1 project with no panel sources yet', () => {
    // FR-D03 is a render preflight gate, not a schema rule — a half-uploaded
    // project still has to save.
    const project = day1Project();

    expect(parseProject(project).ok).toBe(true);
  });

  it('rejects three-scene section ids on a Day1 project', () => {
    const project = day1Project();
    project.sections[0].id = 'hook';

    expect(issuePaths(project)).toContain('sections.0.id');
  });

  it('rejects a split line colour that is not a hex value', () => {
    const project = day1Project();
    (
      project.templateSettings as Extract<
        EditorProject['templateSettings'],
        {template: 'day1'}
      >
    ).split.lineColor = 'skyblue';

    expect(issuePaths(project)).toContain(
      'templateSettings.split.lineColor',
    );
  });

  it('rejects a panel trim that leaves its own source', () => {
    const project = day1Project();
    const settings = project.templateSettings as Extract<
      EditorProject['templateSettings'],
      {template: 'day1'}
    >;
    settings.panelA.source = testMediaReference({durationMs: 5000});
    settings.panelA.trim = {inMs: 0, outMs: 9000};

    expect(issuePaths(project)).toContain(
      'templateSettings.panelA.trim.outMs',
    );
  });
});
