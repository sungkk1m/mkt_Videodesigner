// failure-video Design §8.1 — the render snapshot the Player and the render job
// share, and the one thing that is genuinely new about it: the orientation the
// selected ratio resolves to.
import {describe, expect, it} from 'vitest';

import {failureLayout} from '../failure/layout';
import {
  buildEditorSnapshot,
  buildFailureProps,
  createProject,
  setFailureLabelText,
  setFailurePanelSource,
  setFailureTrimInMs,
  setSelectedRatio,
  updateFailureCaption,
  updateFailureFail,
  updateFailureTransform,
} from './project';
import {testMediaReference} from '../../test/fixtures/media';
import {
  day1ProjectFixture,
  failureProjectFixture,
} from '../../test/fixtures/project';
import type {EditorProject, FailureOrientation} from './types';

const VERTICAL_URL = 'blob:vertical';
const HORIZONTAL_URL = 'blob:horizontal';

/** Answers with a different URL per orientation, so the panels say where they came from. */
const resolver = (reference: {id: string} | null | undefined) =>
  reference ? (reference.id.startsWith('v_') ? VERTICAL_URL : HORIZONTAL_URL) : null;

/** A failure project with all six slots filled. */
const loaded = (preset: 30 | 60 = 30): EditorProject =>
  (['vertical', 'horizontal'] as const).reduce<EditorProject>(
    (project, orientation) =>
      (['panelA', 'panelB', 'panelC'] as const).reduce<EditorProject>(
        (current, key) =>
          setFailurePanelSource(
            current,
            orientation,
            key,
            testMediaReference({
              id: `${orientation === 'vertical' ? 'v' : 'h'}_${key}`,
              durationMs: 60_000,
            }),
          ),
        project,
      ),
    failureProjectFixture({}, preset),
  );

