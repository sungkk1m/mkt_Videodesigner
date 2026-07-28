// Design Ref: §4.1 Port List and §9.2 — features depend on these contracts, not
// on Remotion, the File API, or any other SDK. Swapping an adapter is a change
// in `src/app`, not in the editor.
//
// Scope note: only the ports with an implementation today are declared.
// `TtsProvider`, `HookAnalyzer`, and `OutputWriter` are declared by the modules
// that implement them.
import type {
  EditorProject,
  MediaReference,
  ResolvedMedia,
  ThreeSceneProps,
} from '../editor/types';
import type {HookCandidate} from '../hook/scoring';
import type {
  EditorRenderConfig,
  EditorRenderMetrics,
  OutputTarget,
} from '../render/types';
import type {Result} from '../../shared/errors/appError';

export interface RenderProgressEvent {
  encodedFrames: number;
  progress: number;
  renderEstimatedTime: number;
  doneIn: number | null;
}

export interface MediaResolver {
  /** Probes a local video into a persistable reference plus a session URL. */
  probe(file: File): Promise<Result<ResolvedMedia>>;
  /** Probes a still image used by the CTA scene. */
  probeImage(file: File): Promise<Result<ResolvedMedia>>;
  /** Probes BGM or uploaded narration. */
  probeAudio(file: File): Promise<Result<ResolvedMedia>>;
  /** Releases a session URL previously returned by `probe`. */
  release(url: string): void;
}

/** Design Ref: §4.4 HookAnalyzer — heuristic candidate intervals. */
export interface HookCandidateWithThumbnail extends HookCandidate {
  /** Small JPEG data URL for the filmstrip, or null when capture failed. */
  thumbnail: string | null;
}

export interface HookAnalysisRequest {
  /** Session object URL of the source video. */
  url: string;
  sourceDurationMs: number;
  candidateDurationMs: number;
  signal: AbortSignal;
  onProgress: (progress: number) => void;
}

export interface HookAnalyzer {
  analyze(
    request: HookAnalysisRequest,
  ): Promise<Result<HookCandidateWithThumbnail[]>>;
}

/**
 * Design Ref: §4.1 OutputWriter — a chosen directory when the browser allows it,
 * a normal browser download otherwise.
 */
export interface OutputWriter {
  readonly destination: 'directory' | 'download';
  /** Resolves true when a directory was granted, false when the user declined. */
  chooseDirectory(): Promise<Result<boolean>>;
  useDownloads(): void;
  /** Returns the name actually written, which may carry a collision suffix. */
  write(fileName: string, blob: Blob): Promise<Result<string>>;
}

/** Design Ref: §4.1 ProjectRepository — IndexedDB-backed project metadata. */
export interface StoredProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  sourceName: string | null;
}

export interface ProjectRepository {
  save(project: EditorProject): Promise<Result<void>>;
  load(id: string): Promise<Result<EditorProject | null>>;
  /** Most recently updated first. */
  list(): Promise<Result<StoredProjectSummary[]>>;
  delete(id: string): Promise<Result<void>>;
}

/**
 * Design Ref: §3.6 IndexedDB `file-handles` — a File System Access handle can
 * outlive a session, but reading it again may need renewed permission.
 */
export interface MediaHandleStore {
  put(mediaId: string, handle: FileSystemFileHandle): Promise<void>;
  get(mediaId: string): Promise<FileSystemFileHandle | null>;
  delete(mediaId: string): Promise<void>;
  /** Resolves the handle to a File, requesting permission only when asked. */
  resolve(
    mediaId: string,
    options: {requestPermission: boolean},
  ): Promise<Result<File>>;
}

export interface RenderCapabilities {
  ready: boolean;
  blockers: string[];
  warnings: string[];
  preferredOutputTarget: OutputTarget;
}

export interface RenderRequest {
  snapshot: ThreeSceneProps;
  config: EditorRenderConfig;
  signal: AbortSignal;
  onProgress: (event: RenderProgressEvent) => void;
}

export interface VideoRenderer {
  probe(): Promise<RenderCapabilities>;
  render(
    request: RenderRequest,
  ): Promise<{blob: Blob; metrics: EditorRenderMetrics}>;
}
