import {beforeEach, describe, expect, it, vi} from 'vitest';

import {applySourceToAllScenes, createProject} from '../../domain/editor/project';
import {testMediaReference} from '../../test/fixtures/media';

const store = new Map<string, unknown>();
let failNextWrite = false;

vi.mock('./idb', () => ({
  PROJECT_STORE: 'projects',
  idbPut: async (_store: string, value: {id: string}) => {
    if (failNextWrite) {
      failNextWrite = false;
      throw new DOMException('quota', 'QuotaExceededError');
    }

    store.set(value.id, value);
  },
  idbGet: async (_store: string, key: string) => store.get(key),
  idbGetAll: async () => [...store.values()],
  idbDelete: async (_store: string, key: string) => {
    store.delete(key);
  },
}));

const {createProjectRepository, loadLatestProject} = await import(
  './projectRepository'
);

const repository = createProjectRepository();

const projectAt = (updatedAt: string, name: string) => ({
  ...applySourceToAllScenes(createProject(15), testMediaReference()),
  id: `project_${name}`,
  name,
  updatedAt,
});

beforeEach(() => {
  store.clear();
  failNextWrite = false;
});

describe('projectRepository', () => {
  it('round-trips a saved project through validation', async () => {
    const project = projectAt('2026-07-28T00:00:00.000Z', 'first');

    expect(await repository.save(project)).toEqual({ok: true, value: undefined});
    expect(await repository.load(project.id)).toEqual({ok: true, value: project});
  });

  it('returns null for an unknown project instead of failing', async () => {
    expect(await repository.load('project_missing')).toEqual({
      ok: true,
      value: null,
    });
  });

  it('rejects a stored record that no longer satisfies the schema', async () => {
    const project = projectAt('2026-07-28T00:00:00.000Z', 'broken');
    await repository.save(project);

    const record = store.get(project.id) as {project: {durationPreset: number}};
    record.project.durationPreset = 45;

    expect(await repository.load(project.id)).toMatchObject({
      ok: false,
      error: {code: 'PROJECT_INVALID'},
    });
  });

  it('lists summaries newest first', async () => {
    await repository.save(projectAt('2026-07-27T00:00:00.000Z', 'older'));
    await repository.save(projectAt('2026-07-28T00:00:00.000Z', 'newer'));

    const result = await repository.list();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((entry) => entry.name)).toEqual([
        'newer',
        'older',
      ]);
      expect(result.value[0]?.sourceName).toBe('gameplay.mp4');
    }
  });

  it('reports an actionable autosave failure when storage rejects a write', async () => {
    failNextWrite = true;

    const result = await repository.save(
      projectAt('2026-07-28T00:00:00.000Z', 'quota'),
    );

    expect(result).toMatchObject({
      ok: false,
      error: {code: 'AUTOSAVE_FAILED', retryable: true},
    });
  });

  it('deletes a stored project', async () => {
    const project = projectAt('2026-07-28T00:00:00.000Z', 'gone');
    await repository.save(project);
    await repository.delete(project.id);

    expect(await repository.load(project.id)).toEqual({ok: true, value: null});
  });
});

describe('loadLatestProject', () => {
  it('returns the most recently updated project', async () => {
    await repository.save(projectAt('2026-07-27T00:00:00.000Z', 'older'));
    await repository.save(projectAt('2026-07-28T00:00:00.000Z', 'newer'));

    const result = await loadLatestProject(repository);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value?.name).toBe('newer');
    }
  });

  it('returns null when nothing is stored yet', async () => {
    expect(await loadLatestProject(repository)).toEqual({ok: true, value: null});
  });
});
