import {describe, expect, it} from 'vitest';

import {renderLogLevelFor} from './logLevel';

describe('renderLogLevelFor', () => {
  it('stays quiet for a normal visit', () => {
    expect(renderLogLevelFor('')).toBe('info');
    expect(renderLogLevelFor('?locale=ko')).toBe('info');
  });

  it('turns on verbose decoding logs for ?debug', () => {
    expect(renderLogLevelFor('?debug=1')).toBe('verbose');
    // Bare `?debug` counts too — nobody types the =1 from memory.
    expect(renderLogLevelFor('?debug')).toBe('verbose');
    expect(renderLogLevelFor('?locale=ko&debug=1')).toBe('verbose');
  });
});
