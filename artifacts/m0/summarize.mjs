// Reads artifacts/m0/results.json and prints the gate table.
//
// The headline ratio deliberately EXCLUDES addSample: this container encodes VP9
// in software while the reference machine encodes H.264 in hardware, so that
// bucket is the one number that cannot travel. createFrame is codec-independent.
import {readFile} from 'node:fs/promises';

const rows = JSON.parse(await readFile('artifacts/m0/results.json', 'utf8'));
const key = (r) => `${r.variant}-${r.fit}`;
const groups = new Map();
for (const r of rows) {
  if (r.error) { console.log(`ERROR ${key(r)} run ${r.run}: ${r.error}`); continue; }
  if (!groups.has(key(r))) groups.set(key(r), []);
  groups.get(key(r)).push(r);
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const stat = (name) => {
  const g = groups.get(name);
  if (!g) return null;
  return {
    name,
    runs: g.length,
    frames: g[0].frames,
    waitForReady: median(g.map((r) => r.waitForReadyMs)),
    createFrame: median(g.map((r) => r.createFrameMs)),
    addSample: median(g.map((r) => r.addSampleMs)),
    total: median(g.map((r) => r.totalMs)),
    spread: Math.max(...g.map((r) => r.totalMs)) - Math.min(...g.map((r) => r.totalMs)),
  };
};

const names = ['day1-contain', 'quad-contain', 'day1-cover', 'quad-cover'];
const stats = names.map(stat).filter(Boolean);

const f = (n) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString());
console.log('\n| 구성 | runs | frames | waitForReady(decode) | createFrame(composite) | addSample(encode) | total | run 간 편차 |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|');
for (const s of stats) {
  console.log(`| ${s.name} | ${s.runs} | ${s.frames} | ${f(s.waitForReady)}ms | ${f(s.createFrame)}ms | ${f(s.addSample)}ms | ${f(s.total)}ms | ${f(s.spread)}ms |`);
}

const ratio = (a, b, field) => {
  const A = stat(a), B = stat(b);
  if (!A || !B) return null;
  return B[field] / A[field];
};

console.log('\n| 비교 | decode | composite | total | total − encode |');
console.log('|---|---:|---:|---:|---:|');
for (const [a, b, label] of [
  ['day1-contain', 'quad-contain', 'contain: 2패널 → 4패널'],
  ['day1-cover', 'quad-cover', 'cover: 2패널 → 4패널'],
  ['day1-cover', 'day1-contain', 'day1: cover → contain'],
  ['quad-cover', 'quad-contain', 'quad: cover → contain'],
]) {
  const A = stat(a), B = stat(b);
  if (!A || !B) continue;
  const netA = A.total - A.addSample;
  const netB = B.total - B.addSample;
  console.log(`| ${label} | ${ratio(a,b,'waitForReady').toFixed(2)}x | ${ratio(a,b,'createFrame').toFixed(2)}x | ${ratio(a,b,'total').toFixed(2)}x | **${(netB/netA).toFixed(2)}x** |`);
}
console.log('');
