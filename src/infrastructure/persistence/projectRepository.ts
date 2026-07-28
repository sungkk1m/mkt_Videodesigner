// Design Ref: §4.1 ProjectRepository and §3.6 IndexedDB `projects` — stored
// documents are validated on the way out so a corrupted or hand-edited record
// can never enter the editor as a valid project.
import {parseProject} from '../../domain/editor/project';
import type {EditorProject} from '../../domain/editor/types';
import type {
  ProjectRepository,
  StoredProjectSummary,
} from '../../domain/ports';
import {
  createAppError,
  fail,
  ok,
  type Result,
} from '../../shared/errors/appError';
import {PROJECT_STORE, idbDelete, idbGet, idbGetAll, idbPut} from './idb';

interface ProjectRecord {
  id: string;
  name: string;
  updatedAt: string;
  sourceName: string | null;
  project: EditorProject;
}

const storageError = (action: string, cause: unknown) =>
  createAppError(
    'AUTOSAVE_FAILED',
    `프로젝트를 ${action}하지 못했습니다. 브라우저 저장 공간을 확인하거나 JSON으로 내보내세요.`,
    {
      action: {label: '다시 시도', target: 'retry'},
      retryable: true,
      cause,
    },
  );

const toRecord = (project: EditorProject): ProjectRecord => ({
  id: project.id,
  name: project.name,
  updatedAt: project.updatedAt,
  sourceName: project.source?.name ?? null,
  project,
});

export const createProjectRepository = (): ProjectRepository => ({
  save: async (project) => {
    try {
      await idbPut(PROJECT_STORE, toRecord(project));

      return ok(undefined);
    } catch (cause) {
      return fail(storageError('저장', cause));
    }
  },

  load: async (id) => {
    let record: ProjectRecord | undefined;

    try {
      record = await idbGet<ProjectRecord>(PROJECT_STORE, id);
    } catch (cause) {
      return fail(storageError('불러오기', cause));
    }

    if (!record) {
      return ok(null);
    }

    const parsed = parseProject(record.project);

    return parsed.ok ? ok(parsed.value) : parsed;
  },

  list: async () => {
    try {
      const records = await idbGetAll<ProjectRecord>(PROJECT_STORE);
      const summaries: StoredProjectSummary[] = records
        .map(({id, name, updatedAt, sourceName}) => ({
          id,
          name,
          updatedAt,
          sourceName,
        }))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

      return ok(summaries);
    } catch (cause) {
      return fail<StoredProjectSummary[]>(storageError('목록 조회', cause));
    }
  },

  delete: async (id) => {
    try {
      await idbDelete(PROJECT_STORE, id);

      return ok(undefined);
    } catch (cause) {
      return fail(storageError('삭제', cause));
    }
  },
});

/** Most recently updated stored project, or null when storage is empty. */
export const loadLatestProject = async (
  repository: ProjectRepository,
): Promise<Result<EditorProject | null>> => {
  const summaries = await repository.list();

  if (!summaries.ok) {
    return fail(summaries.error);
  }

  const latest = summaries.value[0];

  return latest ? repository.load(latest.id) : ok(null);
};
