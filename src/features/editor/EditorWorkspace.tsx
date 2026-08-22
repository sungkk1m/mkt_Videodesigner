// Design Ref: §5.1 Screen Layout (Option A) — header, left assets, center preview,
// right inspector, bottom timeline. Module 3A is 9:16 and 60fps only.
import {Player, type PlayerRef} from '@remotion/player';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {Day1Composition} from '../../compositions/Day1Composition';
import {ThreeSceneComposition} from '../../compositions/ThreeSceneComposition';
import {
  activeTransform,
  buildCompositionProps,
  buildEditorSnapshot,
  buildDay1Props,
  createProject,
  day1MissingPanels,
  day1Of,
  day1PanelsShorterThanSection,
  hasRatioOverride,
  outputDimensions,
  projectTotalFrames,
  threeSceneOf,
  type Day1PanelKey,
} from '../../domain/editor/project';
import {
  ASPECT_RATIOS,
  DEFAULT_TRANSFORM,
  DURATION_PRESETS,
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
  FrameSampler,
  HookAnalyzer,
  MediaHandleStore,
  MediaResolver,
  OutputWriter,
  ProjectRepository,
  RenderCapabilities,
  SourceProxyBuilder,
  VideoRenderer,
} from '../../domain/ports';
import {buildOutputFileName} from '../../domain/render/fileName';
import {FRAME_RATES, PROFILE_SPECS} from '../../domain/render/profile';
import type {
  EditorRenderConfig,
  EditorRenderMetrics,
} from '../../domain/render/types';
import {msToFrames, sceneIndexOf} from '../../domain/timeline/timeline';
import {AudioPanel} from './AudioPanel';
import {BatchDialog} from './BatchDialog';
import './editor.css';
import {CopyPanel} from './CopyPanel';
import {Day1AssetPanel} from './Day1AssetPanel';
import {Day1Inspector} from './Day1Inspector';
import {Dropzone} from './Dropzone';
import {HookCandidateDrawer} from './HookCandidateDrawer';
import {ProjectMenu} from './ProjectMenu';
import {useProjectStore} from './projectStore';
import {SceneInspector} from './SceneInspector';
import {SourceRepair} from './SourceRepair';
import {TemplateSelector} from './TemplateSelector';
import {Timeline} from './Timeline';
import {useDay1Assets, type Day1AssetCommands} from './useDay1Assets';
import {
  useEditorAudio,
  type EditorAudioCommands,
  type TtsCacheGateway,
} from './useEditorAudio';
import {useEditorSource, type EditorSourceCommands} from './useEditorSource';
import {usePanelProxies} from './usePanelProxies';
import {useRenderQueue} from './useRenderQueue';
import {useMediaSession} from './useMediaSession';
import {useProjectPersistence} from './useProjectPersistence';

type RenderState =
  | {status: 'idle'}
  | {status: 'rendering'; progress: number; etaMs: number}
  | {status: 'completed'; blob: Blob; fileName: string; metrics: EditorRenderMetrics}
  | {status: 'cancelled'}
  | {status: 'failed'; message: string};

const formatMegabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

type LeftTab = 'assets' | 'copy' | 'audio' | 'hook';

// Design Ref: §5.1 — the Hook drawer used to own a permanent full-width band.
// Folding it into the rail returns that vertical space to the preview.
const LEFT_TABS: {kind: LeftTab; icon: string; label: string}[] = [
  {kind: 'assets', icon: '🎬', label: '소재'},
  {kind: 'copy', icon: '🅣', label: '카피'},
  {kind: 'audio', icon: '🔊', label: '오디오'},
  {kind: 'hook', icon: '✨', label: 'Hook'},
];

/**
 * Day1 Plan §2.2 puts Hook analysis and narration out of scope, and every field in
 * the copy panel (headline, CTA text, per-scene subtitles) is a three-scene
 * concept — Day1 wording is the two panel labels, which live in the inspector.
 * So Day1 keeps only the tabs that do something.
 */
const DAY1_LEFT_TABS: LeftTab[] = ['assets', 'audio'];

