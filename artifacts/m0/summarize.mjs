// Reads artifacts/m0/results.json and prints the gate tables.
//
// IMPORTANT: the web-renderer's four timing buckets do NOT sum to the render's
// wall clock here — coverage ranges from 27% to 76% depending on the variant, so
// the buckets cannot be used to attribute cost. `totalMs` (wall clock around
// renderMediaOnWeb) is the only figure compared below. Bucket coverage is
// printed so that unreliability stays visible rather than being assumed away.
import {readFile} from 'node:fs/promises';

const rows = JSON.parse(await readFile('artifacts/m0/results.json', 'utf8'));
const groups = new Map();
for (const r of rows) {
  if (r.error) { console.log(`ERROR ${r.variant}-${r.fit} run ${r.run}: ${r.error}`); continue; }
  const key = `${r.variant}-${r.fit}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const bucketSum = (r) =>
  r.waitForReadyMs + r.createFrameMs + r.addSampleMs + r.audioMixingMs;

const stat = (name) => {
  const g = groups.get(name);
  if (!g) return null;
  return {
    name,
    runs: g.length,
    frames: g[0].frames,
    total: median(g.map((r) => r.totalMs)),
    spread: Math.max(...g.map((r) => r.totalMs)) - Math.min(...g.map((r) => r.totalMs)),
    decode: median(g.map((r) => r.waitForReadyMs)),
    composite: median(g.map((r) => r.createFrameMs)),
    encode: median(g.map((r) => r.addSampleMs)),
    coverage: median(g.map((r) => (100 * bucketSum(r)) / r.totalMs)),
  };
};

const ORDER = [
  'day1-cover', 'quad-cover',
  'day1-contain', 'quad-contain',
  'day1-baked-contain', 'quad-baked-contain',
];
const stats = ORDER.map(stat).filter(Boolean);
const f = (n) => Math.round(n).toLocaleString();

console.log('\n### 측정치 (450프레임 · 1080x1920 · 30fps · vp9/webm · run 중앙값)\n');
console.log('| 구성 | runs | total | run 간 편차 | ms/프레임 | 버킷 커버리지 | decode | composite | encode |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const s of stats) {
  console.log(
    `| ${s.name} | ${s.runs} | **${f(s.total)}ms** | ${f(s.spread)}ms | ${(s.total / s.frames).toFixed(1)}ms | ${s.coverage.toFixed(0)}% | ${f(s.decode)}ms | ${f(s.composite)}ms | ${f(s.encode)}ms |`,
  );
}

console.log('\n### 비율 (total 기준)\n');
console.log('| 비교 | 배수 | 판정 |');
console.log('|---|---:|---|');
const PAIRS = [
  ['day1-cover', 'quad-cover', '패널 개수 2→4 (cover)', 1.5],
  ['day1-contain', 'quad-contain', '패널 개수 2→4 (contain)', 1.5],
  ['day1-cover', 'day1-contain', 'day1: cover → contain', null],
  ['quad-cover', 'quad-contain', 'quad: cover → contain', null],
  ['day1-contain', 'day1-baked-contain', 'day1: contain → 배경 굽기', null],
  ['quad-contain', 'quad-baked-contain', 'quad: contain → 배경 굽기', null],
  ['day1-contain', 'quad-baked-contain', 'day1 현재 → quad 배경 굽기', 1.5],
];
for (const [a, b, label, gate] of PAIRS) {
  const A = stat(a), B = stat(b);
  if (!A || !B) continue;
  const ratio = B.total / A.total;
  const verdict = gate === null
    ? ''
    : ratio <= gate ? `게이트 ${gate}배 이내 통과` : `게이트 ${gate}배 초과`;
  console.log(`| ${label} | **${ratio.toFixed(2)}x** | ${verdict} |`);
}
console.log('');
