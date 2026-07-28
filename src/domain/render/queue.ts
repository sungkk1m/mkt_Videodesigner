// Design Ref: §2.2 "locale x ratio job expansion (max 12) -> sequential
// RenderQueue", §3.4 RenderJob, and §6.3 Queue Failure Policy.
import {
  ASPECT_RATIOS,
  LOCALES,
  MAX_BATCH_JOBS,
  type AspectRatio,
  type EditorProject,
  type Locale,
} from '../editor/types';
import type {AppError} from '../../shared/errors/appError';
import {buildOutputFileName} from './fileName';
import type {RenderProfile} from './profile';
import type {EditorRenderConfig} from './types';

export type RenderJobStatus =
  | 'queued'
  | 'preparing'
  | 'rendering'
  | 'saving'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface RenderJob {
  id: string;
  locale: Locale;
  ratio: AspectRatio;
  profile: RenderProfile;
  status: RenderJobStatus;
  progress: number;
  elapsedMs: number;
  estimatedRemainingMs: number | null;
  outputName: string;
  error?: AppError;
}

const orderedUnique = <TValue>(
  values: readonly TValue[],
  order: readonly TValue[],
) => order.filter((entry) => values.includes(entry));

/**
 * Expands the selected locales and ratios into unique sequential jobs in a stable
 * order. Never returns more than the §3.5 maximum.
 */
export const expandRenderJobs = (project: EditorProject): RenderJob[] => {
  const locales = orderedUnique(project.render.selectedLocales, LOCALES);
  const ratios = orderedUnique(project.render.selectedRatios, ASPECT_RATIOS);
  const jobs: RenderJob[] = [];

  for (const locale of locales) {
    for (const ratio of ratios) {
      if (jobs.length >= MAX_BATCH_JOBS) {
        return jobs;
      }

      const config: EditorRenderConfig = {
        durationPreset: project.durationPreset,
        fps: project.render.fps,
        ratio,
        locale,
        outputTarget: 'web-fs',
      };

      jobs.push({
        id: `job_${locale}_${ratio}`,
        locale,
        ratio,
        profile: project.render.profile,
        status: 'queued',
        progress: 0,
        elapsedMs: 0,
        estimatedRemainingMs: null,
        outputName: buildOutputFileName(
          project.render.filePrefix || project.name,
          config,
        ),
      });
    }
  }

  return jobs;
};

export const updateJob = (
  jobs: readonly RenderJob[],
  id: string,
  patch: Partial<RenderJob>,
): RenderJob[] =>
  jobs.map((job) => (job.id === id ? {...job, ...patch} : job));

export const nextQueuedJob = (jobs: readonly RenderJob[]) =>
  jobs.find((job) => job.status === 'queued') ?? null;

/**
 * Design Ref: §6.3 — "Completed files are never recreated on retry failed."
 * Only failed jobs return to the queue.
 */
export const requeueFailedJobs = (jobs: readonly RenderJob[]): RenderJob[] =>
  jobs.map((job) =>
    job.status === 'failed' || job.status === 'cancelled'
      ? {
          ...job,
          status: 'queued' as const,
          progress: 0,
          elapsedMs: 0,
          estimatedRemainingMs: null,
          error: undefined,
        }
      : job,
  );

/**
 * Design Ref: §6.3 — cancelling marks every unstarted job cancelled and preserves
 * completed outputs.
 */
export const cancelPendingJobs = (jobs: readonly RenderJob[]): RenderJob[] =>
  jobs.map((job) =>
    job.status === 'queued' || job.status === 'rendering' || job.status === 'preparing'
      ? {...job, status: 'cancelled' as const, estimatedRemainingMs: null}
      : job,
  );

export interface QueueSummary {
  total: number;
  completed: number;
  failed: number;
  remaining: number;
  done: boolean;
}

export const summarizeQueue = (jobs: readonly RenderJob[]): QueueSummary => {
  const completed = jobs.filter((job) => job.status === 'completed').length;
  const failed = jobs.filter((job) => job.status === 'failed').length;
  const remaining = jobs.filter(
    (job) => job.status === 'queued' || job.status === 'rendering',
  ).length;

  return {
    total: jobs.length,
    completed,
    failed,
    remaining,
    done: remaining === 0,
  };
};