const LEFT_TAB_TITLES: Record<LeftTab, string> = {
  assets: '소재',
  copy: '카피',
  audio: '오디오',
  hook: 'Hook 후보',
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return '알 수 없는 렌더 오류가 발생했습니다.';
};

export interface EditorWorkspaceProps {
  mediaResolver: MediaResolver;
  videoRenderer: VideoRenderer;
  /** Day1 render speed — crops panel sources to the visible area before a render. */
  sourceProxyBuilder: SourceProxyBuilder;
  hookAnalyzer: HookAnalyzer;
  /** Day1 Trim UX Design Ref: §3.1 — feeds the trim strip's thumbnails. */
  frameSampler: FrameSampler;
  ttsProvider: TtsProvider;
  ttsCache: TtsCacheGateway;
  outputWriter: OutputWriter;
  supportsOutputDirectory: boolean;
  projectRepository: ProjectRepository;
  /** Null when the browser has no File System Access support. */
  mediaHandleStore: MediaHandleStore | null;
  /**
   * Null unless the URL asked for debug mode. Returns the captured render log
   * with the given header on top. Injected, like `loadInitialProject`, so the
   * feature layer stays off infrastructure.
   */
  debugReport: ((header: Record<string, unknown>) => string) | null;
  /** Injected by the app shell so features stay off the infrastructure layer. */
  loadInitialProject: (
    repository: ProjectRepository,
  ) => Promise<EditorProject | null | undefined>;
}

