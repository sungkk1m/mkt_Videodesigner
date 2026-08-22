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
