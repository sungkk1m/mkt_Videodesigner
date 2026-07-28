// Design Ref: §5.1 Screen Layout (Option A) — header, left assets, center preview,
// right inspector, bottom timeline. Module 3A is 9:16 and 60fps only.
import {Player, type PlayerRef} from '@remotion/player';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';

import {ThreeSceneComposition} from '../../compositions/ThreeSceneComposition';
import {
  activeTransform,
  buildCompositionProps,
  createProject,
  hasRatioOverride,
  outputDimensions,
  projectTotalFrames,
} from '../../domain/editor/project';
import {
  ASPECT_RATIOS,
  DURATION_PRESETS,
  SCENE_LABELS,
  type DurationPreset,
  type EditorProject,
  type LocalizedCopy,
  type MediaReference,
  type SceneKind,
} from '../../domain/editor/types';
import {narrationBlockers} from '../../domain/audio/mix';
import {hookCandidateDurationMs} from '../../domain/hook/scoring';
import type {TtsProvider} from '../../domain/tts/types';
import type {
  HookAnalyzer,
  MediaHandleStore,
  MediaResolver,
  OutputWriter,
  ProjectRepository,
  RenderCapabilities,
  VideoRenderer,
} from '../../domain/ports';
import {buildOutputFileName} from '../../domain/render/fileName';
import type {
  EditorRenderConfig,
  EditorRenderMetrics,
} from '../../domain/render/types';
import {msToFrames, sceneIndexOf} from '../../domain/timeline/timeline';
import {AudioPanel} from './AudioPanel';
import {BatchDialog} from './BatchDialog';
import {CopyPanel} from './CopyPanel';
import {HookCandidateDrawer} from './HookCandidateDrawer';
import {ProjectMenu} from './ProjectMenu';
import {useProjectStore} from './projectStore';
import {SceneInspector} from './SceneInspector';
import {SourceRepair} from './SourceRepair';
import {Timeline} from './Timeline';
import {
  useEditorAudio,
  type EditorAudioCommands,
  type TtsCacheGateway,
} from './useEditorAudio';
import {useEditorSource, type EditorSourceCommands} from './useEditorSource';
import {useRenderQueue} from './useRenderQueue';
import {useMediaSession} from './useMediaSession';
import {useProjectPersistence} from './useProjectPersistence';

type RenderState =
  | {status: 'idle'}
  | {status: 'rendering'; progress: number; etaMs: number}
  | {status: 'completed'; blob: Blob; fileName: string; metrics: EditorRenderMetrics}
  | {status: 'cancelled'}
  | {status: 'failed'; message: string};

const formatTimecode = (ms: number) => {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;

  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
};

const formatMegabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return '알 수 없는 렌더 오류가 발생했습니다.';
};

export interface EditorWorkspaceProps {
  mediaResolver: MediaResolver;
  videoRenderer: VideoRenderer;
  hookAnalyzer: HookAnalyzer;
  ttsProvider: TtsProvider;
  ttsCache: TtsCacheGateway;
  outputWriter: OutputWriter;
  supportsOutputDirectory: boolean;
  projectRepository: ProjectRepository;
  /** Null when the browser has no File System Access support. */
  mediaHandleStore: MediaHandleStore | null;
  /** Injected by the app shell so features stay off the infrastructure layer. */
  loadInitialProject: (
    repository: ProjectRepository,
  ) => Promise<EditorProject | null | undefined>;
}

