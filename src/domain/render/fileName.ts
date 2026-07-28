// Design Ref: §4.5 Output Naming —
// `{project}_{locale}_{ratio}_{duration}s_{fps}fps.mp4`. This ordering supersedes
// the provisional ordering in Plan FR-22.
import {RATIO_FILE_SEGMENT} from '../editor/types';
import type {EditorRenderConfig} from './types';

const FALLBACK_PROJECT_NAME = 'ua-video';

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
