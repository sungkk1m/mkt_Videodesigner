// Module 4 domain behaviour: per-ratio framing, subtitles, transitions, Hook
// motion, CTA fallback, and four-locale copy.
import {describe, expect, it} from 'vitest';

import {testMediaReference, testUrlResolver} from '../../test/fixtures/media';
import {
  activeTransform,
  applySourceToAllScenes,
  buildCompositionProps,
  createProject,
  hasRatioOverride,
  moveTimelineBoundary,
  outputDimensions,
  setCopyField,
  setRatioOverride,
  setSceneSubtitleText,
  setSceneTransition,
  setSelectedLocale,
  setSelectedRatio,
  updateCtaSettings,
  updateHookSettings,
  updateSceneTransform,
  updateSubtitleStyle,
} from './project';

const withSource = () =>
  applySourceToAllScenes(createProject(15), testMediaReference());

describe('output dimensions', () => {
  it('maps every supported ratio to its pixel size', () => {
    expect(outputDimensions('9:16')).toEqual({width: 1080, height: 1920});
    expect(outputDimensions('1:1')).toEqual({width: 1080, height: 1080});
    expect(outputDimensions('16:9')).toEqual({width: 1920, height: 1080});
  });
});

describe('per-ratio transforms', () => {
  it('writes to the shared base until an override is enabled', () => {
    const project = updateSceneTransform(withSource(), 'hook', '1:1', {
      scale: 1.5,
    });

    expect(activeTransform(project.scenes[0], '9:16').scale).toBe(1.5);
    expect(activeTransform(project.scenes[0], '16:9').scale).toBe(1.5);
  });

  it('keeps other ratios unchanged once an override exists', () => {
    const base = updateSceneTransform(withSource(), 'hook', '9:16', {
      scale: 1.2,
    });
    const overridden = setRatioOverride(base, 'hook', '1:1', true);
    const project = updateSceneTransform(overridden, 'hook', '1:1', {
      scale: 2,
      x: 10,
    });

    expect(hasRatioOverride(project.scenes[0], '1:1')).toBe(true);
    expect(activeTransform(project.scenes[0], '1:1')).toMatchObject({
      scale: 2,
      x: 10,
    });
    expect(activeTransform(project.scenes[0], '9:16').scale).toBe(1.2);
    expect(activeTransform(project.scenes[0], '16:9').scale).toBe(1.2);
  });

  it('falls back to the base framing when the override is removed', () => {
    const project = setRatioOverride(
      updateSceneTransform(
        setRatioOverride(withSource(), 'hook', '1:1', true),
        'hook',
        '1:1',
        {scale: 2.4},
      ),
      'hook',
      '1:1',
      false,
    );

    expect(hasRatioOverride(project.scenes[0], '1:1')).toBe(false);
    expect(activeTransform(project.scenes[0], '1:1').scale).toBe(1);
  });

  it('renders the framing of the selected ratio', () => {
    const project = setSelectedRatio(
      updateSceneTransform(
        setRatioOverride(withSource(), 'hook', '16:9', true),
        'hook',
        '16:9',
        {scale: 1.8},
      ),
      '16:9',
    );

    expect(
      buildCompositionProps(project, testUrlResolver()).scenes[0]?.scale,
    ).toBe(1.8);
  });
});

describe('transitions', () => {
  it('defaults every scene to cut', () => {
    const props = buildCompositionProps(withSource(), testUrlResolver());

    expect(props.scenes.map((scene) => scene.transitionOut.kind)).toEqual([
      'cut',
      'cut',
      'cut',
    ]);
  });

  it('links an out transition to the next scene as its in transition', () => {
    const project = setSceneTransition(withSource(), 'hook', {
      kind: 'fade',
      durationMs: 400,
    });
    const props = buildCompositionProps(project, testUrlResolver());

    expect(props.scenes[0]?.transitionOut).toEqual({
      kind: 'fade',
      durationInFrames: 24,
    });
    expect(props.scenes[1]?.transitionIn).toEqual({
      kind: 'fade',
      durationInFrames: 24,
    });
    expect(props.scenes[0]?.transitionIn.kind).toBe('cut');
  });

  it('never lets a transition exceed half of its scene', () => {
    // The Hook scene is 2s at the 15s preset, so 1s is the ceiling.
    const project = setSceneTransition(withSource(), 'hook', {
      kind: 'fade',
      durationMs: 1000,
    });

    expect(project.scenes[0].transitionOut.durationMs).toBe(1000);

    // Shrinking the scene must shrink the transition with it.
    const shortened = moveTimelineBoundary(project, 0, 1200);

    expect(shortened.scenes[0].durationMs).toBe(1200);
    expect(shortened.scenes[0].transitionOut.durationMs).toBe(600);
  });

  it('ignores the CTA out transition because nothing follows it', () => {
    const project = setSceneTransition(withSource(), 'cta', {kind: 'zoom'});
    const props = buildCompositionProps(project, testUrlResolver());

    expect(props.scenes[2]?.transitionOut.kind).toBe('cut');
  });
});

