// Remotion writes its verbose logs through console.debug (remotion:866), which
// Chrome hides behind the Verbose level in the console filter. Asking a user to
// find that checkbox, reproduce the failure, and hand-copy the tail of a few
// hundred lines is the kind of errand that loses the evidence.
//
// So in debug mode the app keeps the lines itself, in order, and hands them over
// as one blob of text.
import {renderLogLevel} from './logLevel';

/** Enough to cover a stalled render's tail without holding a session's worth. */
const CAPACITY = 2000;

type Method = 'debug' | 'log' | 'info' | 'warn' | 'error';
const METHODS: Method[] = ['debug', 'log', 'info', 'warn', 'error'];

const lines: string[] = [];
let installed = false;

const render = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Error) {
    return value.stack ?? `${value.name}: ${value.message}`;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

export const recordLine = (method: Method, args: unknown[]): void => {
  if (lines.length >= CAPACITY) {
    lines.shift();
  }
  lines.push(`${method} ${args.map(render).join(' ')}`);
};

export const capturedLines = (): readonly string[] => lines;

/**
 * The whole log as one clipboard-sized string, with the environment on top —
 * without the browser and the codec list, a stalled-decode report cannot be
 * matched against the machine it came from.
 */
export const capturedReport = (header: Record<string, unknown>): string =>
  [
    ...Object.entries(header).map(([key, value]) => `# ${key}: ${render(value)}`),
    `# lines: ${lines.length}${lines.length >= CAPACITY ? ` (oldest dropped, cap ${CAPACITY})` : ''}`,
    '',
    ...lines,
  ].join('\n');

/**
 * Wraps the console rather than replacing it, so everything still reaches
 * DevTools exactly as before. Only ?debug installs it, and only once.
 */
export const installDebugLogCapture = (
  target: Console = console,
  enabled = renderLogLevel() === 'verbose',
): void => {
  if (!enabled || installed) {
    return;
  }
  installed = true;

  for (const method of METHODS) {
    const original = target[method].bind(target);

    target[method] = (...args: unknown[]) => {
      recordLine(method, args);
      original(...args);
    };
  }
};
