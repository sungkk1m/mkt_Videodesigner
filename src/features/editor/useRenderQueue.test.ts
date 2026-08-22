// Day1 Design Ref: §7 RENDER_PREFLIGHT_FAILED and FR-D03 — the Batch gate has to
// branch on the template, because Day1 needs two videos where three-scene needs
// one. Design §8.1 lists this under the Day1 invariants.
import {describe, expect, it} from 'vitest';

import {
  applySourceToAllScenes,
  createProject,
  setDay1PanelSource,
} from '../../domain/editor/project';
import type {EditorProject} from '../../domain/editor/types';
import {
  day1ProjectFixture,
  kvLoopProjectFixture,
} from '../../test/fixtures/project';
import {testMediaReference} from '../../test/fixtures/media';
import {preflightIssues} from './useRenderQueue';

const threeSceneLoaded = () =>
  applySourceToAllScenes(createProject(15), testMediaReference());

const day1With = (panels: ('panelA' | 'panelB')[]): EditorProject =>
  panels.reduce(
    (project, panel) =>
      setDay1PanelSource(
        project,
        panel,
        testMediaReference({id: `media_${panel}`}),
      ),
    day1ProjectFixture(),
  );

describe('preflightIssues — three-scene', () => {
  it('blocks an empty project and passes a loaded one', () => {
    expect(preflightIssues(createProject(15), false, true)).toContain(
      '영상 소재가 없습니다.',
    );
    expect(preflightIssues(threeSceneLoaded(), true, true)).toEqual([]);
  });

  it('asks for a relink when the source is present but unresolved', () => {
    expect(preflightIssues(threeSceneLoaded(), false, true)).toEqual([
      '원본 영상이 연결되지 않았습니다. 파일을 다시 연결하세요.',
    ]);
  });
});

describe('preflightIssues — Day1 (FR-D03)', () => {
  it('names both missing panels', () => {
    expect(preflightIssues(day1ProjectFixture(), false, true)).toEqual([
      '영상 2개를 모두 올려야 렌더할 수 있습니다. 남은 패널: A · B',
    ]);
  });

  it('names only the panel still missing', () => {
    expect(preflightIssues(day1With(['panelA']), false, true)).toEqual([
      '영상 2개를 모두 올려야 렌더할 수 있습니다. 남은 패널: B',
    ]);
  });

  it('passes once both panels are present and decoded', () => {
    expect(
      preflightIssues(day1With(['panelA', 'panelB']), true, true),
    ).toEqual([]);
  });

  it('asks for a relink when both panels exist but one is unresolved', () => {
    expect(
      preflightIssues(day1With(['panelA', 'panelB']), false, true),
    ).toEqual(['패널 영상이 연결되지 않았습니다. 파일을 다시 연결하세요.']);
  });

  // Day1 never reports a three-scene blocker, and never asks for narration it
  // cannot have (Plan §2.2 keeps narration out of Day1).
  // Day1 Trim UX FR-S03/S04. The 15s preset gives each panel a 6s section, and
  // the fixture sources are 30s, so shortening one is what trips the gate.
  it('blocks a render when a panel source cannot fill its section (FR-S03)', () => {
    const short = setDay1PanelSource(
      day1With(['panelA', 'panelB']),
      'panelA',
      testMediaReference({id: 'media_short', durationMs: 4000}),
    );

    expect(preflightIssues(short, true, true)).toEqual([
      '원본이 구간보다 짧아 검은 화면이 출력됩니다. 구간 길이를 줄이거나 더 긴 영상을 사용하세요. 해당 패널: A',
    ]);
  });

  it('names every short panel so the user knows where to look (FR-S04)', () => {
    const short = setDay1PanelSource(
      setDay1PanelSource(
        day1With(['panelA', 'panelB']),
        'panelA',
        testMediaReference({id: 'short_a', durationMs: 4000}),
      ),
      'panelB',
      testMediaReference({id: 'short_b', durationMs: 2000}),
    );

    expect(preflightIssues(short, true, true)).toEqual([
      '원본이 구간보다 짧아 검은 화면이 출력됩니다. 구간 길이를 줄이거나 더 긴 영상을 사용하세요. 해당 패널: A · B',
    ]);
  });

  // A missing panel and a short one are different problems with different fixes,
  // so both are reported rather than one masking the other.
  it('reports a missing panel and a short panel together', () => {
    const issues = preflightIssues(
      setDay1PanelSource(
        day1ProjectFixture(),
        'panelA',
        testMediaReference({id: 'media_short', durationMs: 4000}),
      ),
      true,
      true,
    );

    expect(issues).toEqual([
      '영상 2개를 모두 올려야 렌더할 수 있습니다. 남은 패널: B',
      '원본이 구간보다 짧아 검은 화면이 출력됩니다. 구간 길이를 줄이거나 더 긴 영상을 사용하세요. 해당 패널: A',
    ]);
  });

  it('never reports a short panel for a three-scene project', () => {
    expect(preflightIssues(threeSceneLoaded(), true, true)).toEqual([]);
  });

  it('does not leak three-scene blockers into a Day1 project', () => {
    const issues = preflightIssues(day1ProjectFixture(), false, false);

    expect(issues).not.toContain('영상 소재가 없습니다.');
    expect(issues).toContain('이 브라우저에서는 렌더를 실행할 수 없습니다.');
    expect(issues.some((issue) => issue.includes('나레이션'))).toBe(false);
  });
});

describe('preflightIssues — kv-loop (FR-L13)', () => {
  const kvImage = (name: string) =>
    testMediaReference({
      id: `media_${name}`,
      kind: 'image' as const,
      mimeType: 'image/png',
      durationMs: undefined,
    });

  it('says how many key visuals are still missing', () => {
    expect(preflightIssues(kvLoopProjectFixture(), true, true)).toContain(
      '키비주얼 이미지를 2장 더 올려야 렌더할 수 있습니다.',
    );
  });

  it('passes with two key visuals and no overlays at all — SC5', () => {
    const project = kvLoopProjectFixture({
      images: {ko: [kvImage('a'), kvImage('b'), null, null]},
    });

    expect(preflightIssues(project, true, true)).toEqual([]);
  });

  it('asks for the images again when they cannot be decoded', () => {
    const project = kvLoopProjectFixture({
      images: {ko: [kvImage('a'), kvImage('b'), null, null]},
    });

    expect(preflightIssues(project, false, true)).toContain(
      '키비주얼 이미지가 연결되지 않았습니다. 파일을 다시 올려주세요.',
    );
  });

  it('counts the inherited set, so an untranslated locale still renders — SC6', () => {
    const project = kvLoopProjectFixture({
      images: {en: [kvImage('a'), kvImage('b'), null, null]},
    });

    expect(
      preflightIssues({...project, selectedLocale: 'ja'}, true, true),
    ).toEqual([]);
  });
});
