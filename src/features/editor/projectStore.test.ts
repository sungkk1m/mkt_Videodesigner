import {beforeEach, describe, expect, it} from 'vitest';

import {
  activeTransform,
  createProject,
  parseProject,
} from '../../domain/editor/project';
import {testMediaReference} from '../../test/fixtures/media';
import {useProjectStore} from './projectStore';

const source = testMediaReference();

const store = () => useProjectStore.getState();

beforeEach(() => {
  useProjectStore.setState({project: createProject(15)});
});

describe('projectStore', () => {
  it('starts from a schema-valid default project', () => {
    expect(parseProject(store().project).ok).toBe(true);
  });

  it('keeps the project schema-valid after every command', () => {
    store().applySource(source);
    store().setDurationPreset(30);
    store().moveBoundary(0, 6000);
    store().setTrimIn('gameplay', 4000);
    store().setTransform('hook', {scale: 1.4, x: -10, y: 5});
    store().rename('여름 이벤트');

    const result = parseProject(store().project);

    expect(result.ok).toBe(true);
    expect(store().project.name).toBe('여름 이벤트');
  });

  it('replaces the persisted source reference on a new upload', () => {
    store().applySource(source);
    store().applySource(
      testMediaReference({id: 'media_second', name: 'second.mp4'}),
    );

    expect(store().project.source?.id).toBe('media_second');
    expect(store().project.source?.name).toBe('second.mp4');
  });

  it('resets trims when the same source is re-applied', () => {
    store().applySource(source);
    store().setTrimIn('gameplay', 9000);
    expect(store().project.scenes[1].trim.inMs).toBe(9000);

    store().reapplySource();

    expect(store().project.scenes[1].trim.inMs).toBe(0);
  });

  it('ignores re-apply when no source is loaded', () => {
    const before = store().project;

    store().reapplySource();

    expect(store().project).toBe(before);
  });

  it('restores the default transform on reset', () => {
    store().applySource(source);
    store().setTransform('cta', {scale: 2.5, x: 30, y: -30});
    store().resetTransform('cta');

    expect(activeTransform(store().project.scenes[2], '9:16')).toEqual({
      fit: 'cover',
      scale: 1,
      x: 0,
      y: 0,
    });
  });
});
