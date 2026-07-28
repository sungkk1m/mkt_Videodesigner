// Design Ref: §5.5 Capability Gate — expose blockers, fallback, progress, and cancellation.
import {Player} from '@remotion/player';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {RenderPocComposition} from '../compositions/RenderPocComposition';
import {probeRenderCapabilities} from '../infrastructure/render/capabilities';
import {runPocRender} from '../infrastructure/render/renderPoc';
import type {
  OutputTarget,
  PocRenderConfig,
  PocRenderMetrics,
  RenderCapabilitySummary,
} from '../infrastructure/render/types';

type RenderState =
  | {status: 'idle'}
  | {status: 'rendering'; progress: number; etaMs: number}
  | {status: 'completed'; blob: Blob; metrics: PocRenderMetrics}
  | {status: 'cancelled'}
  | {status: 'failed'; message: string};

const AUDIO_SRC = new URL('poc-tone.wav', document.baseURI).href;

const formatBytes = (bytes: number | null) => {
  if (bytes === null) {
    return '측정 불가';
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '렌더가 취소되었습니다.';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '알 수 없는 렌더 오류가 발생했습니다.';
};

export const RenderPocWorkspace = () => {
  const [capabilities, setCapabilities] =
    useState<RenderCapabilitySummary | null>(null);
  const [capabilityLoading, setCapabilityLoading] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState<1 | 15 | 60>(1);
  const [fps, setFps] = useState<30 | 60>(30);
  const [resolution, setResolution] = useState<'360x640' | '1080x1920'>(
    '360x640',
  );
  const [outputTarget, setOutputTarget] =
    useState<OutputTarget>('arraybuffer');
  const [renderState, setRenderState] = useState<RenderState>({status: 'idle'});
  const controllerRef = useRef<AbortController | null>(null);

  const config = useMemo<PocRenderConfig>(() => {
    const [width, height] =
      resolution === '1080x1920' ? ([1080, 1920] as const) : ([360, 640] as const);

    return {
      durationSeconds,
      fps,
      width,
      height,
      outputTarget,
    };
  }, [durationSeconds, fps, outputTarget, resolution]);

  const inspectCapabilities = useCallback(async () => {
    setCapabilityLoading(true);
    try {
      const result = await probeRenderCapabilities();
      setCapabilities(result);
      setOutputTarget(result.preferredOutputTarget);
    } finally {
      setCapabilityLoading(false);
    }
  }, []);

  useEffect(() => {
    void inspectCapabilities();
  }, [inspectCapabilities]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const startRender = async () => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setRenderState({status: 'rendering', progress: 0, etaMs: 0});

    try {
      const result = await runPocRender({
        config,
        audioSrc: AUDIO_SRC,
        signal: controller.signal,
        onProgress: ({progress, renderEstimatedTime}) => {
          setRenderState({
            status: 'rendering',
            progress,
            etaMs: renderEstimatedTime,
          });
        },
      });
      setRenderState({status: 'completed', ...result});
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setRenderState({status: 'cancelled'});
      } else {
        setRenderState({status: 'failed', message: getErrorMessage(error)});
      }
    } finally {
      controllerRef.current = null;
    }
  };

  const downloadOutput = () => {
    if (renderState.status !== 'completed') {
      return;
    }

    const url = URL.createObjectURL(renderState.blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `render-poc_${config.durationSeconds}s_9x16_${config.fps}fps_${config.outputTarget}.mp4`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const renderStatus =
    renderState.status === 'rendering'
      ? `렌더 중 ${Math.round(renderState.progress * 100)}% · 예상 ${Math.ceil(renderState.etaMs / 1000)}초`
      : renderState.status === 'completed'
        ? '완료'
        : renderState.status === 'failed'
          ? `실패: ${renderState.message}`
          : renderState.status === 'cancelled'
            ? '취소됨'
            : '대기';

  return (
    <main className="workspace">
      <header className="workspace__header">
        <div>
          <p className="eyebrow">mkt_videodesigner · module-2</p>
          <h1>Browser Render PoC</h1>
        </div>
        <div className="header-status">
          <span>Remotion 4.0.499</span>
          <span>Chrome only</span>
        </div>
      </header>

      <section className="capability-band" aria-labelledby="capability-heading">
        <div className="section-heading">
          <div>
            <h2 id="capability-heading">환경 진단</h2>
            <p data-testid="capability-status">
              {capabilityLoading
                ? '검사 중'
                : capabilities?.ready
                  ? `렌더 가능 · ${capabilities.resolvedOutputTarget}`
                  : '렌더 불가'}
            </p>
          </div>
          <button
            className="button button--secondary"
            disabled={capabilityLoading}
            onClick={() => void inspectCapabilities()}
            type="button"
          >
            환경 다시 검사
          </button>
        </div>

        {capabilities ? (
          <div className="capability-grid">
            <div>
              <span>Chrome</span>
              <strong>{capabilities.isChrome ? '지원' : '차단'}</strong>
            </div>
            <div>
              <span>WebCodecs</span>
              <strong>{capabilities.hasWebCodecs ? '지원' : '차단'}</strong>
            </div>
            <div>
              <span>Video</span>
              <strong>{capabilities.videoCodecs.join(', ') || '없음'}</strong>
            </div>
            <div>
              <span>Audio</span>
              <strong>{capabilities.audioCodecs.join(', ') || '없음'}</strong>
            </div>
            <div>
              <span>OPFS</span>
              <strong>{capabilities.hasOpfs ? '지원' : 'fallback'}</strong>
            </div>
            <div>
              <span>Folder API</span>
              <strong>
                {capabilities.hasFileSystemAccess ? '지원' : '미지원'}
              </strong>
            </div>
          </div>
        ) : null}

        {capabilities?.blockers.map((message) => (
          <p className="notice notice--error" key={message}>
            {message}
          </p>
        ))}
        {capabilities?.warnings.map((message) => (
          <p className="notice notice--warning" key={message}>
            {message}
          </p>
        ))}
      </section>

      <section className="poc-layout">
        <div className="preview-pane">
          <div className="section-heading">
            <div>
              <h2>Composition</h2>
              <p>동일 컴포넌트를 미리보기와 출력에 사용합니다.</p>
            </div>
          </div>
          <div className="player-frame">
            <Player
              component={RenderPocComposition}
              compositionHeight={config.height}
              compositionWidth={config.width}
              controls
              durationInFrames={config.durationSeconds * config.fps}
              fps={config.fps}
              initialFrame={Math.min(
                Math.round(config.fps / 2),
                config.durationSeconds * config.fps - 1,
              )}
              inputProps={{
                audioSrc: AUDIO_SRC,
                label: `${config.durationSeconds}s · ${config.width}×${config.height} · ${config.fps}fps`,
              }}
              loop
              style={{height: '100%', width: '100%'}}
            />
          </div>
        </div>

        <aside className="control-pane" aria-label="렌더 설정">
          <h2>렌더 설정</h2>
          <label>
            <span>길이</span>
            <select
              aria-label="길이"
              disabled={renderState.status === 'rendering'}
              onChange={(event) =>
                setDurationSeconds(Number(event.target.value) as 1 | 15 | 60)
              }
              value={durationSeconds}
            >
              <option value="1">1초 smoke</option>
              <option value="15">15초</option>
              <option value="60">60초</option>
            </select>
          </label>
          <label>
            <span>FPS</span>
            <select
              aria-label="FPS"
              disabled={renderState.status === 'rendering'}
              onChange={(event) =>
                setFps(Number(event.target.value) as 30 | 60)
              }
              value={fps}
            >
              <option value="30">30fps</option>
              <option value="60">60fps</option>
            </select>
          </label>
          <label>
            <span>해상도</span>
            <select
              aria-label="해상도"
              disabled={renderState.status === 'rendering'}
              onChange={(event) =>
                setResolution(event.target.value as '360x640' | '1080x1920')
              }
              value={resolution}
            >
              <option value="360x640">360×640 smoke</option>
              <option value="1080x1920">1080×1920 기준</option>
            </select>
          </label>
          <label>
            <span>출력 방식</span>
            <select
              aria-label="출력 방식"
              disabled={renderState.status === 'rendering'}
              onChange={(event) =>
                setOutputTarget(event.target.value as OutputTarget)
              }
              value={outputTarget}
            >
              <option value="web-fs">web-fs (OPFS)</option>
              <option value="arraybuffer">ArrayBuffer</option>
            </select>
          </label>

          <div className="actions">
            <button
              className="button button--primary"
              disabled={
                renderState.status === 'rendering' || !capabilities?.ready
              }
              onClick={() => void startRender()}
              type="button"
            >
              렌더 시작
            </button>
            <button
              className="button button--secondary"
              disabled={renderState.status !== 'rendering'}
              onClick={() => controllerRef.current?.abort()}
              type="button"
            >
              취소
            </button>
          </div>

          <div className="render-result" aria-live="polite">
            <strong data-testid="render-status">{renderStatus}</strong>
            {renderState.status === 'rendering' ? (
              <progress max="1" value={renderState.progress} />
            ) : null}
            {renderState.status === 'completed' ? (
              <>
                <dl>
                  <div>
                    <dt>렌더</dt>
                    <dd>{(renderState.metrics.renderMs / 1000).toFixed(2)}초</dd>
                  </div>
                  <div>
                    <dt>Blob 읽기</dt>
                    <dd>
                      {(renderState.metrics.blobReadMs / 1000).toFixed(2)}초
                    </dd>
                  </div>
                  <div>
                    <dt>출력</dt>
                    <dd>{formatBytes(renderState.metrics.outputBytes)}</dd>
                  </div>
                  <div>
                    <dt>Peak JS heap</dt>
                    <dd>{formatBytes(renderState.metrics.peakJsHeapBytes)}</dd>
                  </div>
                </dl>
                <button
                  className="button button--secondary"
                  onClick={downloadOutput}
                  type="button"
                >
                  MP4 다운로드
                </button>
                <pre data-testid="latest-metrics">
                  {JSON.stringify(renderState.metrics, null, 2)}
                </pre>
              </>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  );
};
