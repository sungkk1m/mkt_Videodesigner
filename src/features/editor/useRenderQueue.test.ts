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
import {day1ProjectFixture} from '../../test/fixtures/project';
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
  it('does not leak three-scene blockers into a Day1 project', () => {
    const issues = preflightIssues(day1ProjectFixture(), false, false);

    expect(issues).not.toContain('영상 소재가 없습니다.');
    expect(issues).toContain('이 브라우저에서는 렌더를 실행할 수 없습니다.');
    expect(issues.some((issue) => issue.includes('나레이션'))).toBe(false);
  });
});