describe('buildFailureProps', () => {
  it('returns null for a foreign template', () => {
    expect(buildFailureProps(day1ProjectFixture(), resolver)).toBeNull();
    expect(buildFailureProps(createProject(15), resolver)).toBeNull();
  });

  it('lays out four sections whose frames total the preset', () => {
    const props = buildFailureProps(loaded(), resolver);
    const frames = props?.sections.map((section) => section.durationInFrames) ?? [];

    expect(frames.reduce((sum, count) => sum + count, 0)).toBe(30 * 30);
    expect(props?.sections.map((section) => section.id)).toEqual([
      'panel-a',
      'panel-b',
      'panel-c',
      'endcard',
    ]);
    expect(props?.sections.map((section) => section.activePanel)).toEqual([
      'a',
      'b',
      'c',
      null,
    ]);
    // Each section starts where the previous one ended.
    let cursor = 0;
    for (const section of props?.sections ?? []) {
      expect(section.fromFrame).toBe(cursor);
      cursor += section.durationInFrames;
    }
  });

  // D-1 — the preview ratio toggle is the orientation toggle. This is the whole
  // orientation feature, observable in one assertion.
  it('reads the source group the selected ratio asks for', () => {
    const project = loaded();
    const vertical = buildFailureProps(project, resolver);
    const horizontal = buildFailureProps(
      setSelectedRatio(project, '16:9'),
      resolver,
    );

    expect(vertical?.orientation).toBe<FailureOrientation>('vertical');
    expect(vertical?.panels.map((panel) => panel.url)).toEqual([
      VERTICAL_URL,
      VERTICAL_URL,
      VERTICAL_URL,
    ]);

    expect(horizontal?.orientation).toBe<FailureOrientation>('horizontal');
    expect(horizontal?.panels.map((panel) => panel.url)).toEqual([
      HORIZONTAL_URL,
      HORIZONTAL_URL,
      HORIZONTAL_URL,
    ]);
  });

  it('carries the layout for the ratio being rendered', () => {
    const project = loaded();

    expect(buildFailureProps(project, resolver)?.layout).toEqual(
      failureLayout('9:16'),
    );
    expect(
      buildFailureProps(setSelectedRatio(project, '16:9'), resolver)?.layout,
    ).toEqual(failureLayout('16:9'));
  });

  it('resolves the captions for the selected locale', () => {
    const project = setFailureLabelText(loaded(), 'en', 'b', 'LEVEL 42');

    expect(buildFailureProps(project, resolver)?.captions).toEqual([
      'LEVEL 1',
      'LEVEL 20',
      'LEVEL 99',
    ]);
    expect(
      buildFailureProps({...project, selectedLocale: 'en'}, resolver)?.captions,
    ).toEqual(['LEVEL 1', 'LEVEL 42', 'LEVEL 99']);
  });

  it('leaves every panel label empty — the caption bar carries the text', () => {
    expect(
      buildFailureProps(loaded(), resolver)?.panels.map((panel) => panel.label),
    ).toEqual(['', '', '']);
  });

  it('converts each segment trim to frames', () => {
    const project = setFailureTrimInMs(loaded(), 'vertical', 'panelA', 2000);
    const [panelA] = buildFailureProps(project, resolver)?.panels ?? [];

    // 2s in at 30fps, over the 5.4s level-1 section.
    expect(panelA?.trimBeforeFrames).toBe(60);
    expect(panelA?.trimAfterFrames).toBe(60 + 162);
  });

  it('passes the framing of the active orientation only', () => {
    const project = updateFailureTransform(
      loaded(),
      'horizontal',
      'panelA',
      '16:9',
      {fit: 'cover', scale: 1.8},
    );

    expect(buildFailureProps(project, resolver)?.panels[0]).toMatchObject({
      fit: 'contain',
      scale: 1,
    });
    expect(
      buildFailureProps(setSelectedRatio(project, '16:9'), resolver)?.panels[0],
    ).toMatchObject({fit: 'cover', scale: 1.8});
  });

  it('passes the caption and FAIL settings straight through', () => {
    const project = updateFailureFail(
      updateFailureCaption(loaded(), {fontSize: 120, barColor: '#101010'}),
      {desaturateEnabled: false, focusX: -12},
    );
    const props = buildFailureProps(project, resolver);

    expect(props?.captionStyle).toEqual({
      fontSize: 120,
      textColor: '#ffffff',
      barColor: '#101010',
    });
    expect(props?.fail).toMatchObject({
      desaturateEnabled: false,
      zoomEnabled: true,
      focusX: -12,
    });
  });

  it('reuses the Day1 end card contract untouched (FR-07)', () => {
    const props = buildFailureProps(loaded(), resolver);

    expect(props?.endCard).toMatchObject({
      mode: 'banner',
      bannerUrl: null,
      iconUrl: null,
      videoUrl: null,
    });
    expect(props?.endCard.iconRect).toBeDefined();
  });

  it('carries an unresolved slot through as null rather than failing', () => {
    const props = buildFailureProps(failureProjectFixture(), resolver);

    expect(props?.panels.map((panel) => panel.url)).toEqual([null, null, null]);
  });

  it('freezes the snapshot so a later edit cannot mutate a running job', () => {
    const props = buildFailureProps(loaded(), resolver);

    expect(Object.isFrozen(props)).toBe(true);
    expect(Object.isFrozen(props?.panels)).toBe(true);
    expect(Object.isFrozen(props?.sections)).toBe(true);
    expect(Object.isFrozen(props?.fail)).toBe(true);
  });

  it('scales to the 60s preset', () => {
    const props = buildFailureProps(loaded(60), resolver);

    expect(
      props?.sections.reduce((sum, section) => sum + section.durationInFrames, 0),
    ).toBe(60 * 30);
  });
});

// conventions §3.1 — a template is two arms, and this is the second one.
describe('buildEditorSnapshot on a failure project', () => {
  it('tags the snapshot as failure and hands over the failure props', () => {
    const snapshot = buildEditorSnapshot(loaded(), resolver);

    expect(snapshot.template).toBe('failure');
    if (snapshot.template === 'failure') {
      expect(snapshot.props.panels).toHaveLength(3);
      expect(snapshot.props.orientation).toBe('vertical');
    }
  });

  it('follows the ratio a batch job swaps in, with no failure-specific code', () => {
    const snapshot = buildEditorSnapshot(
      {...loaded(), selectedRatio: '16:9'},
      resolver,
    );

    expect(snapshot.template).toBe('failure');
    if (snapshot.template === 'failure') {
      expect(snapshot.props.orientation).toBe('horizontal');
      expect(snapshot.props.panels[0].url).toBe(HORIZONTAL_URL);
    }
  });

  it('still routes the other templates to their own arms', () => {
    expect(buildEditorSnapshot(day1ProjectFixture(), resolver).template).toBe(
      'day1',
    );
    expect(buildEditorSnapshot(createProject(15), resolver).template).toBe(
      'three-scene',
    );
  });
});
