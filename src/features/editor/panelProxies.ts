// Day1 render speed — swaps each panel's source for one cropped down to what the
// panel actually shows, for the duration of a render job.
//
// This is the "render-time preparation" half of the plan: the project itself is
// never touched, so nothing here can reach persistence, relink, or the framing
// controls. A proxy is derived data, keyed by the crop it was built for.
//
// Proxies outlive the render that built them. Measured, a single render was
// break-even — 4.67s to build against a 4.72s saving — so the gain only appears
// where the transcode is reused. Keeping them costs little: 4.3MB per panel, and
// the store holds at most one per panel per ratio.
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
  /** Forgets the notes of the previous run. */
  clearNotes: () => void;
  /**
   * Revokes every proxy held. This is session teardown, not per-render cleanup —
   * releasing after each render is what made a single render break even.
   */
  release: () => void;
}

interface Prepared {
  source: MediaReference;
  panel: Day1Panel;
  url: string;
}

/**
 * A slot holds the newest proxy for one panel in one ratio, tagged with the crop
 * it was built for. Bounding it per slot rather than per crop is what stops a
 * multi-ratio batch from evicting the proxy it is about to need again, while a
 * framing edit still frees the proxy it just invalidated.
 */
interface Slot {
  key: string;
  prepared: Prepared;
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
  // Both keyed by panel and ratio: at most two panels times three ratios, so the
  // store is bounded at six proxies and one note per panel per ratio, however
  // many locale jobs a batch runs.
  const slots = new Map<string, Slot>();
  const notes = new Map<string, string>();

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

    const slot = `${key}:${ratio}`;

    if (!source?.width || !source.height) {
      notes.set(slot, `${key}: skipped, source dimensions unknown`);
      return null;
    }

    const url = resolveUrl(source);

    if (!url) {
      notes.set(slot, `${key}: skipped, source not resolved in this session`);
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

      notes.set(
        slot,
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
    const held = slots.get(slot);
    const crop = `${plan.crop.width}x${plan.crop.height} at ${plan.crop.left},${plan.crop.top}`;

    if (held?.key === cacheKey) {
      notes.set(slot, `${key}: reused ${crop}`);

      return held.prepared;
    }

    // Whatever is held was built for a framing, trim or source that no longer
    // applies, so it can never be reused. Freeing it before the transcode keeps
    // the slot's memory flat instead of doubling it mid-build.
    if (held) {
      slots.delete(slot);
      releaseUrl(held.prepared.url);
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
      notes.set(
        slot,
        `${key}: failed, ${String((result.error.cause as Error)?.message ?? result.error.code)}`,
      );

      return null;
    }

    notes.set(
      slot,
      `${key}: ${crop} (-${Math.round(plan.savings * 100)}% pixels)` +
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

    slots.set(slot, {key: cacheKey, prepared});

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

    notes: () => [...notes.values()],

    clearNotes: () => notes.clear(),

    release: () => {
      for (const held of slots.values()) {
        releaseUrl(held.prepared.url);
      }

      slots.clear();
    },
  };
};
