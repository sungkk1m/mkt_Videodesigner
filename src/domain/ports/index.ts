// Design Ref: §4.1 Port List and §9.2 — features depend on these contracts, not
// on Remotion, the File API, or any other SDK. Swapping an adapter is a change
// in `src/app`, not in the editor.
//
// Scope note: only the ports with an implementation today are declared.
// `TtsProvider`, `HookAnalyzer`, and `OutputWriter` are declared by the modules
// that implement them.
import type {
  EditorProject,
  EditorSnapshot,
  MediaReference,
  ResolvedMedia,
} from '../editor/types';
import type {CropRect} from '../day1/sourceProxy';
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

/**
 * Day1 Trim UX Design Ref: §3.1 FrameSampler — decodes frames out of a source
 * video at times the caller picks. Hook analysis wants a 500ms grid with raw
 * pixels for the scoring worker; the trim strip wants a fixed cell count and
 * thumbnails only. Leaving the grid to the caller is what keeps one sampler
 * serving both (§1.5 D-D01).
 */
export interface SampledFrame {
  timeMs: number;
  width: number;
  height: number;
  /** Small JPEG data URL, always produced. */
  thumbnail: string;
  /** Raw RGBA pixels, transferable. Null unless the request set `needsPixels`. */
  pixels: ArrayBuffer | null;
}

export interface FrameSampleRequest {
  /** Session object URL of the source video. */
  url: string;
  /** Sample times in source time, ascending. */
  timesMs: readonly number[];
  /** Longest edge of the decoded frame, in px. */
  maxEdge: number;
  /** Set when the caller needs raw pixels as well as the thumbnail. */
  needsPixels: boolean;
  signal: AbortSignal;
  /**
   * Called once per decoded frame, in `timesMs` order. Frames arrive as they
   * decode so a caller can paint progressively (Day1 Trim UX FR-T03).
   */
  onFrame: (frame: SampledFrame) => void;
}

export interface FrameSampler {
  /**
   * Resolves once every frame has been delivered to `onFrame`. The frames
   * themselves went out through the callback, so the result only reports
   * whether the run finished and why it stopped if it did not.
   */
  sample(request: FrameSampleRequest): Promise<Result<void>>;
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
  /**
   * Day1 Design Ref: §2.1 — tagged with its template so the adapter picks the
   * composition instead of guessing from the prop shape.
   */
  snapshot: EditorSnapshot;
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

/**
 * Day1 render speed — re-encodes a panel source down to the rectangle the panel
 * actually shows, so the render stops decoding pixels that `objectFit: cover`
 * throws away. `planPanelProxy` decides the rectangle; this only carries it out.
 *
 * Building a proxy is an optimisation, never a requirement: a failure leaves the
 * caller rendering the original source at the original speed.
 */
export interface SourceProxyRequest {
  /** Session object URL of the original source. */
  url: string;
  crop: CropRect;
  /** Source time window to convert, in seconds. */
  fromSeconds: number;
  toSeconds: number;
  signal: AbortSignal;
}

export interface SourceProxy {
  /** Object URL of the proxy. The caller owns releasing it. */
  url: string;
  /**
   * Seconds to add to a proxy timestamp to get back the source timestamp. Read
   * from the finished file rather than assumed, so the caller's trim rebasing
   * holds whether or not the transcoder rebased the timeline to zero.
   */
  sourceTimeOffsetSeconds: number;
  sizeBytes: number;
  /** How long the transcode took, which is what the saving is measured against. */
  elapsedMs: number;
}

export interface SourceProxyBuilder {
  build(request: SourceProxyRequest): Promise<Result<SourceProxy>>;
}
