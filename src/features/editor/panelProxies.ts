// Day1 render speed — swaps each panel's source for one cropped down to what the
// panel actually shows, for the duration of a render job.
//
// This is the "render-time preparation" half of the plan: the project itself is
// never touched, so nothing here can reach persistence, relink, or the framing
// controls. A proxy is derived data, keyed by the crop it was built for, and it
// dies with the queue run that built it.
import {
  MIN_PROXY_SAVINGS,
  panelVisibleRect,
  planPanelProxy,
} from '../../domain/day1/sourceProxy';
import {splitLayout} from '../../domain/day1/layout';
import {activeTransform, day1Of, type Day1PanelKey} from '../../domain/editor/project';
import type {
  AspectRatio,
  Day1Panel,
  EditorProject,
  MediaReference,
} from '../../domain/editor/types';
import type {SourceProxyBuilder} from '../../domain/ports';
import type {FrameRate} from '../../domain/render/profile';
import {msToFrames} from '../../domain/timeline/timeline';

type ResolveUrl = (reference: MediaReference | null | undefined) => string | null;

export interface PreparedRender {
  /** The project to build the render snapshot from. */
  project: EditorProject;
  /** Resolver that knows the proxy URLs as well as the session's own. */
  resolveUrl: ResolveUrl;
}

export interface PrepareRequest {
  project: EditorProject;
  ratio: AspectRatio;
  /**
   * The fps the snapshot will be built at. Passed in rather than read off the
   * project because the two render paths disagree: the batch queue renders at
   * `render.fps` and the single render at the editor's own `fps`. A proxy trimmed
   * at the wrong one starts on the wrong frame.
   */
  fps: FrameRate;
  signal: AbortSignal;
}

export interface PanelProxies {
  prepare: (request: PrepareRequest) => Promise<PreparedRender>;
  /**
   * One line per panel prepared, for the ?debug report header.
   *
   * The header rather than the log: at trace level the render writes past the
   * log's 2000-line ring buffer within the first second, so anything recorded
   * while preparing is gone by the time the report is copied. Learned the hard
   * way — the first deployment of this could not be diagnosed at all.
   */
  notes: () => readonly string[];
  /** Revokes every proxy URL built so far. Call once a queue run is done. */
  release: () => void;
}

interface Prepared {
  source: MediaReference;
  panel: Day1Panel;
  url: string;
}

const PANEL_KEYS = ['panelA', 'panelB'] as const;

