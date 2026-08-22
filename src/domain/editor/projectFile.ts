// Design Ref: §3.6 "Project JSON — metadata and fingerprints only" and §7 —
// import is validated with a size limit, an envelope kind, a schema version, and
// enum bounds before it can replace the current project.
import {
  createAppError,
  fail,
  ok,
  type Result,
} from '../../shared/errors/appError';
import {PROJECT_SCHEMA_VERSION} from './constants';
import {migrateProject} from './migrate';
import type {EditorProject, KvLoopSettings} from './types';

export const PROJECT_FILE_KIND = 'mkt-videodesigner/project';

/** Metadata-only documents stay tiny; anything larger is not one of ours. */
export const MAX_PROJECT_FILE_BYTES = 1_000_000;

/**
 * Envelope versions this build can read. v1 files are upgraded by
 * `migrateProject`. Day1 Design Ref: §3.6.
 */
export const SUPPORTED_PROJECT_FILE_VERSIONS: readonly number[] = [
  1,
  PROJECT_SCHEMA_VERSION,
];

export interface ProjectFile {
  kind: typeof PROJECT_FILE_KIND;
  schemaVersion: number;
  exportedAt: string;
  project: EditorProject;
}

export const serializeProjectFile = (
  project: EditorProject,
  exportedAt: string = new Date().toISOString(),
): string =>
  JSON.stringify(
    {
      kind: PROJECT_FILE_KIND,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      exportedAt,
      project,
    } satisfies ProjectFile,
    null,
    2,
  );

export const projectFileName = (project: EditorProject) =>
  `${project.name.trim() || 'ua-video'}.uavideo.json`;

const invalid = (message: string, details?: Record<string, unknown>) =>
  fail<EditorProject>(
    createAppError('PROJECT_INVALID', message, {
      ...(details ? {details} : {}),
      action: {label: '문제 항목 보기', target: 'diagnostics'},
    }),
  );

/**
 * Imported media cannot resolve in a new session, so every source starts
 * missing and the relink flow owns restoring it. Design Ref: §3.6.
 */
const markSourceUnresolved = (project: EditorProject): EditorProject => {
  const settings = project.templateSettings;

  if (settings.template === 'three-scene') {
    return settings.source
      ? {
          ...project,
          templateSettings: {
            ...settings,
            source: {...settings.source, status: 'missing'},
          },
        }
      : project;
  }

  // key-visual-looping — the key visuals are this template's playback-critical
  // sources, so they follow the panel rule. The title overlay goes with them:
  // an imported PNG cannot resolve either, and leaving it marked available
  // would only move the discovery to render time.
  if (settings.template === 'kv-loop') {
    return {
      ...project,
      templateSettings: {
        ...settings,
        images: withMissingReferences(settings.images),
        title: {
          ...settings.title,
          images: withMissingReferences(settings.title.images),
        },
      },
    };
  }

  return {
    ...project,
    templateSettings: {
      ...settings,
      panelA: withMissingSource(settings.panelA),
      panelB: withMissingSource(settings.panelB),
      // Endcard-Video U-02 — the end-card video is playback-critical like the
      // panel sources, so it follows the same rule. (banner/appIcon predate
      // this cycle and keep their existing behaviour.)
      endCard: settings.endCard.video
        ? {
            ...settings.endCard,
            video: {...settings.endCard.video, status: 'missing'},
          }
        : settings.endCard,
    },
  };
};

/**
 * Marks every reference in a locale-keyed map missing, keeping the map's shape.
 * Handles both the per-locale key visual arrays and the single title per locale.
 */
const withMissingReferences = <
  TImages extends
    | KvLoopSettings['images']
    | KvLoopSettings['title']['images'],
>(
  images: TImages,
): TImages =>
  Object.fromEntries(
    Object.entries(images).map(([locale, value]) => [
      locale,
      Array.isArray(value)
        ? value.map((reference) =>
            reference ? {...reference, status: 'missing' as const} : null,
          )
        : value
          ? {...value, status: 'missing' as const}
          : value,
    ]),
  ) as TImages;

const withMissingSource = <TPanel extends {source: {status: string} | null}>(
  panel: TPanel,
): TPanel =>
  panel.source
    ? {...panel, source: {...panel.source, status: 'missing' as const}}
    : panel;

export const parseProjectFile = (text: string): Result<EditorProject> => {
  if (text.length > MAX_PROJECT_FILE_BYTES) {
    return invalid(
      `프로젝트 파일이 너무 큽니다. 최대 ${MAX_PROJECT_FILE_BYTES / 1000}KB까지 가져올 수 있습니다.`,
      {byteLength: text.length},
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    return fail(
      createAppError('PROJECT_INVALID', 'JSON 형식이 올바르지 않습니다.', {
        action: {label: '문제 항목 보기', target: 'diagnostics'},
        cause,
      }),
    );
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return invalid('프로젝트 파일 구조가 올바르지 않습니다.');
  }

  const envelope = parsed as Partial<ProjectFile>;

  if (envelope.kind !== PROJECT_FILE_KIND) {
    return invalid(
      'UA Video Designer 프로젝트 파일이 아닙니다. 내보내기로 만든 .uavideo.json을 선택하세요.',
      {kind: envelope.kind},
    );
  }

  if (
    envelope.schemaVersion === undefined ||
    !SUPPORTED_PROJECT_FILE_VERSIONS.includes(envelope.schemaVersion)
  ) {
    return invalid(
      `지원하지 않는 프로젝트 버전입니다. 이 앱은 버전 ${SUPPORTED_PROJECT_FILE_VERSIONS.join(', ')}을 가져올 수 있습니다.`,
      {schemaVersion: envelope.schemaVersion},
    );
  }

  // Day1 Design Ref: §3.6 — the second migration entry point.
  const result = migrateProject(envelope.project);

  return result.ok ? ok(markSourceUnresolved(result.value)) : result;
};
