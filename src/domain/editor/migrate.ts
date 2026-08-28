// Day1 Design Ref: §3.6 — every stored or imported document passes through here
// before it becomes an `EditorProject`.
//
// Plan risk 1: a failed migration must never destroy the original, so this
// module only ever reads — the caller decides what to do with a failure.
import {
  createAppError,
  fail,
  type Result,
} from '../../shared/errors/appError';
import {PROJECT_SCHEMA_VERSION, type EditorProject} from './types';
import {parseProject} from './project';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const unsupported = (schemaVersion: unknown) =>
  fail<EditorProject>(
    createAppError(
      'SCHEMA_UNSUPPORTED',
      '지원하지 않는 프로젝트 형식입니다. 원본은 그대로 두었습니다.',
      {
        details: {schemaVersion, supported: PROJECT_SCHEMA_VERSION},
        action: {label: '문제 항목 보기', target: 'diagnostics'},
      },
    ),
  );

/**
 * The three-scene template was removed, so a document that carries one can no
 * longer be opened. It fails here with its own message rather than falling into
 * `parseProject`, where the discriminated union would report an unreadable list
 * of per-field issues for a document that is not corrupt at all.
 *
 * v1 predates the `sections` + `templateSettings` split and only ever described
 * a three-scene project, so it takes the same exit.
 */
const threeSceneRemoved = (schemaVersion: unknown) =>
  fail<EditorProject>(
    createAppError(
      'SCHEMA_UNSUPPORTED',
      '3장면 템플릿은 더 이상 지원하지 않습니다. 이 프로젝트는 열 수 없으며, 원본은 그대로 두었습니다.',
      {
        details: {schemaVersion, template: 'three-scene'},
        action: {label: '문제 항목 보기', target: 'diagnostics'},
      },
    ),
  );

const isThreeScene = (input: Record<string, unknown>) => {
  const settings = input.templateSettings;

  return isRecord(settings) && settings.template === 'three-scene';
};

/**
 * Reads a project of any supported schema version. Anything else — an older
 * version, or a three-scene payload — fails without touching the input.
 */
export const migrateProject = (input: unknown): Result<EditorProject> => {
  if (!isRecord(input)) {
    return unsupported(undefined);
  }

  if (input.schemaVersion === 1) {
    return threeSceneRemoved(1);
  }

  if (input.schemaVersion === PROJECT_SCHEMA_VERSION) {
    return isThreeScene(input)
      ? threeSceneRemoved(PROJECT_SCHEMA_VERSION)
      : parseProject(input);
  }

  return unsupported(input.schemaVersion);
};
