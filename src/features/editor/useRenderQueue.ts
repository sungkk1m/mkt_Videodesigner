// Design Ref: §2.2 sequential RenderQueue, §5.5 Batch queue, §6.3 Queue Failure
// Policy. One job renders at a time, its output is written before the next job
// starts, and a failure never stops the queue.
import {useCallback, useRef, useState} from 'react';

import {
  buildEditorSnapshot,
  day1MissingPanels,
  day1PanelsShorterThanSection,
  threeSceneOf,
  type Day1PanelKey,
} from '../../domain/editor/project';
import {narrationBlockers} from '../../domain/audio/mix';
import type {
  EditorProject,
  MediaReference,
} from '../../domain/editor/types';
import type {OutputWriter, VideoRenderer} from '../../domain/ports';
import {
  cancelPendingJobs,
  expandRenderJobs,
  nextQueuedJob,
  requeueFailedJobs,
  summarizeQueue,
  updateJob,
  type RenderJob,
} from '../../domain/render/queue';
import type {EditorRenderConfig} from '../../domain/render/types';
import {
  createAppError,
  isAppError,
  type AppError,
} from '../../shared/errors/appError';

export interface PreflightContext {
  sourceResolved: boolean;
  rendererReady: boolean;
}

export interface RenderQueueApi {
  jobs: RenderJob[];
  running: boolean;
  notice: AppError | null;
  preflight: string[];
  start: (
    project: EditorProject,
    context: PreflightContext,
  ) => Promise<void>;
  cancel: () => void;
  retryFailed: (project: EditorProject) => Promise<void>;
  clear: () => void;
}

const toAppError = (error: unknown): AppError =>
  isAppError(error)
    ? error
    : createAppError(
        'RENDER_FAILED',
        error instanceof Error
          ? `렌더에 실패했습니다: ${error.message}`
          : '렌더에 실패했습니다.',
        {action: {label: '실패 항목 재시도', target: 'retry'}, retryable: true},
      );

const DAY1_PANEL_LABEL: Record<Day1PanelKey, string> = {
  panelA: 'A',
  panelB: 'B',
};

/**
 * Design Ref: §5.5 Preflight list — every blocking condition is reported before a
 * single frame is rendered.
 *
 * Day1 Design Ref: §7 RENDER_PREFLIGHT_FAILED — Day1 needs two videos rather than
 * one, so the source check branches on the template. Narration is out of Day1's
 * scope (Plan §2.2) and `narrationBlockers` already returns nothing for it, so the
 * loop below stays template-agnostic.
 */
export const preflightIssues = (
  project: EditorProject,
  sourceResolved: boolean,
  rendererReady: boolean,
): string[] => {
  const issues: string[] = [];

  if (project.templateSettings.template === 'day1') {
    // FR-D03 — both panels are required, and each must also be decodable.
    const missingPanels = day1MissingPanels(project);

    if (missingPanels.length > 0) {
      issues.push(
        `영상 2개를 모두 올려야 렌더할 수 있습니다. 남은 패널: ${missingPanels
          .map((panel) => DAY1_PANEL_LABEL[panel])
          .join(' · ')}`,
      );
    } else if (!sourceResolved) {
      issues.push('패널 영상이 연결되지 않았습니다. 파일을 다시 연결하세요.');
    }

    // Day1 Trim UX FR-S03, FR-S04 — a source that runs out mid-section renders black
    // for the remainder, silently. Blocking here is the difference between
    // noticing now and noticing in the ad account.
    //
    // A separate `if`, not another branch: a panel can be missing while the
    // other one is too short, and both are worth saying. `day1PanelsShorterThanSection`
    // ignores panels with no source at all, so neither is reported twice.
    const shortPanels = day1PanelsShorterThanSection(project);

    if (shortPanels.length > 0) {
      issues.push(
        `원본이 구간보다 짧아 검은 화면이 출력됩니다. 구간 길이를 줄이거나 더 긴 영상을 사용하세요. 해당 패널: ${shortPanels
          .map((panel) => DAY1_PANEL_LABEL[panel])
          .join(' · ')}`,
      );
    }
  } else if (!threeSceneOf(project)?.source) {
    issues.push('영상 소재가 없습니다.');
  } else if (!sourceResolved) {
    issues.push('원본 영상이 연결되지 않았습니다. 파일을 다시 연결하세요.');
  }

  if (!rendererReady) {
    issues.push('이 브라우저에서는 렌더를 실행할 수 없습니다.');
  }

  for (const blocker of narrationBlockers(
    project,
    project.render.selectedLocales,
  )) {
    issues.push(
      `${blocker.locale} ${blocker.kind} 나레이션이 장면보다 깁니다 (${(
        blocker.narrationMs / 1000
      ).toFixed(2)}초 > ${(blocker.sceneMs / 1000).toFixed(2)}초).`,
    );
  }

  return issues;
};

