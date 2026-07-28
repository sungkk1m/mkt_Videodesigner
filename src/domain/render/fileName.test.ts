import {describe, expect, it} from 'vitest';

import {buildOutputFileName} from './fileName';
import type {EditorRenderConfig} from './types';

const CONFIG: EditorRenderConfig = {
  durationPreset: 15,
  fps: 60,
  ratio: '9:16',
  locale: 'ko',
  outputTarget: 'web-fs',
};

describe('buildOutputFileName', () => {
  it('follows the confirmed naming pattern', () => {
    expect(buildOutputFileName('ua-video', CONFIG)).toBe(
      'ua-video_ko_9x16_15s_60fps.mp4',
    );
  });

  it('sanitizes unsafe characters and collapses separators', () => {
    expect(buildOutputFileName('  여름 //이벤트  ', CONFIG)).toBe(
      '여름-이벤트_ko_9x16_15s_60fps.mp4',
    );
  });

  it('falls back to a default name when the project name is empty', () => {
    expect(buildOutputFileName('   ', {...CONFIG, durationPreset: 60})).toBe(
      'ua-video_ko_9x16_60s_60fps.mp4',
    );
  });
});
