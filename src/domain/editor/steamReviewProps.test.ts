// steam-review Design Ref: §8 — the render contract: everything the
// composition draws is resolved in `buildSteamReviewProps`, so these tests pin
// the resolution rules without rendering a frame (the day1Props precedent).
import {describe, expect, it} from 'vitest';

import {testMediaReference, testUrlResolver} from '../../test/fixtures/media';
import {steamReviewProjectFixture} from '../../test/fixtures/project';
import {
  buildEditorSnapshot,
  buildSteamReviewProps,
  createProject,
} from './project';
import {
  setSteamReviewLocaleSource,
  setSteamReviewSource,
} from './steamReviewCommands';
import type {EditorProject, MediaReference} from './types';

const video = (id: string, durationMs = 30_000): MediaReference =>
  testMediaReference({id: `media_${id}`, durationMs});

/** Resolves each reference to a URL derived from its id, so tests can tell sources apart. */
const idResolver = (reference: MediaReference | null | undefined) =>
  reference ? `blob:${reference.id}` : null;

const filled = (): EditorProject => {
  let project = setSteamReviewSource(
    steamReviewProjectFixture(),
    video('common', 32_000),
  );

  project = setSteamReviewLocaleSource(project, 'ko', video('kr', 25_000));

  return project;
};

describe('buildSteamReviewProps', () => {
  it('returns null for a foreign template', () => {
    expect(buildSteamReviewProps(createProject(15), testUrlResolver())).toBeNull();
  });

  it('is what buildEditorSnapshot tags a store-page project with', () => {
    const snapshot = buildEditorSnapshot(filled(), testUrlResolver());

    expect(snapshot.template).toBe('steam-review');
  });

  it('plays the locale replacement for its locale and the shared source elsewhere', () => {
    const project = filled();
    const koProps = buildSteamReviewProps(
      {...project, selectedLocale: 'ko'},
      idResolver,
    );
    const enProps = buildSteamReviewProps(
      {...project, selectedLocale: 'en'},
      idResolver,
    );

    expect(koProps?.video.url).toBe('blob:media_kr');
    expect(enProps?.video.url).toBe('blob:media_common');
  });

  it('converts the trim window to frames at the project fps', () => {
    const props = buildSteamReviewProps(filled(), idResolver);

    // 0–20s at 30fps.
    expect(props?.video.trimBeforeFrames).toBe(0);
    expect(props?.video.trimAfterFrames).toBe(600);
  });

  it('bakes the selected ratio’s layout in', () => {
    const project = filled();
    const wide = buildSteamReviewProps(
      {...project, selectedRatio: '16:9'},
      idResolver,
    );
    const square = buildSteamReviewProps(
      {...project, selectedRatio: '1:1'},
      idResolver,
    );

    expect(wide?.layout.video).toEqual({x: 101, y: 209, w: 1088, h: 612});
    expect(wide?.layout.sidebar).toBeDefined();
    expect(square?.layout.reviews.variant).toBe('scrolling');
  });

  it('resolves the locale wording and the four reviews', () => {
    const koProps = buildSteamReviewProps(
      {...filled(), selectedLocale: 'ko'},
      idResolver,
    );

    expect(koProps?.title).toBe('언더다크 : 디펜스');
    expect(koProps?.tags).toHaveLength(4);
    expect(koProps?.reviews).toHaveLength(4);
    expect(koProps?.reviews[0]?.recommendedLabel).toBe('추천');
    expect(koProps?.reviews[0]?.hoursLabel).toBe('기록상 56.9시간');

    const jaProps = buildSteamReviewProps(
      {...filled(), selectedLocale: 'ja'},
      idResolver,
    );

    expect(jaProps?.reviews[1]?.recommendedLabel).toBe('おすすめ');
    expect(jaProps?.reviews[1]?.hoursLabel).toBe('プレイタイム4.8時間');
  });

  it('hands thumbnails over as four resolved slots', () => {
    const props = buildSteamReviewProps(filled(), idResolver);

    expect(props?.thumbnails).toEqual([null, null, null, null]);
  });
});
