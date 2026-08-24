// day1-quad Design §6.2 / Do checklist — the Panel extraction must be a PURE
// MOVE. Compares the block now in Panel.tsx against the same block in the
// pre-extraction SplitFrame.tsx (read from git), ignoring only the `export`
// keyword that the move necessarily adds.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const BEFORE_REF = process.env.BEFORE_REF ?? '96c314d';
const before = execFileSync(
  'git',
  ['show', `${BEFORE_REF}:src/compositions/day1/SplitFrame.tsx`],
  {encoding: 'utf8'},
);
const after = readFileSync('src/compositions/day1/Panel.tsx', 'utf8');

const slice = (text, from, to) => {
  const start = text.indexOf(from);
  const end = to ? text.indexOf(to) : text.length;
  if (start < 0 || end < 0) throw new Error(`marker not found: ${from} / ${to}`);
  return text.slice(start, end).trim();
};

const fails = [];
const compare = (name, a, b) => {
  const ok = a === b;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${a.length} chars)`);
  if (!ok) {
    fails.push(name);
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if (a[i] !== b[i]) {
        console.log(`      first difference at ${i}:`);
        console.log(`      before: ${JSON.stringify(a.slice(i - 40, i + 40))}`);
        console.log(`      after:  ${JSON.stringify(b.slice(i - 40, i + 40))}`);
        break;
      }
    }
  }
};

compare(
  'JUSTIFY + PanelLabel + backdrop constants',
  slice(before, 'const JUSTIFY = {', 'const Panel = ({'),
  slice(after, 'const JUSTIFY = {', 'export const Panel = ({'),
);
compare(
  'Panel component body',
  slice(before, 'const Panel = ({', 'export interface SplitFrameProps {'),
  slice(after, 'export const Panel = ({').replace('export const Panel', 'const Panel'),
);

// SplitFrame must still draw two panels and keep the testid the E2E asserts.
const split = readFileSync('src/compositions/day1/SplitFrame.tsx', 'utf8');
const keeps = (name, needle) => {
  const ok = split.includes(needle);
  console.log(`${ok ? 'PASS' : 'FAIL'}  SplitFrame keeps ${name}`);
  if (!ok) fails.push(name);
};
keeps('data-testid="day1-split-line"', 'data-testid="day1-split-line"');
keeps('both panels', 'panel={panelA}');
keeps('the ducking curve', 'duckedVolumeAt');

console.log(fails.length ? `\n${fails.length} FAILED` : '\nextraction is a pure move');
process.exit(fails.length ? 1 : 0);
