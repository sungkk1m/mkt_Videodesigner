// The M0 measurement is only valid if the spike's copied `Panel` renders the
// same DOM as the real one in SplitFrame.tsx. Comments and the `export` keyword
// are allowed to differ; nothing else is.
import {readFile} from 'node:fs/promises';

const slice = (source, startMarker) => {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`marker not found: ${startMarker}`);
  // A top-level `const X = (...) => {...};` ends at the first "\n};" that sits
  // in column zero. Brace counting is wrong here: the parameter destructuring
  // opens and closes a brace before the body is ever reached.
  const candidates = ["\n};", "\n);"]
    .map((t) => source.indexOf(t, start))
    .filter((i) => i >= 0);
  if (candidates.length === 0) throw new Error(`no top-level terminator after ${startMarker}`);
  return source.slice(start, Math.min(...candidates) + 3);
};

const normalize = (code) =>
  code
    // JSX comments first: a plain block-comment strip would eat the inner
    // /* */ and leave the braces behind as `{}`.
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\bexport\s+const\b/g, 'const')
    .replace(/\s+/g, ' ')
    .trim();

const real = await readFile('src/compositions/day1/SplitFrame.tsx', 'utf8');
const spike = await readFile('artifacts/m0/quadFrame.spike.tsx', 'utf8');

const pairs = [
  ['PanelLabel', 'const PanelLabel = (', 'const PanelLabel = ('],
  ['Panel', 'const Panel = ({\n  labelStyle', 'export const Panel = ({\n  labelStyle'],
];

let ok = true;
for (const [name, realMarker, spikeMarker] of pairs) {
  const a = normalize(slice(real, realMarker));
  const b = normalize(slice(spike, spikeMarker));
  const same = a === b;
  ok = ok && same;
  console.log(`${same ? 'IDENTICAL' : 'DIFFERENT'}  ${name}  (real ${a.length} chars, spike ${b.length} chars)`);
  if (!same) {
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if (a[i] !== b[i]) {
        console.log(`  first divergence at ${i}:`);
        console.log(`  real : ...${a.slice(Math.max(0, i - 60), i + 60)}`);
        console.log(`  spike: ...${b.slice(Math.max(0, i - 60), i + 60)}`);
        break;
      }
    }
  }
}
// Constants the copy also depends on.
for (const constant of ['BACKDROP_BLUR_RATIO = 0.05', 'BACKDROP_OVERSCAN = 1.2']) {
  const inBoth = real.includes(constant) && spike.includes(constant);
  ok = ok && inBoth;
  console.log(`${inBoth ? 'IDENTICAL' : 'DIFFERENT'}  ${constant}`);
}
process.exit(ok ? 0 : 1);
