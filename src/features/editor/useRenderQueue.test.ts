// Day1 Design Ref: §7 RENDER_PREFLIGHT_FAILED and FR-D03 — the Batch gate has to
// branch on the template, because Day1 needs two videos where three-scene needs
// one. Design §8.1 lists this under the Day1 invariants.
import {describe, expect, it} from 'vitest';

import {
  applySourceToAllScenes,
  createProject,
  setDay1PanelSource,
  setFailurePanelSource,
} from '../../domain/editor/project';
import type {EditorProject} from '../../domain/editor/types';
import {
  day1ProjectFixture,
  day1QuadProjectFixture,
  failureProjectFixture,
  kvLoopProjectFixture,
} from '../../test/fixtures/project';
import {testMediaReference} from '../../test/fixtures/media';
import {preflightIssues} from './useRenderQueue';
import type {Day1PanelKey} from '../../domain/editor/project';

const threeSceneLoaded = () =>
  applySourceToAllScenes(createProject(15), testMediaReference());

const quadWith = (panels: Day1PanelKey[]): EditorProject =>
  panels.reduce(
    (project, panel) =>
      setDay1PanelSource(
        project,
        panel,
        testMediaReference({id: `media_${panel}`, durationMs: 12_000}),
      ),
    day1QuadProjectFixture(),
  );

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

/**
 * day1-quad FR-Q02 — the gate used to read `template === 'day1'`, so the
 * four-panel template got no render preflight at all: a quad project could start
 * a render with panels missing, unresolved, or too short for their section.
 * Found by running the E2E suite, not by any unit test.
 */
describe('preflightIssues — Day1-quad (FR-Q02)', () => {
  it('names all four missing panels and counts them', () => {
    expect(preflightIssues(day1QuadProjectFixture(), false, true)).toEqual([
      '영상 4개를 모두 올려야 렌더할 수 있습니다. 남은 패널: A · B · C · D',
    ]);
  });

  it('names only the panels still missing', () => {
    expect(
      preflightIssues(quadWith(['panelA', 'panelC']), false, true),
    ).toEqual([
      '영상 4개를 모두 올려야 렌더할 수 있습니다. 남은 패널: B · D',
    ]);
  });

  it('asks for a relink once all four are present but unresolved', () => {
    const loaded = quadWith(['panelA', 'panelB', 'panelC', 'panelD']);

    expect(preflightIssues(loaded, false, true)).toEqual([
      '패널 영상이 연결되지 않았습니다. 파일을 다시 연결하세요.',
    ]);
    expect(preflightIssues(loaded, true, true)).toEqual([]);
  });

  it('still reports a quad panel whose source cannot fill its section', () => {
    const short = setDay1PanelSource(
      quadWith(['panelA', 'panelB', 'panelC', 'panelD']),
      'panelD',
      testMediaReference({id: 'short', durationMs: 1200}),
    );

    expect(preflightIssues(short, true, true).join(' ')).toContain('D');
  });

  it('leaves the two-panel wording unchanged', () => {
    expect(preflightIssues(day1ProjectFixture(), false, true)).toEqual([
      '영상 2개를 모두 올려야 렌더할 수 있습니다. 남은 패널: A · B',
    ]);
  });
});

// failure-video Design §7.5 / Plan Q2 — the preflight asks per selected ratio.
// This is where "no automatic fallback between the orientations" becomes
// something the operator can actually see before a render starts.
describe('preflightIssues — failure (Q2)', () => {
  const fill = (
    project: EditorProject,
    orientation: 'vertical' | 'horizontal',
    keys: readonly ('panelA' | 'panelB' | 'panelC')[],
    durationMs = 60_000,
  ) =>
    keys.reduce(
      (current, key) =>
        setFailurePanelSource(
          current,
          orientation,
          key,
          testMediaReference({id: `${orientation}_${key}`, durationMs}),
        ),
      project,
    );

  const verticalOnly = () =>
    fill(failureProjectFixture(), 'vertical', ['panelA', 'panelB', 'panelC']);

  it('names the orientation and the levels still missing', () => {
    expect(preflightIssues(failureProjectFixture(), false, true)).toEqual([
      '세로(9:16)용 영상 3개를 모두 올려야 렌더할 수 있습니다. 남은 구간: 레벨 1 · 레벨 20 · 레벨 99',
    ]);
  });

  it('passes a 9:16-only batch with only the vertical group filled', () => {
    expect(preflightIssues(verticalOnly(), true, true)).toEqual([]);
  });

  it('blocks the moment 16:9 joins the batch, naming that group', () => {
    const project = verticalOnly();
    const both: EditorProject = {
      ...project,
      render: {...project.render, selectedRatios: ['9:16', '16:9']},
    };

    expect(preflightIssues(both, true, true)).toEqual([
      '가로(16:9)용 영상 3개를 모두 올려야 렌더할 수 있습니다. 남은 구간: 레벨 1 · 레벨 20 · 레벨 99',
    ]);
  });

  it('reports each orientation separately when both are half filled', () => {
    const half = fill(
      fill(failureProjectFixture(), 'vertical', ['panelA']),
      'horizontal',
      ['panelA', 'panelB'],
    );
    const both: EditorProject = {
      ...half,
      render: {...half.render, selectedRatios: ['9:16', '16:9']},
    };
    const issues = preflightIssues(both, true, true);

    expect(issues).toHaveLength(2);
    expect(issues[0]).toContain('세로(9:16)');
    expect(issues[0]).toContain('레벨 20 · 레벨 99');
    expect(issues[1]).toContain('가로(16:9)');
    expect(issues[1]).toContain('레벨 99');
  });

  it('reports a segment whose source cannot fill its section', () => {
    // Level 99 owns 18.9s of the 30s preset; a 5s source leaves it black.
    const short = fill(verticalOnly(), 'vertical', ['panelC'], 5000);
    const issues = preflightIssues(short, true, true);

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('세로(9:16) 레벨 99');
  });

  it('reports an unresolved source once every slot is filled', () => {
    expect(preflightIssues(verticalOnly(), false, true)).toEqual([
      '구간 영상이 연결되지 않았습니다. 파일을 다시 연결하세요.',
    ]);
  });
});
