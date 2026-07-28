// Serves the production build under a repository-style subpath so the GitHub
// Pages layout can be verified before anything is deployed.
// Design Ref: §8.4 scenario 9 — "Load from repository subpath and refresh".
import {createReadStream, existsSync, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {extname, join, normalize, resolve} from 'node:path';

const PORT = Number(process.env.PORT ?? 4190);
const BASE_PATH = process.env.BASE_PATH ?? '/mkt_Videodesigner';
const DIST = resolve(import.meta.dirname, '../dist');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
};

if (!existsSync(DIST)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`);

  if (!url.pathname.startsWith(BASE_PATH)) {
    response.writeHead(404).end('outside base path');
    return;
  }

  const relative = url.pathname.slice(BASE_PATH.length) || '/';
  const target = join(DIST, normalize(relative === '/' ? 'index.html' : relative));

  // GitHub Pages serves the SPA entry for unknown paths under the base.
  const filePath =
    existsSync(target) && statSync(target).isFile()
      ? target
      : join(DIST, 'index.html');

  response.writeHead(200, {
    'content-type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
    // Remotion's browser renderer needs a cross-origin isolated context for
    // SharedArrayBuffer, which GitHub Pages cannot set. Mirror Pages exactly by
    // NOT sending COOP/COEP here, so the check stays honest.
    'cache-control': 'no-store',
  });
  createReadStream(filePath).pipe(response);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serving dist at http://127.0.0.1:${PORT}${BASE_PATH}/`);
});
