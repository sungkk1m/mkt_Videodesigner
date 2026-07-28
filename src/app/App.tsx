// The editor is the product surface. The module-2 render PoC stays reachable at
// `#render-poc` so its benchmark runner and E2E keep working.
import {useEffect, useState} from 'react';

import {EditorWorkspace} from '../features/editor/EditorWorkspace';
import {createHeuristicHookAnalyzer} from '../infrastructure/hook-analysis/heuristicHookAnalyzer';
import {browserMediaResolver} from '../infrastructure/media/browserMediaResolver';
import {
  createMediaHandleStore,
  supportsFileHandles,
} from '../infrastructure/persistence/mediaHandleStore';
import {
  createProjectRepository,
  loadLatestProject,
} from '../infrastructure/persistence/projectRepository';
import {
  createBrowserOutputWriter,
  supportsDirectoryPicker,
} from '../infrastructure/output/browserOutputWriter';
import {browserVideoRenderer} from '../infrastructure/render/browserVideoRenderer';
import {createSupertonicProvider} from '../infrastructure/tts/supertonicProvider';
import {createTtsCache} from '../infrastructure/tts/ttsCache';
import {RenderPocWorkspace} from './RenderPocWorkspace';

const RENDER_POC_HASH = '#render-poc';

// Design Ref: §9.2 — adapters are constructed once, here, and injected.
const projectRepository = createProjectRepository();
const mediaHandleStore = supportsFileHandles() ? createMediaHandleStore() : null;
const hookAnalyzer = createHeuristicHookAnalyzer();
const ttsProvider = createSupertonicProvider();
const ttsCache = createTtsCache();
const outputWriter = createBrowserOutputWriter();

const loadInitialProject = async () => {
  const result = await loadLatestProject(projectRepository);

  return result.ok ? result.value : null;
};

export const App = () => {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);

    window.addEventListener('hashchange', onHashChange);

    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (hash === RENDER_POC_HASH) {
    return <RenderPocWorkspace />;
  }

  return (
    <EditorWorkspace
      hookAnalyzer={hookAnalyzer}
      loadInitialProject={loadInitialProject}
      mediaHandleStore={mediaHandleStore}
      mediaResolver={browserMediaResolver}
      outputWriter={outputWriter}
      projectRepository={projectRepository}
      supportsOutputDirectory={supportsDirectoryPicker()}
      ttsCache={ttsCache}
      ttsProvider={ttsProvider}
      videoRenderer={browserVideoRenderer}
    />
  );
};