export const EditorWorkspace = ({
  mediaResolver,
  videoRenderer,
  sourceProxyBuilder,
  hookAnalyzer,
  frameSampler,
  ttsProvider,
  ttsCache,
  outputWriter,
  supportsOutputDirectory,
  projectRepository,
  mediaHandleStore,
  debugReport,
  loadInitialProject,
}: EditorWorkspaceProps) => {
  const project = useProjectStore((state) => state.project);
  const [selectedKind, setSelectedKind] = useState<SceneKind>('hook');
  // Day1 shows both panels in one inspector, so the selection only drives the
  // timeline highlight. Day1 Design Ref: §6.3.
  const [selectedDay1Section, setSelectedDay1Section] = useState('panel-a');
  const [leftTab, setLeftTab] = useState<LeftTab>('assets');
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [debugLogCopied, setDebugLogCopied] = useState(false);
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

  const resolveUrl = useCallback(
    (reference: MediaReference | null | undefined) =>
      session.urlFor(reference?.id),
    [session],
  );

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

  const day1Commands = useMemo<Day1AssetCommands>(
    () => ({
      setPanelSource: (panel, reference) =>
        store().setDay1PanelSource(panel, reference),
      relinkPanel: (panel, reference) => store().relinkDay1Panel(panel, reference),
      setPanelStatus: (panel, status) => store().setDay1PanelStatus(panel, status),
      setEndCardAsset: (slot, reference) =>
        // Endcard-Video D-04 — the video slot goes through its own command so
        // setting it also resets the trim window; images stay on the patch.
        slot === 'video'
          ? store().setDay1EndCardVideo(reference)
          : store().setDay1EndCard({[slot]: reference}),
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
  // Day1 Design Ref: §3.2 — the one place the template discriminant is read in the
  // editor. Everything below narrows through `threeScene` or `day1`.
  const threeScene = threeSceneOf(project);
  const day1 = day1Of(project);
  const selectedIndex = sceneIndexOf(selectedKind);
  const selectedScene = threeScene?.scenes[selectedIndex] ?? null;
  const selectedSectionMs = project.sections[selectedIndex]?.durationMs ?? 0;
  const projectSource = threeScene?.source ?? null;
  const isRendering = renderState.status === 'rendering';

  const day1Assets = useDay1Assets({
    resolver: mediaResolver,
    handleStore: mediaHandleStore,
    session,
    project,
    commands: day1Commands,
  });

  const audio = useEditorAudio({
    resolver: mediaResolver,
    provider: ttsProvider,
    cache: ttsCache,
    session,
    project,
    commands: audioCommands,
  });

  // Day1 render speed — shared by the single render and the batch queue, so the
  // panels are cropped to their visible area whichever button started the job.
  const panelProxies = usePanelProxies({
    builder: sourceProxyBuilder,
    resolveUrl,
    releaseUrl: mediaResolver.release,
  });

  const queue = useRenderQueue({
    renderer: videoRenderer,
    writer: outputWriter,
    resolveUrl,
    proxies: panelProxies,
  });

  const persistence = useProjectPersistence({
    repository: projectRepository,
    project,
    onRestore: (restored) => store().replaceProject(restored),
    loadInitial: loadInitialProject,
    paused: isRendering || queue.running,
  });

  // Design Ref: §7 — revoke object URLs the project no longer references.
  const ctaAssets = threeScene?.scenes[2].cta;
  const referencedIds = [
    projectSource?.id,
    ctaAssets?.media?.id,
    ctaAssets?.appIcon?.id,
    ctaAssets?.logo?.id,
    ctaAssets?.storeBadge?.id,
    // Day1 Design Ref: §6.2 — panel and end card media are retained the same way.
    day1?.panelA.source?.id,
    day1?.panelB.source?.id,
    day1?.endCard.banner?.id,
    day1?.endCard.appIcon?.id,
    day1?.endCard.video?.id,
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

  const compositionProps = useMemo(
    () => buildCompositionProps(project, resolveUrl),
    [project, resolveUrl],
  );

  // Day1 Design Ref: §2.2 — the Player and the render job consume one snapshot.
  const day1Props = useMemo(
    () => buildDay1Props(project, resolveUrl),
    [project, resolveUrl],
  );

  const output = outputDimensions(project.selectedRatio);
  const selectedTransform = selectedScene
    ? activeTransform(selectedScene, project.selectedRatio)
    : DEFAULT_TRANSFORM;

  // FR-D03 — a Day1 render needs both panels present *and* decodable.
  const missingPanels = day1MissingPanels(project);
  const unresolvedPanels = day1
    ? (['panelA', 'panelB'] as Day1PanelKey[]).filter(
        (panel) => day1Assets.panelUrl(panel) === null,
      )
    : [];
  const renderableSource = day1
    ? unresolvedPanels.length === 0
    : source.sourceUrl !== null;
  // Day1 Trim UX FR-S03 — `preflightIssues` gates Batch, but the single render
  // button keeps its own list, so the short-source block has to be stated twice
  // or it only half-applies.
  const shortPanels = day1PanelsShorterThanSection(project);

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

  const handleUpload = async (file: File) => {
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
    // blocks the render rather than being truncated. Day1 Design Ref: §7 — a Day1
    // project with an unresolved panel is blocked the same way.
    if (
      !capabilities?.ready ||
      !renderableSource ||
      narrationTooLong.length > 0 ||
      // FR-S03 — a short panel renders black, so the job never starts.
      shortPanels.length > 0
    ) {
      return;
    }

    const config: EditorRenderConfig = {
      durationPreset: project.durationPreset,
      fps: project.fps,
      ratio: project.selectedRatio,
      locale: project.selectedLocale,
      // day1-render-fps FR-05/D-05 — without this the single render always fell
      // back to the Standard bitrate, whatever profile the project had chosen.
      profile: project.render.profile,
      outputTarget: capabilities.preferredOutputTarget,
    };
    const fileName = buildOutputFileName(project.name, config);
    const controller = new AbortController();

    controllerRef.current = controller;
    playerRef.current?.pause();
    setRenderState({status: 'rendering', progress: 0, etaMs: 0});

    try {
      const result = await panelProxies.run(async (proxies) => {
        // Day1 render speed — the panels are cropped to what this ratio actually
        // shows before a frame is rendered. `prepare` hands back the project
        // untouched when cropping would not help or could not run.
        const prepared = await proxies.prepare({
          project,
          ratio: project.selectedRatio,
          fps: project.fps,
          signal: controller.signal,
        });

        // Design Ref: §4.3 — freeze the edit state so later UI changes cannot
        // mutate the active job. Day1 Design Ref: §2.1 — the snapshot carries its
        // template, so the adapter renders the matching composition.
        return videoRenderer.render({
          snapshot: buildEditorSnapshot(prepared.project, prepared.resolveUrl),
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

  /**
   * Debug mode only. A stalled-decode report is unreadable without the machine
   * and the settings it came from. The codec lists stay out of it: the domain
   * port exposes blockers and warnings, which already name a missing codec, and
   * widening the port for a debug string is not worth it.
   */
  const copyDebugLog = async () => {
    if (!debugReport) {
      return;
    }

    const report = debugReport({
      // Which bundle actually ran. A CDN-cached index.html keeps serving the
      // previous one, and without this an unchanged behaviour is impossible to
      // tell apart from an unchanged build.
      build: __BUILD_ID__,
      userAgent: navigator.userAgent,
      blockers: capabilities?.blockers ?? null,
      warnings: capabilities?.warnings ?? null,
      outputTarget: capabilities?.preferredOutputTarget ?? null,
      template: day1 ? 'day1' : 'three-scene',
      fps: project.fps,
      profile: project.render.profile,
      ratio: project.selectedRatio,
      renderStatus: renderState.status,
      // Day1 render speed — whether each panel was cropped, and why not if not.
      sourceProxy:
        panelProxies.notes.length > 0 ? panelProxies.notes.join(' | ') : 'none',
    });

    await navigator.clipboard.writeText(report);
    setDebugLogCopied(true);
    window.setTimeout(() => setDebugLogCopied(false), 2000);
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

  if (!threeScene && !day1) {
    return (
      <div className="workspace workspace--notice">
        <p className="notice notice--error" data-testid="template-unsupported">
          이 프로젝트는 아직 편집기가 지원하지 않는 템플릿입니다. 원본은 그대로
          두었습니다.
        </p>
      </div>
    );
  }

  const visibleTabs = day1
    ? LEFT_TABS.filter((tab) => DAY1_LEFT_TABS.includes(tab.kind))
    : LEFT_TABS;
  const activeTab = day1 && !DAY1_LEFT_TABS.includes(leftTab) ? 'assets' : leftTab;

  return (
    <div
      className={`editor${panelCollapsed ? ' editor--panel-collapsed' : ''}`}
    >
      {/* Identity and the final action only. Everything that shapes the output
          moved to the floating toolbar over the preview. Design Ref: §5.1. */}
      <header className="editor__header">
        <div className="editor__brand">
          <span aria-hidden="true" className="editor__mark">
            V
          </span>
          <span className="editor__title">UA Video Designer</span>
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
          {/* Day1 Design Ref: §6.1 — template choice sits next to the identity. */}
          <TemplateSelector
            current={project.templateSettings.template}
            disabled={isRendering}
            onSwitch={(template) => {
              store().switchTemplate(template);
              setSelectedKind('hook');
              setSelectedDay1Section('panel-a');
              setLeftTab('assets');
              setRenderState({status: 'idle'});
              seekToMs(0);
            }}
          />
        </div>

        <div className="editor__actions">
          {narrationTooLong.length > 0 ? (
            <span className="editor__blocker" data-testid="render-blocker">
              나레이션 {narrationTooLong.length}개가 장면보다 깁니다
            </span>
          ) : null}
          {day1 && missingPanels.length > 0 ? (
            <span className="editor__blocker" data-testid="day1-render-blocker">
              영상 {missingPanels.length}개가 더 필요합니다
            </span>
          ) : null}
          {shortPanels.length > 0 ? (
            <span className="editor__blocker" data-testid="day1-short-blocker">
              원본이 구간보다 짧은 패널 {shortPanels.length}개
            </span>
          ) : null}
          <span className="editor__status" data-testid="editor-render-status">
            {renderStatusText}
          </span>
          {debugReport ? (
            <button
              className="button button--secondary"
              data-testid="copy-debug-log"
              onClick={() => void copyDebugLog()}
              type="button"
            >
              {debugLogCopied ? '복사됨' : '진단 로그 복사'}
            </button>
          ) : null}
          {renderState.status === 'completed' ? (
            <button
              className="button button--secondary"
              onClick={downloadOutput}
              type="button"
            >
              다운로드
            </button>
          ) : null}
          <button
            className="button button--secondary"
            data-testid="open-batch"
            disabled={isRendering}
            onClick={() => setBatchOpen(true)}
            type="button"
          >
            Batch
          </button>
          {isRendering ? (
            <button
              className="button button--danger"
              onClick={() => controllerRef.current?.abort()}
              type="button"
            >
              취소
            </button>
          ) : null}
          {/* The button carries its own progress fill so the header keeps a
              stable width while rendering. */}
          <button
            className="button button--primary render-button"
            disabled={
              isRendering ||
              !capabilities?.ready ||
              !renderableSource ||
              narrationTooLong.length > 0 ||
              shortPanels.length > 0
            }
            onClick={() => void startRender()}
            type="button"
          >
            {isRendering ? (
              <span
                className="render-button__fill"
                style={{width: `${renderState.progress * 100}%`}}
              />
            ) : null}
            <span className="render-button__label">
              {isRendering
                ? `${Math.round(renderState.progress * 100)}%`
                : 'MP4 렌더'}
            </span>
          </button>
        </div>
      </header>

      <nav aria-label="입력 탭" className="rail">
        {visibleTabs.map((tab) => (
          <button
            aria-pressed={activeTab === tab.kind && !panelCollapsed}
            className={`rail__tab${
              activeTab === tab.kind && !panelCollapsed ? ' rail__tab--on' : ''
            }`}
            data-testid={`tab-${tab.kind}`}
            key={tab.kind}
            onClick={() => {
              setLeftTab(tab.kind);
              setPanelCollapsed(false);
            }}
            type="button"
          >
            <span aria-hidden="true" className="rail__icon">
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
        <span className="rail__spacer" />
        <button
          aria-label={panelCollapsed ? '패널 펼치기' : '패널 접기'}
          className="rail__collapse"
          data-testid="panel-collapse"
          onClick={() => setPanelCollapsed((value) => !value)}
          title={panelCollapsed ? '패널 펼치기' : '패널 접기'}
          type="button"
        >
          {panelCollapsed ? '❯' : '❮'}
        </button>
      </nav>

      <aside aria-label={LEFT_TAB_TITLES[activeTab]} className="panel" hidden={panelCollapsed}>
        <div className="panel__head">
          <h2>{LEFT_TAB_TITLES[activeTab]}</h2>
        </div>

        <div className="panel__body">
        {day1 && activeTab === 'assets' ? (
          <Day1AssetPanel
            autosaveError={
              persistence.saveState.status === 'failed'
                ? persistence.saveState.error
                : null
            }
            busy={day1Assets.busy}
            canGrantPermission={day1Assets.canGrantPermission}
            disabled={isRendering}
            missingPanels={missingPanels}
            onGrantPermission={(panel) =>
              void day1Assets.grantPanelPermission(panel)
            }
            onPickFile={(panel) => void day1Assets.pickAndUploadPanel(panel)}
            onRelink={(panel, file) => void day1Assets.relinkPanel(panel, file)}
            onUpload={(panel, file) => void day1Assets.uploadPanel(panel, file)}
            panelUrl={day1Assets.panelUrl}
            relinkVerdict={day1Assets.relinkVerdict}
            settings={day1}
            supportsFilePicker={day1Assets.supportsFilePicker}
            uploadError={day1Assets.uploadError}
          />
        ) : activeTab === 'hook' ? (
          <HookCandidateDrawer
            analyzer={hookAnalyzer}
            candidateDurationMs={hookCandidateDurationMs(project.durationPreset)}
            disabled={isRendering}
            onSelect={(startMs) => {
              setSelectedKind('hook');
              store().setTrimIn('hook', startMs);
            }}
            selectedStartMs={threeScene?.scenes[0].trim.inMs ?? 0}
            sourceDurationMs={projectSource?.durationMs ?? null}
            sourceUrl={source.sourceUrl}
          />
        ) : activeTab === 'audio' ? (
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
        ) : activeTab === 'copy' ? (
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
            <Dropzone
              disabled={isRendering}
              fileName={projectSource?.name ?? null}
              hint="영상을 끌어다 놓거나 클릭해 선택"
              inputTestId="source-input"
              kind="video"
              onFile={(file) => void handleUpload(file)}
              previewUrl={source.sourceUrl}
              prompt="게임플레이 영상"
            />

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
                  이 버튼으로 선택하면 파일 접근 권한이 저장되어 새로고침 후에도
                  같은 영상을 다시 연결할 수 있습니다.
                </p>
              </>
            ) : null}

            <p className="panel__hint">
              영상 1개를 업로드하면 Hook · Gameplay · CTA에 함께 적용됩니다.
            </p>

            {source.busy ? <p className="panel__hint">확인 중…</p> : null}

            {source.uploadError ? (
              <p className="notice notice--error" data-testid="source-error">
                {source.uploadError.message}
              </p>
            ) : null}

            {projectSource && projectSource.status !== 'available' ? (
              <SourceRepair
                busy={source.busy}
                error={source.relinkError}
                onGrantPermission={
                  source.canGrantPermission
                    ? () => void source.grantPermission()
                    : null
                }
                onRelink={(file) => void source.relinkFromFile(file)}
                reference={projectSource}
                verdict={source.relinkVerdict}
              />
            ) : null}

            {persistence.saveState.status === 'failed' ? (
              <p className="notice notice--error" data-testid="autosave-error">
                {persistence.saveState.error.message}
              </p>
            ) : null}

            {projectSource ? (
              <dl className="metadata" data-testid="source-metadata">
                <div>
                  <dt>이름</dt>
                  <dd>{projectSource.name}</dd>
                </div>
                <div>
                  <dt>형식</dt>
                  <dd>{projectSource.mimeType}</dd>
                </div>
                <div>
                  <dt>길이</dt>
                  <dd>
                    {((projectSource.durationMs ?? 0) / 1000).toFixed(2)}초
                  </dd>
                </div>
                <div>
                  <dt>해상도</dt>
                  <dd>
                    {projectSource.width ?? '-'}×{projectSource.height ?? '-'}
                  </dd>
                </div>
                <div>
                  <dt>재생</dt>
                  <dd>{source.sourceUrl ? '디코딩 확인됨' : '연결 필요'}</dd>
                </div>
              </dl>
            ) : null}

            <button
              className="button button--secondary"
              disabled={!projectSource || isRendering}
              onClick={() => store().reapplySource()}
              type="button"
            >
              세 장면에 다시 적용
            </button>
            <p className="panel__hint">
              다시 적용하면 모든 장면의 Trim이 0초로 돌아갑니다.
            </p>

            {capabilities?.blockers.map((message) => (
              <p className="notice notice--error" key={message}>
                {message}
              </p>
            ))}
          </>
        )}
        </div>
      </aside>

      <main className="stage">
        {/* Output shape lives over the preview, Clipchamp-style, so changing it
            is done while looking at the frame it affects. */}
        <div className="stage__toolbar">
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
          <span className="stage__divider" />
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
          <span className="stage__divider" />
          <span className="stage__chip" data-testid="output-size">
            {output.width}×{output.height}
          </span>
          {/* day1-render-fps FR-02/D-01 — the chip that used to hardcode "60fps"
              is now the control itself, so the display can never disagree with
              project.fps. Allowed rates derive from the profile (FR-03). */}
          <div aria-label="프레임 레이트" className="segmented" role="group">
            {FRAME_RATES.map((entry) => (
              <button
                aria-pressed={project.fps === entry}
                className={`segmented__item${
                  project.fps === entry ? ' segmented__item--on' : ''
                }`}
                data-testid={`stage-fps-${entry}`}
                disabled={
                  isRendering ||
                  !PROFILE_SPECS[project.render.profile].allowedFps.includes(entry)
                }
                key={entry}
                onClick={() => store().setRenderFps(entry)}
                type="button"
              >
                {entry}fps
              </button>
            ))}
          </div>
        </div>

        <div
          className="stage__frame"
          style={{aspectRatio: `${output.width} / ${output.height}`}}
        >
          {/* Day1 Design Ref: §2.1 — the template picks the composition, and each
              one gets the snapshot its own prop builder produced. */}
          {day1 && day1Props ? (
            <Player
              acknowledgeRemotionLicense
              component={Day1Composition}
              compositionHeight={output.height}
              compositionWidth={output.width}
              durationInFrames={totalFrames}
              fps={project.fps}
              inputProps={day1Props}
              ref={playerRef}
              style={{height: '100%', width: '100%'}}
            />
          ) : (
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
          )}
        </div>

      </main>

      {day1 ? (
        <Day1Inspector
          activeTransformOf={(panel) =>
            activeTransform(day1[panel], project.selectedRatio)
          }
          copy={project.copy}
          disabled={isRendering}
          frameSampler={frameSampler}
          hasRatioOverride={(panel) =>
            hasRatioOverride(day1[panel], project.selectedRatio)
          }
          onEndCard={(patch) => store().setDay1EndCard(patch)}
          onEndCardAsset={(slot, file) =>
            void day1Assets.setEndCardAsset(slot, file)
          }
          onEndCardTrimIn={(ms) => store().setDay1EndCardTrimIn(ms)}
          onEndCardTrimLength={(ms) => store().setDay1EndCardTrimLength(ms)}
          onLabelStyle={(patch) => store().setDay1LabelStyle(patch)}
          onLabelText={(locale, panel, value) =>
            store().setDay1LabelAt(locale, panel, value)
          }
          onResetTransform={(panel) => store().resetDay1Transform(panel)}
          onSplit={(patch) => store().setDay1Split(patch)}
          onToggleRatioOverride={(panel, enabled) =>
            store().toggleDay1RatioOverride(panel, enabled)
          }
          onTransform={(panel, patch) => store().setDay1Transform(panel, patch)}
          onTrimIn={(panel, ms) => store().setDay1TrimIn(panel, ms)}
          panelDurationsMs={{
            panelA: project.sections[0]?.durationMs ?? 0,
            panelB: project.sections[1]?.durationMs ?? 0,
          }}
          ratio={project.selectedRatio}
          resolveEndCardUrl={(slot) => resolveUrl(day1.endCard[slot])}
          resolvePanelUrl={(panel) => day1Assets.panelUrl(panel)}
          settings={day1}
        />
      ) : selectedScene ? (
      <SceneInspector
        disabled={isRendering}
        hasRatioOverride={
          selectedScene
            ? hasRatioOverride(selectedScene, project.selectedRatio)
            : false
        }
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
        resolveCtaAssetUrl={(slot) => resolveUrl(selectedScene?.cta?.[slot])}
        scene={selectedScene}
        sceneDurationMs={selectedSectionMs}
        sourceDurationMs={projectSource?.durationMs ?? null}
        transform={selectedTransform}
      />
      ) : null}

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
              // Day1 Design Ref: §7 — for Day1 this means both panels decoded,
              // which `renderableSource` already resolves per template.
              sourceResolved: renderableSource,
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
        currentFrame={currentFrame}
        currentMs={currentMs}
        disabled={isRendering}
        isPlaying={isPlaying}
        onMoveBoundary={(boundary, positionMs) =>
          store().moveBoundary(boundary, positionMs)
        }
        onSeek={seekToMs}
        onSeekFrame={(frame) => seekToMs((frame / project.fps) * 1000)}
        onSelect={(sectionId) =>
          day1
            ? setSelectedDay1Section(sectionId)
            : setSelectedKind(sectionId as SceneKind)
        }
        onTogglePlay={() => playerRef.current?.toggle()}
        sections={project.sections}
        selectedId={day1 ? selectedDay1Section : selectedKind}
        totalDurationMs={totalMs}
        totalFrames={totalFrames}
      />
    </div>
  );
};
