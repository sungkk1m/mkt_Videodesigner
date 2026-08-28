// Design Ref: §5.5 "Batch Dialog and Queue" — locale and ratio checkboxes,
// profile and fps, job count and destination, the preflight list, and the queue
// rows with cancel and retry.
import {
  ASPECT_RATIOS,
  ratiosForTemplate,
  LOCALES,
  MAX_BATCH_JOBS,
  type AspectRatio,
  type EditorProject,
  type Locale,
} from '../../domain/editor/types';
import {
  FRAME_RATES,
  PROFILE_SPECS,
  RENDER_PROFILES,
  type FrameRate,
  type RenderProfile,
} from '../../domain/render/profile';
import {summarizeQueue, type RenderJob} from '../../domain/render/queue';
import type {AppError} from '../../shared/errors/appError';
import {LOCALE_LABELS} from './CopyPanel';

const STATUS_LABELS: Record<RenderJob['status'], string> = {
  queued: '대기',
  preparing: '준비',
  rendering: '렌더 중',
  saving: '저장 중',
  completed: '완료',
  failed: '실패',
  cancelled: '취소됨',
};

export interface BatchDialogProps {
  project: EditorProject;
  jobs: RenderJob[];
  running: boolean;
  preflight: string[];
  notice: AppError | null;
  destination: 'directory' | 'download';
  supportsDirectory: boolean;
  onToggleLocale: (locale: Locale) => void;
  onToggleRatio: (ratio: AspectRatio) => void;
  onProfile: (profile: RenderProfile) => void;
  onFps: (fps: FrameRate) => void;
  onFilePrefix: (prefix: string) => void;
  onChooseDirectory: () => void;
  onUseDownloads: () => void;
  onStart: () => void;
  onCancel: () => void;
  onRetryFailed: () => void;
  onClose: () => void;
}

const formatSeconds = (ms: number | null) =>
  ms === null ? '-' : `${Math.max(0, Math.round(ms / 1000))}초`;

