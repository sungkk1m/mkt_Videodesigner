// Design Ref: §4.1 VideoRenderer — Remotion Web Renderer implementation. The
// editor never imports Remotion directly, so this file is the only place a
// renderer swap has to touch.
import type {VideoRenderer} from '../../domain/ports';
import {probeRenderCapabilities} from './capabilities';
import {runEditorRender} from './renderEditor';

export const browserVideoRenderer: VideoRenderer = {
  probe: async () => {
    const summary = await probeRenderCapabilities();

    return {
      ready: summary.ready,
      blockers: summary.blockers,
      warnings: summary.warnings,
      preferredOutputTarget: summary.preferredOutputTarget,
    };
  },
  render: ({snapshot, config, signal, onProgress}) =>
    runEditorRender({snapshot, config, signal, onProgress}),
};
