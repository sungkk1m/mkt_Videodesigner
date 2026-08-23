// key-visual-looping Design Ref: §8.1 — the locale fallback matrix (D-05) and
// the two absence questions the render path asks (FR-L13 / SC5 / SC6).
import {describe, expect, it} from 'vitest';

import {testMediaReference} from '../../test/fixtures/media';
import {kvLoopProjectFixture} from '../../test/fixtures/project';
import {createProject} from '../editor/project';
import type {KvLoopSettings, MediaReference} from '../editor/types';
import {
  KV_FALLBACK_LOCALE,
  kvLoopMissingImages,
  kvLoopRestoreTargets,
  resolveKvSet,
  resolveKvTitle,
} from './assets';

const image = (name: string): MediaReference =>
  testMediaReference({
    id: `media_${name}`,
    kind: 'image',
    name: `${name}.png`,
    mimeType: 'image/png',
    durationMs: undefined,
    width: 1080,
    height: 1920,
  });

const set = (...names: (string | null)[]) =>
  names.map((name) => (name ? image(name) : null));

describe('resolveKvSet', () => {
  it('uses a locale its own set', () => {
    const images: KvLoopSettings['images'] = {
      ko: set('ko-1', 'ko-2'),
      en: set('en-1', 'en-2'),
    };

    expect(resolveKvSet(images, 'ko', 2)).toEqual({
      references: set('ko-1', 'ko-2'),
      inheritedFrom: null,
    });
  });

  it('inherits the whole English set when a locale has none — SC6', () => {
    const images: KvLoopSettings['images'] = {en: set('en-1', 'en-2')};

    expect(resolveKvSet(images, 'ja', 2)).toEqual({
      references: set('en-1', 'en-2'),
      inheritedFrom: KV_FALLBACK_LOCALE,
    });
  });

  it('never mixes a half-filled set with the English one — D-05', () => {
    const images: KvLoopSettings['images'] = {
      ko: set('ko-1', null, null, null),
      en: set('en-1', 'en-2', 'en-3', 'en-4'),
    };

    // Two of four filled would be unpredictable to the user, so ko keeps its own
    // one image and three empty sections.
    expect(resolveKvSet(images, 'ko', 4)).toEqual({
      references: set('ko-1', null, null, null),
      inheritedFrom: null,
    });
  });

  it('answers with empty slots when nothing is uploaded anywhere', () => {
    expect(resolveKvSet({}, 'ko', 3)).toEqual({
      references: [null, null, null],
      inheritedFrom: null,
    });
  });

  it('does not report English as inheriting from itself', () => {
    expect(resolveKvSet({}, 'en', 2)).toEqual({
      references: [null, null],
      inheritedFrom: null,
    });
  });

  it('sizes the answer to the requested count, either way', () => {
    const images: KvLoopSettings['images'] = {en: set('en-1', 'en-2', 'en-3')};

    expect(resolveKvSet(images, 'en', 2).references).toEqual(
      set('en-1', 'en-2'),
    );
    expect(resolveKvSet(images, 'en', 4).references).toEqual(
      set('en-1', 'en-2', 'en-3', null),
    );
  });
});

describe('resolveKvTitle', () => {
  it('follows the same set-level fallback', () => {
    const images = {en: image('title-en'), ko: image('title-ko')};

    expect(resolveKvTitle(images, 'ko')).toEqual({
      reference: image('title-ko'),
      inheritedFrom: null,
    });
    expect(resolveKvTitle(images, 'ja')).toEqual({
      reference: image('title-en'),
      inheritedFrom: KV_FALLBACK_LOCALE,
    });
  });

  it('treats no title at all as a normal answer — Plan L5', () => {
    expect(resolveKvTitle({}, 'ko')).toEqual({
      reference: null,
      inheritedFrom: null,
    });
  });
});

