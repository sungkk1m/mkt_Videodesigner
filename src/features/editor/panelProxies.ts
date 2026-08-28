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
import {quadLayout, splitLayout} from '../../domain/day1/layout';
import {
  activeTransform,
  day1PanelAt,
  day1PanelsOf,
  failureOf,
  panelKeysOf,
} from '../../domain/editor/project';
import {failureLayout} from '../../domain/failure/layout';
import {failureOrientationFor} from '../../domain/failure/orientation';
import {
  FAILURE_PANEL_KEYS,
  type AspectRatio,
  type Day1Panel,
  type EditorProject,
  type MediaReference,
  type PanelRect,
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

/**
 * failure-video Design §7.4 — the template's slots for one render, as
 * `(payload key, box, panel)` triples. One shape for both worlds, so the
 * transcode below never learns what a template is.
 *
 * The failure arm is safe against the runtime effects for a measured reason
 * (D-10, and the unit tests assert it): the FAIL punch zoom and the transition
 * punch are both scale >= 1, so every frame shows a subset of what the proxy
 * kept. The shake is applied at the section-wrapper level, not inside the panel,
 * so what appears at the frame's edge during it is the canvas colour, not the
 * proxy's boundary — the reference shows edge gaps during its own shake too.
 */
interface ProxySlot {
  /** Where the prepared panel is written back into the payload. */
  path: readonly string[];
  box: PanelRect;
  panel: Day1Panel;
}

const proxySlotsOf = (
  project: EditorProject,
  ratio: AspectRatio,
): readonly ProxySlot[] => {
  const failure = failureOf(project);

  if (failure) {
    const orientation = failureOrientationFor(ratio);
    const box = failureLayout(ratio).video;

    return FAILURE_PANEL_KEYS.map((key) => ({
      path: [orientation, key],
      box,
      panel: failure[orientation][key],
    }));
  }

  const settings = day1PanelsOf(project);

  if (!settings) {
    return [];
  }

  const keys = panelKeysOf(settings);

  return keys.flatMap((key) => {
    const panel = day1PanelAt(project, key);

    if (!panel) {
      return [];
    }

    const index = keys.indexOf(key);
    // day1-quad Design §7.4 — the panel's own box. `planPanelProxy` takes only
    // a box and a transform, so it needs no change for four cells.
    const box =
      keys.length > 2
        ? (quadLayout(ratio, settings.split.lineWidthPx).cells[
            index
          ] as PanelRect)
        : splitLayout(ratio, settings.split.lineWidthPx)[
            index === 0 ? 'a' : 'b'
          ];

    return [{path: [key], box, panel}];
  });
};


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
    {ratio, fps, signal}: PrepareRequest,
    {path, box, panel}: ProxySlot,
  ): Promise<Prepared | null> => {
    const source = panel.source;
    const key = path.join('.');
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

    const plan = planPanelProxy(
      box,
      {width: source.width, height: source.height},
      activeTransform(panel, ratio),
    );

    if (!plan) {
      const size = {width: source.width, height: source.height};

      // day1-video — `panelVisibleRect` below is cover geometry, so under
      // `contain` it would describe a rectangle nobody asked for. Say the real
      // reason instead: the whole source is on screen, so no crop exists.
      if (activeTransform(panel, ratio).fit !== 'cover') {
        notes.set(slot, `${key}: skipped, contain shows the whole source`);

        return null;
      }

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
      const {project, ratio} = request;
      // day1-quad Design §7.4 — the template's own slot list, so the quad's
      // panels C and D get proxies too. This was a two-element constant, which
      // silently left half a quad render on its original sources.
      const slots = proxySlotsOf(project, ratio);

      if (slots.length === 0) {
        return {project, resolveUrl};
      }

      const panels = await Promise.all(
        slots.map((slot) => preparePanel(request, slot)),
      );

      if (panels.every((panel) => panel === null)) {
        return {project, resolveUrl};
      }

      const urls = new Map(
        panels
          .filter((panel): panel is Prepared => panel !== null)
          .map((panel) => [panel.source.id, panel.url]),
      );
      // Written back along each slot's own path, so the failure payload's
      // `{orientation}.{key}` nesting needs no special case here.
      const patched = {...project.templateSettings};

      slots.forEach((slot, index) => {
        const prepared = panels[index];

        if (!prepared) {
          return;
        }

        const [head, ...rest] = slot.path;
        const replacement = {...prepared.panel, source: prepared.source};
        const target = patched as Record<string, unknown>;

        if (rest.length === 0) {
          target[head as string] = replacement;
        } else {
          target[head as string] = {
            ...(target[head as string] as Record<string, unknown>),
            [rest[0] as string]: replacement,
          };
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