export const BatchDialog = ({
  project,
  jobs,
  running,
  preflight,
  notice,
  destination,
  supportsDirectory,
  onToggleLocale,
  onToggleRatio,
  onProfile,
  onFps,
  onFilePrefix,
  onChooseDirectory,
  onUseDownloads,
  onStart,
  onCancel,
  onRetryFailed,
  onClose,
}: BatchDialogProps) => {
  const {selectedLocales, selectedRatios, profile, fps} = project.render;
  const allowedRatios = ratiosForTemplate(project.templateSettings.template);
  const jobCount = selectedLocales.length * selectedRatios.length;
  const summary = summarizeQueue(jobs);
  const allowedFps = PROFILE_SPECS[profile].allowedFps;

  return (
    <div className="dialog" data-testid="batch-dialog" role="dialog">
      <div className="dialog__panel">
        <div className="dialog__title">
          <h2>Batch 렌더</h2>
          <button
            className="button button--ghost"
            data-testid="batch-close"
            onClick={onClose}
            type="button"
          >
            닫기
          </button>
        </div>

        <div className="dialog__grid">
          <div className="panel__group">
            <h3>언어</h3>
            {LOCALES.map((locale) => (
              <label className="field field--toggle" key={locale}>
                <input
                  checked={selectedLocales.includes(locale)}
                  data-testid={`batch-locale-${locale}`}
                  disabled={running}
                  onChange={() => onToggleLocale(locale)}
                  type="checkbox"
                />
                <span>{LOCALE_LABELS[locale]}</span>
              </label>
            ))}
          </div>

          <div className="panel__group">
            <h3>비율</h3>
            {ASPECT_RATIOS.map((ratio) => (
              <label className="field field--toggle" key={ratio}>
                <input
                  checked={selectedRatios.includes(ratio)}
                  data-testid={`batch-ratio-${ratio}`}
                  // A ratio this template's schema rejects is not offerable:
                  // ticking one used to autosave a document that could not be
                  // parsed back, and the next load opened an empty project.
                  disabled={running || !allowedRatios.includes(ratio)}
                  onChange={() => onToggleRatio(ratio)}
                  type="checkbox"
                />
                <span>{ratio}</span>
              </label>
            ))}
          </div>

          <div className="panel__group">
            <h3>품질</h3>
            <div aria-label="렌더 프로필" className="segmented" role="group">
              {RENDER_PROFILES.map((entry) => (
                <button
                  aria-pressed={profile === entry}
                  className={`segmented__item${
                    profile === entry ? ' segmented__item--on' : ''
                  }`}
                  data-testid={`batch-profile-${entry}`}
                  disabled={running}
                  key={entry}
                  onClick={() => onProfile(entry)}
                  type="button"
                >
                  {PROFILE_SPECS[entry].label}
                </button>
              ))}
            </div>
            <p className="panel__hint">{PROFILE_SPECS[profile].hint}</p>

            <div aria-label="프레임 레이트" className="segmented" role="group">
              {FRAME_RATES.map((entry) => (
                <button
                  aria-pressed={fps === entry}
                  className={`segmented__item${
                    fps === entry ? ' segmented__item--on' : ''
                  }`}
                  data-testid={`batch-fps-${entry}`}
                  disabled={running || !allowedFps.includes(entry)}
                  key={entry}
                  onClick={() => onFps(entry)}
                  type="button"
                >
                  {entry}fps
                </button>
              ))}
            </div>

            <label className="field">
              <span>파일 이름 접두어</span>
              <input
                data-testid="batch-prefix"
                disabled={running}
                onChange={(event) => onFilePrefix(event.target.value)}
                placeholder={project.name}
                type="text"
                value={project.render.filePrefix}
              />
            </label>
          </div>
        </div>

        <div className="dialog__summary" data-testid="batch-summary">
          <span>
            작업 {jobCount}개 / 최대 {MAX_BATCH_JOBS}개
          </span>
          <span>
            저장 위치: {destination === 'directory' ? '선택한 폴더' : '브라우저 다운로드'}
          </span>
          {supportsDirectory ? (
            <button
              className="button button--secondary"
              data-testid="batch-choose-directory"
              disabled={running}
              onClick={onChooseDirectory}
              type="button"
            >
              폴더 선택
            </button>
          ) : (
            <span>이 브라우저는 폴더 저장을 지원하지 않습니다.</span>
          )}
          {destination === 'directory' ? (
            <button
              className="button button--ghost"
              disabled={running}
              onClick={onUseDownloads}
              type="button"
            >
              다운로드로 전환
            </button>
          ) : null}
        </div>

        {preflight.length > 0 ? (
          <div className="notice notice--error" data-testid="batch-preflight">
            <p>렌더를 시작할 수 없습니다.</p>
            <ul>
              {preflight.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {notice ? (
          <p className="notice notice--warning" data-testid="batch-notice">
            {notice.message}
          </p>
        ) : null}

        <div className="dialog__actions">
          <button
            className="button button--primary"
            data-testid="batch-start"
            disabled={running || jobCount === 0}
            onClick={onStart}
            type="button"
          >
            Batch 시작
          </button>
          <button
            className="button button--ghost"
            data-testid="batch-cancel"
            disabled={!running}
            onClick={onCancel}
            type="button"
          >
            전체 취소
          </button>
          <button
            className="button button--secondary"
            data-testid="batch-retry"
            disabled={running || summary.failed === 0}
            onClick={onRetryFailed}
            type="button"
          >
            실패 항목 재시도 ({summary.failed})
          </button>
          {jobs.length > 0 ? (
            <span data-testid="batch-progress">
              완료 {summary.completed}/{summary.total}
            </span>
          ) : null}
        </div>

        {jobs.length > 0 ? (
          <table className="queue" data-testid="batch-queue">
            <thead>
              <tr>
                <th>언어</th>
                <th>비율</th>
                <th>상태</th>
                <th>진행</th>
                <th>경과</th>
                <th>남은 시간</th>
                <th>파일</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr data-testid={`queue-row-${job.id}`} key={job.id}>
                  <td>{job.locale}</td>
                  <td>{job.ratio}</td>
                  <td>{STATUS_LABELS[job.status]}</td>
                  <td>{Math.round(job.progress * 100)}%</td>
                  <td>{formatSeconds(job.elapsedMs)}</td>
                  <td>{formatSeconds(job.estimatedRemainingMs)}</td>
                  <td>{job.outputName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
};