export const useRenderQueue = ({
  renderer,
  writer,
  resolveUrl,
}: {
  renderer: VideoRenderer;
  writer: OutputWriter;
  resolveUrl: (reference: MediaReference | null | undefined) => string | null;
}): RenderQueueApi => {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<AppError | null>(null);
  const [preflight, setPreflight] = useState<string[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const drain = useCallback(
    async (project: EditorProject, initial: RenderJob[]) => {
      let current = initial;

      setJobs(current);
      setRunning(true);
      cancelledRef.current = false;

      // Design Ref: §2.2 — strictly sequential; the MVP never renders in parallel.
      for (;;) {
        const job = nextQueuedJob(current);

        if (!job || cancelledRef.current) {
          break;
        }

        const startedAt = performance.now();
        const controller = new AbortController();
        controllerRef.current = controller;

        current = updateJob(current, job.id, {
          status: 'rendering',
          progress: 0,
        });
        setJobs(current);

        // Design Ref: §4.3 — one frozen snapshot per job. Day1 Design Ref: §2.1 —
        // the ratio is part of the snapshot, so a Day1 job carries the split
        // geometry for its own output size.
        const snapshot = buildEditorSnapshot(
          {
            ...project,
            selectedLocale: job.locale,
            selectedRatio: job.ratio,
            fps: project.render.fps,
          },
          resolveUrl,
        );
        const config: EditorRenderConfig = {
          durationPreset: project.durationPreset,
          fps: project.render.fps,
          ratio: job.ratio,
          locale: job.locale,
          profile: job.profile,
          outputTarget: 'web-fs',
        };

        try {
          const {blob} = await renderer.render({
            snapshot,
            config,
            signal: controller.signal,
            onProgress: ({progress, renderEstimatedTime}) => {
              current = updateJob(current, job.id, {
                progress,
                elapsedMs: performance.now() - startedAt,
                estimatedRemainingMs: renderEstimatedTime,
              });
              setJobs(current);
            },
          });

          current = updateJob(current, job.id, {status: 'saving', progress: 1});
          setJobs(current);

          // Design Ref: §2.2 — an output is persisted before the next job starts.
          const written = await writer.write(job.outputName, blob);

          if (!written.ok) {
            setNotice(written.error);
          }

          current = updateJob(current, job.id, {
            status: 'completed',
            elapsedMs: performance.now() - startedAt,
            estimatedRemainingMs: 0,
            ...(written.ok ? {outputName: written.value} : {}),
          });
        } catch (error) {
          const cancelled = controller.signal.aborted;

          current = updateJob(current, job.id, {
            status: cancelled ? 'cancelled' : 'failed',
            elapsedMs: performance.now() - startedAt,
            estimatedRemainingMs: null,
            ...(cancelled ? {} : {error: toAppError(error)}),
          });

          if (cancelled) {
            // Design Ref: §6.3 — unstarted jobs are cancelled, completed kept.
            current = cancelPendingJobs(current);
            setJobs(current);
            break;
          }
        } finally {
          controllerRef.current = null;
        }

        setJobs(current);
      }

      setRunning(false);
    },
    [renderer, resolveUrl, writer],
  );

  const start = useCallback(
    async (project: EditorProject, context: PreflightContext) => {
      const issues = preflightIssues(
        project,
        context.sourceResolved,
        context.rendererReady,
      );

      setPreflight(issues);
      setNotice(null);

      if (issues.length > 0) {
        return;
      }

      await drain(project, expandRenderJobs(project));
    },
    [drain],
  );

  const retryFailed = useCallback(
    async (project: EditorProject) => {
      setNotice(null);
      await drain(project, requeueFailedJobs(jobs));
    },
    [drain, jobs],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    controllerRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    setJobs([]);
    setNotice(null);
    setPreflight([]);
  }, []);

  return {
    jobs,
    running,
    notice,
    preflight,
    start,
    cancel,
    retryFailed,
    clear,
  };
};

export {summarizeQueue};
