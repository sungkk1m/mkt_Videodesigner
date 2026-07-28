import {describe, expect, it} from 'vitest';

import {createProject} from '../editor/project';
import type {EditorProject} from '../editor/types';
import {createAppError} from '../../shared/errors/appError';
import {fpsForProfile, PROFILE_SPECS} from './profile';
import {
  cancelPendingJobs,
  expandRenderJobs,
  nextQueuedJob,
  requeueFailedJobs,
  summarizeQueue,
  updateJob,
  type RenderJob,
} from './queue';

const projectWith = (patch: Partial<EditorProject['render']>): EditorProject => {
  const project = createProject(15);

  return {...project, render: {...project.render, ...patch}};
};

describe('fpsForProfile', () => {
  it('keeps a frame rate the profile allows', () => {
    expect(fpsForProfile('standard', 30)).toBe(30);
    expect(fpsForProfile('standard', 60)).toBe(60);
    expect(fpsForProfile('high', 60)).toBe(60);
  });

  it('forces Fast down to its only supported frame rate', () => {
    expect(fpsForProfile('fast', 60)).toBe(30);
  });

  it('gives Standard 1080p60 as its first choice', () => {
    expect(PROFILE_SPECS.standard.allowedFps[0]).toBe(60);
  });
});

describe('expandRenderJobs', () => {
  it('produces one job per locale and ratio combination', () => {
    const jobs = expandRenderJobs(
      projectWith({
        selectedLocales: ['ko', 'en'],
        selectedRatios: ['9:16', '1:1'],
      }),
    );

    expect(jobs).toHaveLength(4);
    expect(jobs.map((job) => job.id)).toEqual([
      'job_ko_9:16',
      'job_ko_1:1',
      'job_en_9:16',
      'job_en_1:1',
    ]);
  });

  it('expands the full matrix to exactly twelve unique jobs', () => {
    const jobs = expandRenderJobs(
      projectWith({
        selectedLocales: ['ko', 'en', 'ja', 'zh-TW'],
        selectedRatios: ['9:16', '1:1', '16:9'],
      }),
    );

    expect(jobs).toHaveLength(12);
    expect(new Set(jobs.map((job) => job.id)).size).toBe(12);
    expect(new Set(jobs.map((job) => job.outputName)).size).toBe(12);
  });

  it('names outputs with the confirmed pattern and the file prefix', () => {
    const jobs = expandRenderJobs(
      projectWith({
        selectedLocales: ['ja'],
        selectedRatios: ['16:9'],
        filePrefix: '여름 이벤트',
        fps: 30,
        profile: 'fast',
      }),
    );

    expect(jobs[0]?.outputName).toBe('여름-이벤트_ja_16x9_15s_30fps.mp4');
    expect(jobs[0]?.profile).toBe('fast');
  });

  it('keeps a stable locale and ratio order regardless of selection order', () => {
    const jobs = expandRenderJobs(
      projectWith({
        selectedLocales: ['ja', 'ko'],
        selectedRatios: ['16:9', '9:16'],
      }),
    );

    expect(jobs.map((job) => `${job.locale}/${job.ratio}`)).toEqual([
      'ko/9:16',
      'ko/16:9',
      'ja/9:16',
      'ja/16:9',
    ]);
  });
});

describe('queue transitions', () => {
  const jobs = (): RenderJob[] =>
    expandRenderJobs(
      projectWith({selectedLocales: ['ko', 'en'], selectedRatios: ['9:16']}),
    );

  it('takes the first queued job', () => {
    expect(nextQueuedJob(jobs())?.id).toBe('job_ko_9:16');
  });

  it('returns null once nothing is queued', () => {
    const done = jobs().map((job) => ({...job, status: 'completed' as const}));

    expect(nextQueuedJob(done)).toBeNull();
  });

  it('continues past a failed job', () => {
    const withFailure = updateJob(jobs(), 'job_ko_9:16', {
      status: 'failed',
      error: createAppError('RENDER_FAILED', '실패'),
    });

    expect(nextQueuedJob(withFailure)?.id).toBe('job_en_9:16');
    expect(summarizeQueue(withFailure).failed).toBe(1);
  });

  it('never recreates a completed output on retry', () => {
    const mixed = updateJob(
      updateJob(jobs(), 'job_ko_9:16', {status: 'completed'}),
      'job_en_9:16',
      {status: 'failed', error: createAppError('RENDER_FAILED', '실패')},
    );
    const retried = requeueFailedJobs(mixed);

    expect(retried[0]?.status).toBe('completed');
    expect(retried[1]?.status).toBe('queued');
    expect(retried[1]?.error).toBeUndefined();
  });

  it('cancels unstarted jobs and preserves completed ones', () => {
    const mixed = updateJob(jobs(), 'job_ko_9:16', {status: 'completed'});
    const cancelled = cancelPendingJobs(mixed);

    expect(cancelled[0]?.status).toBe('completed');
    expect(cancelled[1]?.status).toBe('cancelled');
  });

  it('summarises progress', () => {
    const mixed = updateJob(jobs(), 'job_ko_9:16', {status: 'completed'});

    expect(summarizeQueue(mixed)).toEqual({
      total: 2,
      completed: 1,
      failed: 0,
      remaining: 1,
      done: false,
    });
    expect(summarizeQueue(cancelPendingJobs(mixed)).done).toBe(true);
  });
});
