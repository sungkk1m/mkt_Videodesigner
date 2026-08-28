// steam-review Design Ref: §12.1 — source resolution (Plan Q4: the shared
// source is the fallback, unlike kv-loop's `en` set) and the restore contract.
import {describe, expect, it} from 'vitest';

import {testMediaReference} from '../../test/fixtures/media';
import {steamReviewProjectFixture, steamReviewSettingsOf} from '../../test/fixtures/project';
import {resolveSteamReviewSource, steamReviewRestoreTargets} from './assets';

const common = testMediaReference({id: 'media_common', durationMs: 25_000});
const krCut = testMediaReference({id: 'media_kr', durationMs: 25_000});

const settingsWith = (
  overrides: Parameters<typeof steamReviewProjectFixture>[0],
) => steamReviewSettingsOf(steamReviewProjectFixture(overrides));

describe('resolveSteamReviewSource', () => {
  it('prefers the locale replacement when one exists', () => {
    const settings = settingsWith({
      source: common,
      localeSources: {ko: krCut},
    });

    expect(resolveSteamReviewSource(settings, 'ko')).toBe(krCut);
  });

  it('falls back to the shared source, not another locale', () => {
    const settings = settingsWith({
      source: common,
      localeSources: {ko: krCut},
    });

    expect(resolveSteamReviewSource(settings, 'en')).toBe(common);
    expect(resolveSteamReviewSource(settings, 'ja')).toBe(common);
  });

  it('answers null when nothing covers the locale', () => {
    const settings = settingsWith({localeSources: {ko: krCut}});

    expect(resolveSteamReviewSource(settings, 'en')).toBeNull();
  });
});

describe('steamReviewRestoreTargets', () => {
  it('lists every unresolved reference with its slot', () => {
    const keyArt = testMediaReference({
      id: 'media_keyart',
      kind: 'image',
      durationMs: undefined,
    });
    const thumb = testMediaReference({
      id: 'media_thumb2',
      kind: 'image',
      durationMs: undefined,
    });
    const settings = settingsWith({
      source: common,
      localeSources: {ko: krCut},
      keyArt: {image: keyArt, transforms: {base: {fit: 'cover', scale: 1, x: 0, y: 0}, overrides: {}}},
      thumbnails: [null, null, thumb, null],
    });

    expect(steamReviewRestoreTargets(settings, () => false)).toEqual([
      {slot: 'source', reference: common},
      {slot: 'locale-source', locale: 'ko', reference: krCut},
      {slot: 'key-art', reference: keyArt},
      {slot: 'thumbnail', index: 2, reference: thumb},
    ]);
  });

  it('skips references the session already resolved', () => {
    const settings = settingsWith({
      source: common,
      localeSources: {ko: krCut},
    });

    expect(
      steamReviewRestoreTargets(settings, (id) => id === 'media_common'),
    ).toEqual([{slot: 'locale-source', locale: 'ko', reference: krCut}]);
  });

  it('answers empty for a fresh project', () => {
    expect(steamReviewRestoreTargets(settingsWith({}), () => false)).toEqual(
      [],
    );
  });
});
