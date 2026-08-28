import {describe, expect, it} from 'vitest';

import {TEMPLATE_FILE_SEGMENT, buildOutputFileName} from './fileName';
import type {EditorRenderConfig} from './types';
import {TEMPLATE_KINDS} from '../editor/types';

const CONFIG: EditorRenderConfig = {
  durationPreset: 15,
  fps: 60,
  ratio: '9:16',
  locale: 'ko',
  template: 'three-scene',
  outputTarget: 'web-fs',
};

describe('buildOutputFileName', () => {
  it('follows the confirmed naming pattern', () => {
    expect(buildOutputFileName('ua-video', CONFIG)).toBe(
      'ua-video_3scene_ko_9x16_15s_60fps.mp4',
    );
  });

  it('sanitizes unsafe characters and collapses separators', () => {
    expect(buildOutputFileName('  여름 //이벤트  ', CONFIG)).toBe(
      '여름-이벤트_3scene_ko_9x16_15s_60fps.mp4',
    );
  });

  // day1-quad Design §4.2 — Day1 and Day1-quad share resolutions and locales, so
  // the template segment is the only thing separating their outputs on disk.
  it('carries a distinct segment for every template', () => {
    const names = TEMPLATE_KINDS.map((template) =>
      buildOutputFileName('ua-video', {...CONFIG, template}),
    );

    expect(names).toEqual([
      'ua-video_3scene_ko_9x16_15s_60fps.mp4',
      'ua-video_day1_ko_9x16_15s_60fps.mp4',
      'ua-video_day1x4_ko_9x16_15s_60fps.mp4',
      'ua-video_kvloop_ko_9x16_15s_60fps.mp4',
      // steam-review Plan Q12 — segment `steamreview`.
      'ua-video_steamreview_ko_9x16_15s_60fps.mp4',
    ]);
    // No two templates may collapse onto the same filename.
    expect(new Set(Object.values(TEMPLATE_FILE_SEGMENT)).size).toBe(
      TEMPLATE_KINDS.length,
    );
  });

  it('falls back to a default name when the project name is empty', () => {
    expect(buildOutputFileName('   ', {...CONFIG, durationPreset: 60})).toBe(
      'ua-video_3scene_ko_9x16_60s_60fps.mp4',
    );
  });
});
