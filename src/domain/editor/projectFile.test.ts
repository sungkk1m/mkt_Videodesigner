import {describe, expect, it} from 'vitest';

import {testMediaReference} from '../../test/fixtures/media';
import {
  applySourceToAllScenes,
  createProject,
  setDay1EndCardVideo,
  switchTemplate,
  updateDay1EndCard,
} from './project';
import {
  MAX_PROJECT_FILE_BYTES,
  PROJECT_FILE_KIND,
  parseProjectFile,
  projectFileName,
  serializeProjectFile,
} from './projectFile';
import {scenesOf, sourceOf} from '../../test/fixtures/project';

const projectWithSource = () =>
  applySourceToAllScenes(createProject(30), testMediaReference());

describe('serializeProjectFile', () => {
  it('round-trips a project without losing data', () => {
    const project = projectWithSource();
    const result = parseProjectFile(serializeProjectFile(project));

    expect(result.ok).toBe(true);
    if (result.ok) {
      // The source cannot resolve in a new session, so it comes back missing.
      expect(result.value).toEqual({
        ...project,
        templateSettings: {
          ...project.templateSettings,
          source: {...testMediaReference(), status: 'missing'},
        },
      });
    }
  });

  it('round-trips the end-card video mode and trim (U-02)', () => {
    const project = updateDay1EndCard(
      setDay1EndCardVideo(
        switchTemplate(createProject(15), 'day1'),
        testMediaReference({id: 'ec', durationMs: 5000}),
      ),
      {mode: 'video'},
    );
    const result = parseProjectFile(serializeProjectFile(project));

    expect(result.ok).toBe(true);

    if (result.ok && result.value.templateSettings.template === 'day1') {
      const {endCard} = result.value.templateSettings;

      expect(endCard.mode).toBe('video');
      // Same rule as every reference: metadata survives, resolution does not.
      expect(endCard.video).toEqual({
        ...testMediaReference({id: 'ec', durationMs: 5000}),
        status: 'missing',
      });
      expect(endCard.videoTrim).toEqual({inMs: 0, outMs: 3000});
    }
  });

  it('embeds metadata and fingerprints but never media binaries', () => {
    const text = serializeProjectFile(projectWithSource());

    expect(text).toContain('sha256-test');
    expect(text).not.toContain('blob:');
    expect(text).not.toContain('base64');
    expect(text.length).toBeLessThan(MAX_PROJECT_FILE_BYTES);
  });

  it('names the export after the project', () => {
    expect(projectFileName({...createProject(15), name: '여름 이벤트'})).toBe(
      '여름 이벤트.uavideo.json',
    );
  });
});

describe('parseProjectFile', () => {
  it('rejects a file that is not a project export', () => {
    const result = parseProjectFile(JSON.stringify({kind: 'something-else'}));

    expect(result).toMatchObject({ok: false, error: {code: 'PROJECT_INVALID'}});
  });

  it('rejects an unsupported schema version', () => {
    const result = parseProjectFile(
      JSON.stringify({
        kind: PROJECT_FILE_KIND,
        schemaVersion: 99,
        project: createProject(15),
      }),
    );

    expect(result).toMatchObject({ok: false, error: {code: 'PROJECT_INVALID'}});
    if (!result.ok) {
      expect(result.error.message).toContain('버전');
    }
  });

  it('rejects malformed JSON without throwing', () => {
    expect(parseProjectFile('{not json')).toMatchObject({
      ok: false,
      error: {code: 'PROJECT_INVALID'},
    });
  });

  it('rejects a file above the import size limit', () => {
    const oversized = `${' '.repeat(MAX_PROJECT_FILE_BYTES + 1)}`;

    expect(parseProjectFile(oversized)).toMatchObject({
      ok: false,
      error: {code: 'PROJECT_INVALID'},
    });
  });

  it('rejects a project whose scenes break the timeline invariant', () => {
    const project = createProject(15);
    project.sections[0].durationMs = 9000;

    const result = parseProjectFile(
      serializeProjectFile(project),
    );

    expect(result).toMatchObject({ok: false, error: {code: 'PROJECT_INVALID'}});
  });
});