describe('kvLoopRestoreTargets', () => {
  const settingsOf = (patch: Partial<KvLoopSettings>): KvLoopSettings =>
    kvLoopProjectFixture(patch).templateSettings as KvLoopSettings;
  const nothingResolved = () => false;

  it('asks for every locale, so switching the tab after a reload needs nothing', () => {
    const settings = settingsOf({
      images: {ko: set('ko-1', 'ko-2'), en: set('en-1')},
    });

    expect(
      kvLoopRestoreTargets(settings, nothingResolved).map(
        ({locale, slot, reference}) => [locale, slot, reference.id],
      ),
    ).toEqual([
      ['ko', 0, 'media_ko-1'],
      ['ko', 1, 'media_ko-2'],
      ['en', 0, 'media_en-1'],
    ]);
  });

  it('carries the owning locale, never the selected one — D-05', () => {
    // `ja` shows this set through inheritance. A status written against `ja`
    // would give it a set of its own and end the inheritance silently, so the
    // target has to name `en`.
    const settings = settingsOf({images: {en: set('en-1', 'en-2')}});

    expect(
      kvLoopRestoreTargets(settings, nothingResolved).map(
        ({locale}) => locale,
      ),
    ).toEqual(['en', 'en']);
  });

  it('skips what the session can already play', () => {
    const settings = settingsOf({images: {ko: set('ko-1', 'ko-2')}});

    expect(
      kvLoopRestoreTargets(
        settings,
        (mediaId) => mediaId === 'media_ko-1',
      ).map(({reference}) => reference.id),
    ).toEqual(['media_ko-2']);
  });

  it('includes the title overlay, which is stored per locale too', () => {
    const settings = settingsOf({
      images: {ko: set('ko-1')},
      title: {
        images: {ko: image('title-ko'), en: image('title-en')},
        transform: {fit: 'contain', scale: 1, x: 0, y: 0},
      },
    });

    expect(
      kvLoopRestoreTargets(settings, nothingResolved).map(
        ({locale, slot}) => [locale, slot],
      ),
    ).toEqual([
      ['ko', 0],
      ['ko', 'title'],
      ['en', 'title'],
    ]);
  });

  it('ignores slots past the key visual count, which a write would truncate', () => {
    // The default fixture is four key visuals; a fifth entry is left over from a
    // higher count. `setKvImage` sizes the array back down to `slots.length`, so
    // a restore that touched slot 4 would drop it rather than recover it.
    const settings = settingsOf({
      images: {ko: set('ko-1', 'ko-2', 'ko-3', 'ko-4', 'ko-5')},
    });

    expect(
      kvLoopRestoreTargets(settings, nothingResolved).map(
        ({reference}) => reference.id,
      ),
    ).toEqual([
      'media_ko-1',
      'media_ko-2',
      'media_ko-3',
      'media_ko-4',
    ]);
  });

  it('has nothing to ask for when no locale holds an image', () => {
    expect(kvLoopRestoreTargets(settingsOf({}), nothingResolved)).toEqual([]);
  });
});

describe('kvLoopMissingImages', () => {
  it('does not count overlays, so a bare key visual set renders — SC5', () => {
    const project = kvLoopProjectFixture({
      images: {ko: set('ko-1', 'ko-2', 'ko-3', 'ko-4')},
    });

    expect(kvLoopMissingImages(project)).toBe(0);
  });

  it('blocks a loop that has fewer than two key visuals — FR-L13', () => {
    expect(
      kvLoopMissingImages(
        kvLoopProjectFixture({images: {ko: set('ko-1', null, null, null)}}),
      ),
    ).toBe(1);
    expect(kvLoopMissingImages(kvLoopProjectFixture())).toBe(2);
  });

  it('counts the inherited set, not just the locale-specific one', () => {
    const project = kvLoopProjectFixture({
      images: {en: set('en-1', 'en-2', 'en-3', 'en-4')},
    });

    expect(kvLoopMissingImages({...project, selectedLocale: 'ja'})).toBe(0);
  });

  it('says nothing about a project of another template', () => {
    expect(kvLoopMissingImages(createProject(15))).toBe(0);
  });
});
