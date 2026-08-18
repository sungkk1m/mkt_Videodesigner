// Day1 render speed — swaps each panel's source for one cropped down to what the
// panel actually shows, for the duration of a render job.
//
// This is the "render-time preparation" half of the plan: the project itself is
// never touched, so nothing here can reach persistence, relink, or the framing
// controls. A proxy is derived data, keyed by the crop it was built for, and it
// dies with the queue run that built it.
import {planPanelProxy} from '../../domain/day1/sourceProxy';
import {splitLayout} from '../../domain/day1/layout';
import {activeTransform, day1Of, type Day1PanelKey} from '../../domain/editor/project';
import type {
  AspectRatio,
  Day1Panel,
  EditorProject,
  MediaReference,
} from '../../domain/editor/types';
import type {SourceProxyBuilder} from '../../domain/ports';
import {msToFrames} from '../../domain/timeline/timeline';

type ResolveUrl = (reference: MediaReference | null | undefined) => string | null;

export interface PreparedRender {
  /** The project to build the render snapshot from. */
  project: EditorProject;
  /** Resolver that knows the proxy URLs as well as the session's own. */
  resolveUrl: ResolveUrl;
}

export interface PanelProxies {
  prepare: (
    project: EditorProject,
    ratio: AspectRatio,
    signal: AbortSignal,
  ) => Promise<PreparedRender>;
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

  const preparePanel = async (
    project: EditorProject,
    ratio: AspectRatio,
    key: Day1PanelKey,
    signal: AbortSignal,
  ): Promise<Prepared | null> => {
    const settings = day1Of(project);
    const panel = settings?.[key];
    const source = panel?.source;

    if (!settings || !panel || !source?.width || !source.height) {
      return null;
    }

    const url = resolveUrl(source);

    if (!url) {
      return null;
    }

    const layout = splitLayout(ratio, settings.split.lineWidthPx);
    const plan = planPanelProxy(
      key === 'panelA' ? layout.a : layout.b,
      {width: source.width, height: source.height},
      activeTransform(panel, ratio),
    );

    if (!plan) {
      return null;
    }

    // Frame-aligned to the render's own fps so the proxy starts on the frame the
    // render would have asked for, not on whichever sample sits nearest the
    // millisecond.
    const {fps} = project.render;
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
    // original source and let the job run at the original speed.
    if (!result.ok) {
      return null;
    }

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
    prepare: async (project, ratio, signal) => {
      const settings = day1Of(project);

      if (!settings) {
        return {project, resolveUrl};
      }

      const panels = await Promise.all(
        PANEL_KEYS.map((key) => preparePanel(project, ratio, key, signal)),
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

    release: () => {
      for (const prepared of built.values()) {
        releaseUrl(prepared.url);
      }

      built.clear();
    },
  };
};
