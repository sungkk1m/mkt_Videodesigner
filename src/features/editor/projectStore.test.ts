import {beforeEach, describe, expect, it} from 'vitest';

import {
  activeTransform,
  createProject,
  parseProject,
} from '../../domain/editor/project';
import {testMediaReference} from '../../test/fixtures/media';
import {useProjectStore} from './projectStore';
import {scenesOf, sourceOf} from '../../test/fixtures/project';

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

    expect(sourceOf(store().project)?.id).toBe('media_second');
    expect(sourceOf(store().project)?.name).toBe('second.mp4');
  });

  it('resets trims when the same source is re-applied', () => {
    store().applySource(source);
    store().setTrimIn('gameplay', 9000);
    expect(scenesOf(store().project)[1].trim.inMs).toBe(9000);

    store().reapplySource();

    expect(scenesOf(store().project)[1].trim.inMs).toBe(0);
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

    expect(activeTransform(scenesOf(store().project)[2], '9:16')).toEqual({
      fit: 'cover',
      scale: 1,
      x: 0,
      y: 0,
    });
  });
});

describe('projectStore — the looping template', () => {
  const kvImage = (name: string) =>
    testMediaReference({
      id: `media_${name}`,
      kind: 'image' as const,
      mimeType: 'image/png',
      durationMs: undefined,
    });

  it('stays schema-valid through a whole looping session', () => {
    store().switchTemplate('kv-loop');
    store().setKvImage(0, kvImage('a'));
    store().setKvImage(1, kvImage('b'));
    store().setKvCount(3);
    store().setKvLoopCount(1);
    store().moveKvImage(0, 2);
    store().setKvTransform(0, {scale: 1.2, fit: 'contain'});
    store().setKvMotion(1, {kind: 'preset', preset: 'still'});
    store().setKvDefaultMotion({kind: 'preset', preset: 'panTopToBottom'});
    store().setKvLoop({kenBurnsIntensity: 0.8, transitionMs: 250, fadeOutMs: 0});
    store().setKvTitle('ko', kvImage('title'));
    store().setKvTitleTransform({y: -20});
    store().setKvDisclaimerStyle({fontSize: 36});
    store().setCopy('kvLoopDisclaimer', '확률형 아이템 포함');
    store().moveBoundary(0, 5000);

    const result = parseProject(store().project);

    expect(result.ok).toBe(true);
    expect(store().project.sections).toHaveLength(3);
    expect(store().project.selectedRatio).toBe('9:16');
  });

  it('follows the header locale for key visuals, like copy does', () => {
    store().switchTemplate('kv-loop');
    store().setLocale('ja');
    store().setKvImage(0, kvImage('ja-1'));

    const settings = store().project.templateSettings;

    expect(settings.template === 'kv-loop' && settings.images.ja?.[0]?.id).toBe(
      'media_ja-1',
    );
    expect(settings.template === 'kv-loop' && settings.images.ko).toBeUndefined();
  });

  it('leaves the project alone when a combination does not fit', () => {
    store().switchTemplate('kv-loop');

    const before = store().project;

    store().setKvCount(8);

    expect(store().project).toBe(before);
  });
});
