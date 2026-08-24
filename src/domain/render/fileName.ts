// Design Ref: §4.5 Output Naming —
// `{project}_{template}_{locale}_{ratio}_{duration}s_{fps}fps.mp4`. This ordering
// supersedes the provisional ordering in Plan FR-22.
//
// day1-quad Design §4.2 added the template segment: Day1 and Day1-quad produce
// the same resolutions and locales, so without it two runs of the same project
// name were indistinguishable on disk. It sits right after the project name
// because the template is a higher-level split than ratio or locale.
import {RATIO_FILE_SEGMENT, type TemplateKind} from '../editor/types';
import type {EditorRenderConfig} from './types';

const FALLBACK_PROJECT_NAME = 'ua-video';

/** Short, filename-safe tag per template. day1-quad Design §4.2. */
export const TEMPLATE_FILE_SEGMENT: Record<TemplateKind, string> = {
  'three-scene': '3scene',
  day1: 'day1',
  'day1-quad': 'day1x4',
  'kv-loop': 'kvloop',
};

export const sanitizeProjectName = (projectName: string) =>
  projectName
    .trim()
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '') || FALLBACK_PROJECT_NAME;

export const buildOutputFileName = (
  projectName: string,
  config: EditorRenderConfig,
  /** Appended only when the caller detected a collision. */
  collisionSuffix?: string,
) => {
  const segments = [
    sanitizeProjectName(projectName),
    TEMPLATE_FILE_SEGMENT[config.template],
    config.locale,
    RATIO_FILE_SEGMENT[config.ratio],
    `${config.durationPreset}s`,
    `${config.fps}fps`,
  ];

  if (collisionSuffix) {
    segments.push(collisionSuffix);
  }

  return `${segments.join('_')}.mp4`;
};