export const EditorWorkspace = ({
  mediaResolver,
  videoRenderer,
  hookAnalyzer,
  ttsProvider,
  ttsCache,
  outputWriter,
  supportsOutputDirectory,
  projectRepository,
  mediaHandleStore,
  loadInitialProject,
}: EditorWorkspaceProps) => {
  const project = useProjectStore((state) => state.project);
  const [selectedKind, setSelectedKind] = useState<SceneKind>('hook');
  const [leftTab, setLeftTab] = useState<'assets' | 'copy' | 'audio'>(
    'assets',
  );
  const [batchOpen, setBatchOpen] = useState(false);
  const [outputDestination, setOutputDestination] = useState<
    'directory' | 'download'
  >('download');
  const [capabilities, setCapabilities] = useState<RenderCapabilities | null>(
    null,
  );
  const [renderState, setRenderState] = useState<RenderState>({status: 'idle'});
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const playerRef = useRef<PlayerRef>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const store = useProjectStore.getState;

  const session = useMediaSession(mediaResolver);
  const sourceCommands = useMemo<EditorSourceCommands>(
    () => ({
      applySource: (reference) => store().applySource(reference),
      relink: (reference) => store().relink(reference),
      setSourceStatus: (status) => store().setSourceStatus(status),
      setCtaAsset: (slot, reference) => store().setCtaAsset(slot, reference),
    }),
    [store],
  );

  const audioCommands = useMemo<EditorAudioCommands>(
    () => ({
      setBgmTrack: (reference) =>
        store().setBgm(
          reference ? {source: reference, volume: 0.6, startMs: 0, loop: true} : null,
        ),
      setNarrationTrack: (kind, track) => store().setNarration(kind, track),
    }),
    [store],
  );

  const source = useEditorSource({
    resolver: mediaResolver,
    handleStore: mediaHandleStore,
    session,
    project,
    commands: sourceCommands,
  });

  const totalFrames = projectTotalFrames(project);
  const totalMs = project.durationPreset * 1000;
  const currentMs = (currentFrame / project.fps) * 1000;
  const selectedScene = project.scenes[sceneIndexOf(selectedKind)];
  const isRendering = renderState.status === 'rendering';

  const audio = useEditorAudio({
    resolver: mediaResolver,
    provider: ttsProvider,
    cache: ttsCache,
    session,
    project,
    commands: audioCommands,
  });

  const queue = useRenderQueue({
    renderer: videoRenderer,
    writer: outputWriter,
    resolveUrl: (reference) => session.urlFor(reference?.id),
  });

  const persistence = useProjectPersistence({
    repository: projectRepository,
    project,
    onRestore: (restored) => store().replaceProject(restored),
    loadInitial: loadInitialProject,
    paused: isRendering || queue.running,
  });

  // Design Ref: §7 — revoke object URLs the project no longer references.
  const referencedIds = [
    project.source?.id,
    project.scenes[2].cta?.media?.id,
    project.scenes[2].cta?.appIcon?.id,
    project.scenes[2].cta?.logo?.id,
    project.scenes[2].cta?.storeBadge?.id,
    project.audio.bgm?.source.id,
    ...Object.values(project.audio.narration).flatMap((tracks) =>
      Object.values(tracks ?? {}).map((track) => track.source.id),
    ),
  ]
    .filter((id): id is string => typeof id === 'string')
    .join(',');

  useEffect(() => {
    session.retain(referencedIds ? referencedIds.split(',') : []);
  }, [referencedIds, session]);

  const narrationTooLong = narrationBlockers(project);

  const resolveUrl = useCallback(
    (reference: MediaReference | null | undefined) =>
      session.urlFor(reference?.id),
    [session],
  );

  const compositionProps = useMemo(
    () => buildCompositionProps(project, resolveUrl),
    [project, resolveUrl],
  );

  const output = outputDimensions(project.selectedRatio);
  const selectedTransform = activeTransform(selectedScene, project.selectedRatio);

  useEffect(() => {
    void videoRenderer.probe().then(setCapabilities);
  }, [videoRenderer]);

  useEffect(() => {
    void audio.refreshCapabilities();
    // The provider instance is stable for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsProvider]);

  useEffect(() => {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    const onFrameUpdate = (event: {detail: {frame: number}}) => {
      setCurrentFrame(event.detail.frame);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    player.addEventListener('frameupdate', onFrameUpdate);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);

    return () => {
      player.removeEventListener('frameupdate', onFrameUpdate);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
    };
  }, []);

  // Leaving the page must abort an active render; `useMediaSession` owns the
  // object URLs.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const seekToMs = useCallback(
    (ms: number) => {
      const frame = Math.min(
        Math.max(msToFrames(ms, project.fps), 0),
        totalFrames - 1,
      );
      playerRef.current?.seekTo(frame);
      setCurrentFrame(frame);
    },
    [project.fps, totalFrames],
  );

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    await source.upload(file);
    setSelectedKind('hook');
    seekToMs(0);
  };

  const handlePickFile = async () => {
    await source.pickAndUpload();
    setSelectedKind('hook');
    seekToMs(0);
  };

  const handleNewProject = () => {
    store().replaceProject(createProject(project.durationPreset));
    setSelectedKind('hook');
    setRenderState({status: 'idle'});
    seekToMs(0);
  };

  const handleOpenProject = (opened: EditorProject) => {
    store().replaceProject(opened);
    setSelectedKind('hook');
    setRenderState({status: 'idle'});
    seekToMs(0);
  };

  const handlePreset = (preset: DurationPreset) => {
    store().setDurationPreset(preset);
    seekToMs(0);
  };

  const startRender = async () => {
    // Design Ref: §6.2 RENDER_PREFLIGHT_FAILED — narration longer than its scene
    // blocks the render rather than being truncated.
    if (!capabilities?.ready || !source.sourceUrl || narrationTooLong.length > 0) {
      return;
    }

    // Design Ref: §4.3 — freeze the edit state so later UI changes cannot mutate
    // the active job.
    const snapshot = buildCompositionProps(project, resolveUrl);
    const config: EditorRenderConfig = {
      durationPreset: project.durationPreset,
      fps: project.fps,
      ratio: project.selectedRatio,
      locale: project.selectedLocale,
      outputTarget: capabilities.preferredOutputTarget,
    };
    const fileName = buildOutputFileName(project.name, config);
    const controller = new AbortController();

    controllerRef.current = controller;
    playerRef.current?.pause();
    setRenderState({status: 'rendering', progress: 0, etaMs: 0});

    try {
      const result = await videoRenderer.render({
        snapshot,
        config,
        signal: controller.signal,
        onProgress: ({progress, renderEstimatedTime}) => {
          setRenderState({
            status: 'rendering',
            progress,
            etaMs: renderEstimatedTime,
          });
        },
      });

      setRenderState({status: 'completed', fileName, ...result});
    } catch (error) {
      if (controller.signal.aborted) {
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
    anchor.download = renderState.fileName;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const saveStateText =
    persistence.saveState.status === 'saving'
      ? '저장 중'
      : persistence.saveState.status === 'saved'
        ? '저장됨'
        : persistence.saveState.status === 'failed'
          ? '저장 실패'
          : persistence.restoring
            ? '불러오는 중'
            : '변경 없음';

  const renderStatusText =
    renderState.status === 'rendering'
      ? `렌더 중 ${Math.round(renderState.progress * 100)}% · 남은 시간 ${Math.ceil(
          renderState.etaMs / 1000,
        )}초`
      : renderState.status === 'completed'
        ? `완료 · ${formatMegabytes(renderState.metrics.outputBytes)}`
        : renderState.status === 'failed'
          ? `실패: ${renderState.message}`
          : renderState.status === 'cancelled'
            ? '취소됨'
            : capabilities === null
              ? '환경 확인 중'
              : capabilities.ready
                ? '대기'
                : '렌더 불가';

  return (
    <div className="editor">
      <header className="editor__header">
        <div className="editor__brand">
          <span>UA Video Designer</span>
          <input
            aria-label="프로젝트 이름"
            className="editor__name"
            disabled={isRendering}
            onChange={(event) => store().rename(event.target.value)}
            value={project.name}
          />
          <span className="editor__save" data-testid="editor-save-state">
            {saveStateText}
          </span>
          <ProjectMenu
            disabled={isRendering}
            onNewProject={handleNewProject}
            onOpenProject={handleOpenProject}
            project={project}
            repository={projectRepository}
          />
        </div>

        <div className="editor__settings">
          <div aria-label="전체 길이" className="segmented" role="group">
            {DURATION_PRESETS.map((preset) => (
              <button
                aria-pressed={project.durationPreset === preset}
                className={`segmented__item${
                  project.durationPreset === preset ? ' segmented__item--on' : ''
                }`}
                disabled={isRendering}
                key={preset}
                onClick={() => handlePreset(preset)}
                type="button"
              >
                {preset}초
              </button>
            ))}
          </div>
          <div aria-label="비율" className="segmented" role="group">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                aria-pressed={project.selectedRatio === ratio}
                className={`segmented__item${
                  project.selectedRatio === ratio ? ' segmented__item--on' : ''
                }`}
                data-testid={`ratio-${ratio}`}
                disabled={isRendering}
                key={ratio}
                onClick={() => store().setRatio(ratio)}
                type="button"
              >
                {ratio}
              </button>
            ))}
          </div>
          <span className="editor__chip" data-testid="output-size">
            {output.width}×{output.height}
          </span>
          <span className="editor__chip">60fps</span>
        </div>

        <div className="editor__actions">
          {narrationTooLong.length > 0 ? (
            <span className="editor__blocker" data-testid="render-blocker">
              나레이션 {narrationTooLong.length}개가 장면보다 깁니다
            </span>
          ) : null}
          <span data-testid="editor-render-status">{renderStatusText}</span>
          {isRendering ? (
            <progress max="1" value={renderState.progress} />
          ) : null}
          <button
            className="button button--primary"
            disabled={
              isRendering ||
              !capabilities?.ready ||
              !source.sourceUrl ||
              narrationTooLong.length > 0
            }
            onClick={() => void startRender()}
            type="button"
          >
            MP4 렌더
          </button>
          <button
            className="button button--secondary"
            data-testid="open-batch"
            disabled={isRendering}
            onClick={() => setBatchOpen(true)}
            type="button"
          >
            Batch
          </button>
          <button
            className="button button--ghost"
            disabled={!isRendering}
            onClick={() => controllerRef.current?.abort()}
            type="button"
          >
            취소
          </button>
          {renderState.status === 'completed' ? (
            <button
              className="button button--secondary"
              onClick={downloadOutput}
              type="button"
            >
              다운로드
            </button>
          ) : null}
        </div>
      </header>

      <aside aria-label="입력" className="panel panel--assets">
        <div className="panel__title">
          <div aria-label="입력 탭" className="segmented" role="group">
            {(['assets', 'copy', 'audio'] as const).map((tab) => (
              <button
                aria-pressed={leftTab === tab}
                className={`segmented__item${
                  leftTab === tab ? ' segmented__item--on' : ''
                }`}
                data-testid={`tab-${tab}`}
                key={tab}
                onClick={() => setLeftTab(tab)}
                type="button"
              >
                {tab === 'assets' ? '소재' : tab === 'copy' ? '카피' : '오디오'}
              </button>
            ))}
          </div>
        </div>

        {leftTab === 'audio' ? (
          <AudioPanel
            capabilities={audio.capabilities}
            disabled={isRendering}
            job={audio.job}
            onBgmFile={(file) =>
              file
                ? void audio.uploadBgm(file)
                : store().setBgm(null)
            }
            onBgmPatch={(patch) => store().updateBgm(patch)}
            onDucking={(patch) => store().setDucking(patch)}
            onNarrationFile={(kind, file) =>
              void audio.uploadNarration(kind, file)
            }
            onNarrationGenerate={(kind) =>
              void audio.generateNarration(
                kind,
                project.copy[project.selectedLocale]?.sceneSubtitles[kind] ?? '',
              )
            }
            onNarrationRemove={(kind) => store().setNarration(kind, null)}
            onNarrationVolume={(kind, volume) =>
              store().setNarrationVolume(kind, volume)
            }
            onOriginalVolume={(volume) => store().setOriginalVolume(volume)}
            project={project}
          />
        ) : leftTab === 'copy' ? (
          <CopyPanel
            copy={project.copy[project.selectedLocale] as LocalizedCopy}
            disabled={isRendering}
            locale={project.selectedLocale}
            onField={(field, value) => store().setCopy(field, value)}
            onLocale={(locale) => store().setLocale(locale)}
            onSubtitle={(kind, value) => store().setSubtitleText(kind, value)}
          />
        ) : (
          <>
        <label className="upload">
          <input
            accept="video/*"
            data-testid="source-input"
            disabled={isRendering}
            onChange={(event) => void handleUpload(event)}
            type="file"
          />
        </label>

        {source.supportsFilePicker ? (
          <>
            <button
              className="button button--secondary"
              data-testid="source-picker"
              disabled={isRendering}
              onClick={() => void handlePickFile()}
              type="button"
            >
              파일 선택 (다음 실행에서도 복구)
            </button>
            <p className="panel__hint">
              이 버튼으로 선택하면 파일 접근 권한이 저장되어 새로고침 후에도 같은
              영상을 다시 연결할 수 있습니다.
            </p>
          </>
        ) : null}

        <p className="panel__hint">
          영상 1개를 업로드하면 Hook · Gameplay · CTA에 함께 적용됩니다.
        </p>

        {source.busy ? <p className="panel__readout">확인 중…</p> : null}

        {source.uploadError ? (
          <p className="notice notice--error" data-testid="source-error">
            {source.uploadError.message}
          </p>
        ) : null}

        {project.source && project.source.status !== 'available' ? (
          <SourceRepair
            busy={source.busy}
            error={source.relinkError}
            onGrantPermission={
              source.canGrantPermission
                ? () => void source.grantPermission()
                : null
            }
            onRelink={(file) => void source.relinkFromFile(file)}
            reference={project.source}
            verdict={source.relinkVerdict}
          />
        ) : null}

        {persistence.saveState.status === 'failed' ? (
          <p className="notice notice--error" data-testid="autosave-error">
            {persistence.saveState.error.message}
          </p>
        ) : null}

        {project.source ? (
          <dl className="metadata" data-testid="source-metadata">
            <div>
              <dt>이름</dt>
              <dd>{project.source.name}</dd>
            </div>
            <div>
              <dt>형식</dt>
              <dd>{project.source.mimeType}</dd>
            </div>
            <div>
              <dt>길이</dt>
              <dd>{((project.source.durationMs ?? 0) / 1000).toFixed(2)}초</dd>
            </div>
            <div>
              <dt>해상도</dt>
              <dd>
                {project.source.width ?? '-'}×{project.source.height ?? '-'}
              </dd>
            </div>
            <div>
              <dt>재생</dt>
              <dd>{source.sourceUrl ? '디코딩 확인됨' : '연결 필요'}</dd>
            </div>
          </dl>
        ) : (
          <p className="panel__readout">업로드된 영상이 없습니다.</p>
        )}

        <button
          className="button button--secondary"
          disabled={!project.source || isRendering}
          onClick={() => store().reapplySource()}
          type="button"
        >
          세 장면에 다시 적용
        </button>
        <p className="panel__hint">다시 적용하면 모든 장면의 Trim이 0초로 돌아갑니다.</p>

        {capabilities?.blockers.map((message) => (
          <p className="notice notice--error" key={message}>
            {message}
          </p>
        ))}
          </>
        )}
      </aside>

      <main className="stage">
        <div className="stage__frame">
          <Player
            acknowledgeRemotionLicense
            component={ThreeSceneComposition}
            compositionHeight={output.height}
            compositionWidth={output.width}
            durationInFrames={totalFrames}
            fps={project.fps}
            inputProps={compositionProps}
            ref={playerRef}
            style={{height: '100%', width: '100%'}}
          />
        </div>

        <div className="transport">
          <button
            className="button button--secondary"
            onClick={() => playerRef.current?.toggle()}
            type="button"
          >
            {isPlaying ? '일시정지' : '재생'}
          </button>
          <input
            aria-label="재생 위치"
            className="transport__seek"
            max={totalFrames - 1}
            min={0}
            onChange={(event) =>
              seekToMs((Number(event.target.value) / project.fps) * 1000)
            }
            step={1}
            type="range"
            value={Math.min(currentFrame, totalFrames - 1)}
          />
          <span className="transport__time" data-testid="transport-time">
            {formatTimecode(currentMs)} / {formatTimecode(totalMs)}
          </span>
          <span className="transport__scene">
            {SCENE_LABELS[selectedKind]} 선택됨
          </span>
        </div>
      </main>

      <SceneInspector
        disabled={isRendering}
        hasRatioOverride={hasRatioOverride(selectedScene, project.selectedRatio)}
        onCta={(patch) => store().setCta(patch)}
        onCtaAsset={(slot, file) => void source.setCtaAsset(slot, file)}
        onHook={(patch) => store().setHook(patch)}
        onResetTransform={() => store().resetTransform(selectedKind)}
        onSubtitle={(patch) => store().setSubtitleStyle(selectedKind, patch)}
        onToggleRatioOverride={(enabled) =>
          store().toggleRatioOverride(selectedKind, enabled)
        }
        onTransform={(patch) => store().setTransform(selectedKind, patch)}
        onTransition={(patch) => store().setTransition(selectedKind, patch)}
        onTrimInMs={(ms) => store().setTrimIn(selectedKind, ms)}
        onTrimOutMs={(ms) => store().setTrimOut(selectedKind, ms)}
        ratio={project.selectedRatio}
        scene={selectedScene}
        sourceDurationMs={project.source?.durationMs ?? null}
        transform={selectedTransform}
      />

      <HookCandidateDrawer
        analyzer={hookAnalyzer}
        candidateDurationMs={hookCandidateDurationMs(project.durationPreset)}
        disabled={isRendering}
        onSelect={(startMs) => {
          setSelectedKind('hook');
          store().setTrimIn('hook', startMs);
        }}
        selectedStartMs={project.scenes[0].trim.inMs}
        sourceDurationMs={project.source?.durationMs ?? null}
        sourceUrl={source.sourceUrl}
      />

      {batchOpen ? (
        <BatchDialog
          destination={outputDestination}
          jobs={queue.jobs}
          notice={queue.notice}
          onCancel={queue.cancel}
          onChooseDirectory={() => {
            void outputWriter.chooseDirectory().then((result) => {
              setOutputDestination(
                result.ok && result.value ? 'directory' : 'download',
              );
            });
          }}
          onClose={() => setBatchOpen(false)}
          onFilePrefix={(prefix) => store().setRenderFilePrefix(prefix)}
          onFps={(fps) => store().setRenderFps(fps)}
          onProfile={(profile) => store().setRenderProfile(profile)}
          onRetryFailed={() => void queue.retryFailed(project)}
          onStart={() =>
            void queue.start(project, {
              sourceResolved: source.sourceUrl !== null,
              rendererReady: capabilities?.ready === true,
            })
          }
          onToggleLocale={(locale) => store().toggleRenderLocale(locale)}
          onToggleRatio={(ratio) => store().toggleRenderRatio(ratio)}
          onUseDownloads={() => {
            outputWriter.useDownloads();
            setOutputDestination('download');
          }}
          preflight={queue.preflight}
          project={project}
          running={queue.running}
          supportsDirectory={supportsOutputDirectory}
        />
      ) : null}

      <Timeline
        currentMs={currentMs}
        disabled={isRendering}
        onMoveBoundary={(boundary, positionMs) =>
          store().moveBoundary(boundary, positionMs)
        }
        onSeek={seekToMs}
        onSelect={setSelectedKind}
        scenes={project.scenes}
        selectedKind={selectedKind}
      />
    </div>
  );
};