describe('four-locale copy', () => {
  it('keeps each locale independent', () => {
    const project = setCopyField(
      setCopyField(withSource(), 'ko', 'hook', '지금 시작하세요'),
      'en',
      'hook',
      'Start now',
    );

    expect(project.copy.ko?.hook).toBe('지금 시작하세요');
    expect(project.copy.en?.hook).toBe('Start now');
    expect(project.copy.ja?.hook).toBe('');
    expect(project.copy['zh-TW']?.hook).toBe('');
  });

  it('renders the copy of the selected locale', () => {
    const project = setSelectedLocale(
      setSceneSubtitleText(
        setCopyField(withSource(), 'ja', 'ctaText', '今すぐダウンロード'),
        'ja',
        'gameplay',
        '実際のプレイ',
      ),
      'ja',
    );
    const props = buildCompositionProps(project, testUrlResolver());

    expect(props.scenes[1]?.subtitle?.text).toBe('実際のプレイ');
    expect(props.scenes[2]?.cta?.text).toBe('今すぐダウンロード');
  });

  it('omits a subtitle layer when the locale has no text', () => {
    expect(
      buildCompositionProps(withSource(), testUrlResolver()).scenes[1]
        ?.subtitle,
    ).toBeNull();
  });

  it('carries the Hook emphasis into the Hook subtitle only', () => {
    const project = updateHookSettings(
      setSceneSubtitleText(
        setSceneSubtitleText(withSource(), 'ko', 'hook', '단 3일 한정'),
        'ko',
        'cta',
        '단 3일 한정',
      ),
      {emphasizedText: '3일'},
    );
    const props = buildCompositionProps(project, testUrlResolver());

    expect(props.scenes[0]?.subtitle?.emphasizedText).toBe('3일');
    expect(props.scenes[2]?.subtitle?.emphasizedText).toBe('');
  });
});

describe('subtitle style', () => {
  it('clamps font size and background opacity', () => {
    const project = updateSubtitleStyle(withSource(), 'gameplay', {
      fontSize: 999,
      backgroundOpacity: 4,
    });

    expect(project.scenes[1].subtitle.fontSize).toBe(120);
    expect(project.scenes[1].subtitle.backgroundOpacity).toBe(1);
  });
});

describe('CTA background', () => {
  it('freezes the last gameplay frame when no CTA media exists', () => {
    const props = buildCompositionProps(withSource(), testUrlResolver());
    // Gameplay runs 0-10s of the source at 60fps, so the last frame is 599.
    expect(props.scenes[2]?.cta?.freezeSourceFrame).toBe(599);
    expect(props.scenes[2]?.cta?.mediaUrl).toBeNull();
  });

  it('uses dedicated CTA media when it is provided', () => {
    const project = updateCtaSettings(withSource(), {
      media: testMediaReference({id: 'media_cta', name: 'cta.mp4'}),
    });
    const props = buildCompositionProps(project, testUrlResolver('blob:cta'));

    expect(props.scenes[2]?.cta?.mediaUrl).toBe('blob:cta');
    expect(props.scenes[2]?.cta?.freezeSourceFrame).toBeNull();
  });

  it('stops generating a background when the user turns it off', () => {
    const project = updateCtaSettings(withSource(), {
      useGeneratedBackground: false,
    });

    expect(
      buildCompositionProps(project, testUrlResolver()).scenes[2]?.cta
        ?.freezeSourceFrame,
    ).toBeNull();
  });

  it('resolves CTA asset URLs and clamps blur and dim', () => {
    const project = updateCtaSettings(withSource(), {
      appIcon: testMediaReference({id: 'media_icon', kind: 'image'}),
      backgroundBlur: 999,
      backgroundDim: -1,
    });
    const cta = buildCompositionProps(project, testUrlResolver('blob:asset'))
      .scenes[2]?.cta;

    expect(cta?.appIconUrl).toBe('blob:asset');
    expect(cta?.logoUrl).toBeNull();
    expect(cta?.backgroundBlur).toBe(40);
    expect(cta?.backgroundDim).toBe(0);
  });
});
