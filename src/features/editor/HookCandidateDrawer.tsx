// Design Ref: §5.5 "Timeline and Hook Candidate Drawer" — analyse, progress and
// cancellation, a 3-5 candidate filmstrip with score and reasons, and a manual
// range that always stays usable when analysis is unavailable or fails.
import {useCallback, useRef, useState} from 'react';

import type {HookReason} from '../../domain/hook/scoring';
import type {HookAnalyzer, HookCandidateWithThumbnail} from '../../domain/ports';
import type {AppError} from '../../shared/errors/appError';

const REASON_LABELS: Record<HookReason, string> = {
  scene: '장면 전환',
  motion: '움직임',
  audio: '사운드',
  'visual-change': '밝기·색 변화',
};

type AnalysisState =
  | {status: 'idle'}
  | {status: 'analyzing'; progress: number}
  | {status: 'ready'; candidates: HookCandidateWithThumbnail[]}
  | {status: 'failed'; error: AppError};

export interface HookCandidateDrawerProps {
  analyzer: HookAnalyzer;
  sourceUrl: string | null;
  sourceDurationMs: number | null;
  candidateDurationMs: number;
  selectedStartMs: number;
  disabled: boolean;
  onSelect: (startMs: number) => void;
}

const formatSeconds = (ms: number) => (ms / 1000).toFixed(1);

export const HookCandidateDrawer = ({
  analyzer,
  sourceUrl,
  sourceDurationMs,
  candidateDurationMs,
  selectedStartMs,
  disabled,
  onSelect,
}: HookCandidateDrawerProps) => {
  const [state, setState] = useState<AnalysisState>({status: 'idle'});
  const controllerRef = useRef<AbortController | null>(null);

  const ready = sourceUrl !== null && (sourceDurationMs ?? 0) > 0;
  const analyzing = state.status === 'analyzing';

  const analyze = useCallback(async () => {
    if (!sourceUrl || !sourceDurationMs) {
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setState({status: 'analyzing', progress: 0});

    const result = await analyzer.analyze({
      url: sourceUrl,
      sourceDurationMs,
      candidateDurationMs,
      signal: controller.signal,
      onProgress: (progress) => setState({status: 'analyzing', progress}),
    });

    controllerRef.current = null;
    setState(
      result.ok
        ? {status: 'ready', candidates: result.value}
        : {status: 'failed', error: result.error},
    );
  }, [analyzer, candidateDurationMs, sourceDurationMs, sourceUrl]);

  const maxStartMs = Math.max(0, (sourceDurationMs ?? 0) - candidateDurationMs);

  return (
    <section aria-label="Hook 후보" className="hook" data-testid="hook-drawer">
      <div className="hook__bar">
        <button
          className="button button--primary"
          data-testid="hook-analyze"
          disabled={disabled || !ready || analyzing}
          onClick={() => void analyze()}
          type="button"
        >
          Hook 후보 분석
        </button>
        {analyzing ? (
          <>
            <button
              className="button button--secondary"
              data-testid="hook-cancel"
              onClick={() => controllerRef.current?.abort()}
              type="button"
            >
              분석 취소
            </button>
            <progress max="1" value={state.progress} />
            <span data-testid="hook-progress">
              분석 중 {Math.round(state.progress * 100)}%
            </span>
          </>
        ) : null}
      </div>

      <p className="hook__note">
        시각적 두드러짐 기준 추천입니다. 성과 예측이 아닙니다.
      </p>

      {state.status === 'failed' ? (
        <p className="notice notice--warning" data-testid="hook-error">
          {state.error.message}
        </p>
      ) : null}

      {state.status === 'ready' && state.candidates.length === 0 ? (
        <p className="panel__hint">
          두드러지는 구간을 찾지 못했습니다. 아래에서 직접 지정하세요.
        </p>
      ) : null}

      {state.status === 'ready' && state.candidates.length > 0 ? (
        <ul className="hook__strip" data-testid="hook-candidates">
          {state.candidates.map((candidate) => (
            <li key={candidate.id}>
              <button
                aria-pressed={selectedStartMs === candidate.startMs}
                className={`hook__card${
                  selectedStartMs === candidate.startMs
                    ? ' hook__card--on'
                    : ''
                }`}
                data-testid={`hook-candidate-${candidate.startMs}`}
                disabled={disabled}
                onClick={() => onSelect(candidate.startMs)}
                type="button"
              >
                {candidate.thumbnail ? (
                  <img alt="" src={candidate.thumbnail} />
                ) : null}
                <strong>
                  {formatSeconds(candidate.startMs)}s –{' '}
                  {formatSeconds(candidate.endMs)}s
                </strong>
                <span>점수 {Math.round(candidate.score * 100)}</span>
                <span>
                  {candidate.reasons.length === 0
                    ? '기준 신호 없음'
                    : candidate.reasons
                        .map((reason) => REASON_LABELS[reason])
                        .join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <label className="field field--range">
        <span>
          Hook 시작 직접 지정
          <strong>{formatSeconds(selectedStartMs)}s</strong>
        </span>
        <input
          data-testid="hook-manual-range"
          disabled={disabled || !ready}
          max={maxStartMs}
          min={0}
          onChange={(event) => onSelect(Number(event.target.value))}
          step={100}
          type="range"
          value={Math.min(selectedStartMs, maxStartMs)}
        />
      </label>
    </section>
  );
};
