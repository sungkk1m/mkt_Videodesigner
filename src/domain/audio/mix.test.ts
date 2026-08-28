import {describe, expect, it} from 'vitest';

import {
  buildDay1Props,
  createProject,
  setSelectedLocale,
} from '../editor/project';
import type {NarrationTrack} from '../editor/types';
import {testMediaReference, testUrlResolver} from '../../test/fixtures/media';
import {duckedVolumeAt, duckingGainAt} from './ducking';
import {
  narrationBlockers,
  narrationOf,
  setBgm,
  setDucking,
  setNarration,
  setNarrationVolume,
  setOriginalVolume,
  updateBgm,
} from './mix';

// The audio mix is template-agnostic, so the default new project stands in for
// any of them. At the 15s preset its first section is 6s long.
const base = () => createProject(15);
const FIRST_SECTION_MS = 6000;

const narration = (durationMs: number, id = 'media_narration'): NarrationTrack => ({
  mode: 'uploaded',
  providerId: 'uploaded-audio',
  source: testMediaReference({id, kind: 'audio', durationMs}),
  durationMs,
  volume: 1,
});

const bgmTrack = () => ({
  source: testMediaReference({id: 'media_bgm', kind: 'audio'}),
  volume: 0.6,
  startMs: 0,
  loop: true,
});

describe('audio mix commands', () => {
  it('clamps every gain to 0..1', () => {
    const project = setDucking(setOriginalVolume(base(), 9), {targetGain: -3});

    expect(project.audio.originalVolume).toBe(1);
    expect(project.audio.ducking.targetGain).toBe(0);
  });

  it('keeps narration per locale and per scene', () => {
    const project = setNarration(
      setNarration(base(), 'ko', 'hook', narration(1500)),
      'en',
      'gameplay',
      narration(2000, 'media_en'),
    );

    expect(narrationOf(project, 'ko', 'hook')?.durationMs).toBe(1500);
    expect(narrationOf(project, 'ko', 'gameplay')).toBeNull();
    expect(narrationOf(project, 'en', 'gameplay')?.durationMs).toBe(2000);
  });

  it('removes a narration track without touching its siblings', () => {
    const project = setNarration(
      setNarration(base(), 'ko', 'hook', narration(1500)),
      'ko',
      'cta',
      narration(1000, 'media_cta'),
    );

    const removed = setNarration(project, 'ko', 'hook', null);

    expect(narrationOf(removed, 'ko', 'hook')).toBeNull();
    expect(narrationOf(removed, 'ko', 'cta')).not.toBeNull();
  });

  it('clamps narration volume', () => {
    const project = setNarrationVolume(
      setNarration(base(), 'ko', 'hook', narration(1500)),
      'ko',
      'hook',
      5,
    );

    expect(narrationOf(project, 'ko', 'hook')?.volume).toBe(1);
  });

  it('ignores a BGM patch when no BGM exists', () => {
    const project = base();

    expect(updateBgm(project, {volume: 0.2})).toBe(project);
  });
});

describe('narrationBlockers', () => {
  it('reports narration longer than its section', () => {
    const project = setNarration(base(), 'ko', 'hook', narration(6600));
    const blockers = narrationBlockers(project);

    expect(blockers).toEqual([
      {
        locale: 'ko',
        kind: 'hook',
        narrationMs: 6600,
        sceneMs: FIRST_SECTION_MS,
      },
    ]);
  });

  it('accepts narration that fits', () => {
    expect(narrationBlockers(setNarration(base(), 'ko', 'hook', narration(5800))))
      .toEqual([]);
  });

  it('only checks the locales it is asked about', () => {
    const project = setNarration(base(), 'en', 'hook', narration(6600));

    expect(narrationBlockers(project)).toEqual([]);
    expect(narrationBlockers(project, ['ko', 'en'])).toHaveLength(1);
  });
});

describe('ducking', () => {
  const envelope = {
    enabled: true,
    targetGain: 0.25,
    attackInFrames: 10,
    releaseInFrames: 10,
  };
  const windows = [{fromFrame: 60, durationInFrames: 60}];

  it('is a no-op when disabled', () => {
    expect(duckingGainAt(70, windows, {...envelope, enabled: false})).toBe(1);
  });

  it('holds the target gain for the whole narration', () => {
    expect(duckingGainAt(60, windows, envelope)).toBe(0.25);
    expect(duckingGainAt(119, windows, envelope)).toBe(0.25);
  });

  it('ramps down before and back up after', () => {
    expect(duckingGainAt(45, windows, envelope)).toBe(1);
    expect(duckingGainAt(55, windows, envelope)).toBeCloseTo(0.625);
    expect(duckingGainAt(125, windows, envelope)).toBeCloseTo(0.625);
    expect(duckingGainAt(140, windows, envelope)).toBe(1);
  });

  it('takes the strongest duck when windows overlap', () => {
    const overlapping = [
      {fromFrame: 60, durationInFrames: 60},
      {fromFrame: 100, durationInFrames: 60},
    ];

    expect(duckingGainAt(125, overlapping, envelope)).toBe(0.25);
  });

  it('scales the base volume', () => {
    expect(duckedVolumeAt(70, 0.8, windows, envelope)).toBeCloseTo(0.2);
  });
});

describe('audio render props', () => {
  it('carries BGM and the ducking envelope in frames', () => {
    const project = setBgm(base(), {...bgmTrack(), startMs: 500});
    const audio = buildDay1Props(project, testUrlResolver('blob:audio'))?.audio;

    expect(audio?.bgm).toEqual({
      url: 'blob:audio',
      volume: 0.6,
      startInFrames: 15,
      loop: true,
    });
    expect(audio?.ducking).toEqual({
      enabled: true,
      targetGain: 0.25,
      attackInFrames: 5,
      releaseInFrames: 9,
    });
  });

  it('drops BGM whose audio cannot be resolved', () => {
    const project = setBgm(base(), bgmTrack());

    expect(buildDay1Props(project, testUrlResolver(null))?.audio.bgm).toBeNull();
  });

  /**
   * Day1 Plan §2.2 and key-visual-looping Plan L9 both keep narration out, so
   * every template the editor still has passes no sections to the mixer and the
   * list comes back empty however many tracks the project stores. Stored tracks
   * survive untouched — `narrationOf` above still reads them back — so a
   * template that wants narration only has to hand its sections in.
   */
  it('renders no narration for a template that declares no sections', () => {
    const project = setSelectedLocale(
      setNarration(base(), 'ko', 'hook', narration(1500)),
      'ko',
    );

    expect(
      buildDay1Props(project, testUrlResolver('blob:audio'))?.audio.narration,
    ).toEqual([]);
    expect(narrationOf(project, 'ko', 'hook')?.durationMs).toBe(1500);
  });
});
