// Day1 Design Ref: §3.6 — every stored or imported document passes through here
// before it becomes an `EditorProject`, so v1 records keep opening after the
// v2 split into `sections` + `templateSettings`.
//
// Plan SC3: existing three-scene projects must open and render with no
// regression. Plan risk 1: a failed migration must never destroy the original,
// so this module only ever reads — the caller decides what to do with a failure.
import {
  createAppError,
  fail,
  type Result,
} from '../../shared/errors/appError';
import {PROJECT_SCHEMA_VERSION, SCENE_LABELS, type EditorProject} from './types';
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
 * Splits a v1 document into the v2 shape. Field values are copied verbatim —
 * `durationMs` moves from each scene to its section and nothing else changes,
 * which is what makes the round trip lossless.
 *
 * Best-effort by design: anything malformed is passed through untouched so the
 * v2 schema produces the real diagnostic instead of this function throwing.
 */
const upgradeV1 = (input: Record<string, unknown>): Record<string, unknown> => {
  const {scenes, source, schemaVersion: _version, ...rest} = input;
  const list = Array.isArray(scenes) ? scenes : [];

  return {
    ...rest,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    sections: list.map((entry) => {
      const scene = isRecord(entry) ? entry : {};
      const kind = scene.kind;

      return {
        id: kind,
        label:
          typeof kind === 'string' && kind in SCENE_LABELS
            ? SCENE_LABELS[kind as keyof typeof SCENE_LABELS]
            : kind,
        durationMs: scene.durationMs,
      };
    }),
    templateSettings: {
      template: 'three-scene',
      source: source ?? null,
      scenes: list.map((entry) => {
        if (!isRecord(entry)) {
          return entry;
        }

        const {durationMs: _moved, ...settings} = entry;

        return settings;
      }),
    },
  };
};

/**
 * Reads a project of any supported schema version. v1 is upgraded in memory
 * first; v2 is validated as-is. Anything else fails with `SCHEMA_UNSUPPORTED`.
 */
export const migrateProject = (input: unknown): Result<EditorProject> => {
  if (!isRecord(input)) {
    return unsupported(undefined);
  }

  if (input.schemaVersion === PROJECT_SCHEMA_VERSION) {
    return parseProject(input);
  }

  if (input.schemaVersion === 1) {
    return parseProject(upgradeV1(input));
  }

  return unsupported(input.schemaVersion);
};
