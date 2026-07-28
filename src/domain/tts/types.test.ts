import {describe, expect, it} from 'vitest';

import {ttsCacheKey, type TtsRequest} from './types';

const request: TtsRequest = {
  locale: 'ko',
  text: '지금 다운로드',
  voiceId: 'default',
  speed: 1,
};

describe('ttsCacheKey', () => {
  it('is stable for the same request and revision', () => {
    expect(ttsCacheKey(request, 'supertonic-beta', 'r1')).toBe(
      ttsCacheKey({...request}, 'supertonic-beta', 'r1'),
    );
  });

  it('ignores surrounding whitespace in the text', () => {
    expect(ttsCacheKey({...request, text: '  지금 다운로드 '}, 'p', 'r1')).toBe(
      ttsCacheKey(request, 'p', 'r1'),
    );
  });

  it('separates every dimension of the request', () => {
    const baseline = ttsCacheKey(request, 'p', 'r1');

    expect(ttsCacheKey({...request, locale: 'en'}, 'p', 'r1')).not.toBe(baseline);
    expect(ttsCacheKey({...request, text: '다른 문구'}, 'p', 'r1')).not.toBe(
      baseline,
    );
    expect(ttsCacheKey({...request, voiceId: 'other'}, 'p', 'r1')).not.toBe(
      baseline,
    );
    expect(ttsCacheKey({...request, speed: 1.5}, 'p', 'r1')).not.toBe(baseline);
    expect(ttsCacheKey(request, 'other-provider', 'r1')).not.toBe(baseline);
    expect(ttsCacheKey(request, 'p', 'r2')).not.toBe(baseline);
  });
});