export const createPanelProxies = ({
  builder,
  resolveUrl,
  release: releaseUrl,
}: {
  builder: SourceProxyBuilder;
  resolveUrl: ResolveUrl;
  release: (url: string) => void;
}): PanelProxies => {
  // Keyed by source id and crop, so the four locale jobs of one batch share a
  // single transcode while two panels cut from the same file do not collide.
  const built = new Map<string, Prepared>();
  const notes: string[] = [];

  const preparePanel = async (
    {project, ratio, fps, signal}: PrepareRequest,
    key: Day1PanelKey,
  ): Promise<Prepared | null> => {
    const settings = day1Of(project);
    const panel = settings?.[key];
    const source = panel?.source;

    if (!settings || !panel) {
      return null;
    }

    if (!source?.width || !source.height) {
      notes.push(`${key}: skipped, source dimensions unknown`);
      return null;
    }

    const url = resolveUrl(source);

    if (!url) {
      notes.push(`${key}: skipped, source not resolved in this session`);
      return null;
    }

    const layout = splitLayout(ratio, settings.split.lineWidthPx);
    const plan = planPanelProxy(
      key === 'panelA' ? layout.a : layout.b,
      {width: source.width, height: source.height},
      activeTransform(panel, ratio),
    );

    if (!plan) {
      const size = {width: source.width, height: source.height};
      const box = key === 'panelA' ? layout.a : layout.b;
      const visible = panelVisibleRect(box, size, activeTransform(panel, ratio));
      const outside =
        visible.left < 0 ||
        visible.top < 0 ||
        visible.left + visible.width > size.width ||
        visible.top + visible.height > size.height;

      notes.push(
        outside
          ? `${key}: skipped, framing reaches outside the ${size.width}x${size.height} source`
          : `${key}: skipped, crop would save under ${Math.round(MIN_PROXY_SAVINGS * 100)}%`,
      );

      return null;
    }

    // Frame-aligned to the render's own fps so the proxy starts on the frame the
    // render would have asked for, not on whichever sample sits nearest the
    // millisecond.
    const fromFrame = msToFrames(panel.trim.inMs, fps);
    const toFrame = Math.max(fromFrame + 1, msToFrames(panel.trim.outMs, fps));
    const fromSeconds = fromFrame / fps;
    const toSeconds = toFrame / fps;
    const cacheKey = [
      source.id,
      plan.crop.left,
      plan.crop.top,
      plan.crop.width,
      plan.crop.height,
      fromFrame,
      toFrame,
    ].join(':');
    const cached = built.get(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await builder.build({
      url,
      crop: plan.crop,
      fromSeconds,
      toSeconds,
      signal,
    });

    // An optimisation that failed is not a failed render: fall back to the
    // original source and let the job run at the original speed. The reason is
    // still reported, because a silent fallback is indistinguishable from a
    // stale deployment.
    if (!result.ok) {
      notes.push(
        `${key}: failed, ${String((result.error.cause as Error)?.message ?? result.error.code)}`,
      );

      return null;
    }

    notes.push(
      `${key}: ${plan.crop.width}x${plan.crop.height} at ${plan.crop.left},${plan.crop.top}` +
        ` (-${Math.round(plan.savings * 100)}% pixels)` +
        ` ${(result.value.sizeBytes / 1e6).toFixed(1)}MB in ${result.value.elapsedMs}ms`,
    );

    const {sourceTimeOffsetSeconds} = result.value;
    const prepared: Prepared = {
      source: {
        ...source,
        id: cacheKey,
        width: plan.crop.width,
        height: plan.crop.height,
        sizeBytes: result.value.sizeBytes,
        durationMs: Math.round((toSeconds - sourceTimeOffsetSeconds) * 1000),
      },
      // The trim moves with the proxy's timeline: the offset the builder read
      // back is zero when the transcoder kept the original timestamps, and the
      // window's start when it rebased them.
      panel: {
        ...panel,
        trim: {
          inMs: (fromSeconds - sourceTimeOffsetSeconds) * 1000,
          outMs: (toSeconds - sourceTimeOffsetSeconds) * 1000,
        },
        transforms: {...panel.transforms, base: plan.transform, overrides: {}},
      },
      url: result.value.url,
    };

    built.set(cacheKey, prepared);

    return prepared;
  };

  return {
    prepare: async (request) => {
      const {project} = request;
      const settings = day1Of(project);

      if (!settings) {
        return {project, resolveUrl};
      }

      const panels = await Promise.all(
        PANEL_KEYS.map((key) => preparePanel(request, key)),
      );

      if (panels.every((panel) => panel === null)) {
        return {project, resolveUrl};
      }

      const urls = new Map(
        panels
          .filter((panel): panel is Prepared => panel !== null)
          .map((panel) => [panel.source.id, panel.url]),
      );
      const patched = {...settings};

      PANEL_KEYS.forEach((key, index) => {
        const prepared = panels[index];

        if (prepared) {
          patched[key] = {...prepared.panel, source: prepared.source};
        }
      });

      return {
        project: {...project, templateSettings: patched},
        resolveUrl: (reference) =>
          (reference ? urls.get(reference.id) : undefined) ??
          resolveUrl(reference),
      };
    },

    notes: () => notes,

    release: () => {
      for (const prepared of built.values()) {
        releaseUrl(prepared.url);
      }

      built.clear();
    },
  };
};
