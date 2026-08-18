import {describe, expect, it, vi} from 'vitest';

import {
  capturedLines,
  capturedReport,
  installDebugLogCapture,
  recordLine,
} from './debugLog';

describe('debug log capture', () => {
  it('leaves the console alone unless debug mode is on', () => {
    const debug = vi.fn();
    const fake = {debug, log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn()};

    installDebugLogCapture(fake as unknown as Console, false);

    expect(fake.debug).toBe(debug);
  });

  it('keeps the line and still forwards it to the console', () => {
    const before = capturedLines().length;

    recordLine('debug', ['[@remotion/media] Creating keyframe bank', 168.69]);

    expect(capturedLines()[before]).toBe(
      'debug [@remotion/media] Creating keyframe bank 168.69',
    );
  });

  it('puts the environment above the lines so a report identifies its machine', () => {
    const report = capturedReport({userAgent: 'Chrome/151', fps: 30});

    expect(report).toContain('# userAgent: Chrome/151');
    expect(report).toContain('# fps: 30');
    expect(report).toContain('# lines: ');
  });

  it('renders an Error as its stack rather than {}', () => {
    const before = capturedLines().length;

    recordLine('error', [new Error('decode stalled')]);

    expect(capturedLines()[before]).toContain('decode stalled');
  });
});
