import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

import {App} from './app/App';
import {installDebugLogCapture} from './infrastructure/render/debugLog';
import './app/styles.css';

// Before anything renders, so a stalled render's very first log line is kept.
installDebugLogCapture();

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
