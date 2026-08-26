// Day1 Design Ref: §6.1 Template Selector — a dropdown in the header
// (day1-quad Design §4.3; it was a segmented control until four templates made
// the button row too wide).
// Switching is destructive: per-scene settings and panel settings cannot be
// carried across, so the confirmation dialog is part of the control rather than
// something the caller is trusted to remember.
import {useState} from 'react';

import {
  DAY1_QUAD_DURATION_PRESETS,
  TEMPLATE_KINDS,
  type DurationPreset,
  type TemplateKind,
} from '../../domain/editor/types';

const TEMPLATE_LABELS: Record<TemplateKind, string> = {
  'three-scene': '3장면',
  day1: 'Day1 비교',
  // day1-quad Plan Q11 — the operator's own wording.
  'day1-quad': 'Day1(4 video)',
  'kv-loop': '키비주얼 루핑',
};

const TEMPLATE_LOSS: Record<TemplateKind, string> = {
  'three-scene': '패널 A·B 영상과 분할선·라벨·엔드카드 설정',
  day1: 'Hook·Gameplay·CTA 장면 설정과 업로드한 영상',
  'day1-quad': '패널 A~D 영상과 분할선·라벨·엔드카드 설정',
  'kv-loop': '키비주얼 이미지와 반복·모션·오버레이 설정',
};

export interface TemplateSelectorProps {
  current: TemplateKind;
  /** The project's length preset, so the dialog can warn before coercing it. */
  currentPreset: DurationPreset;
  disabled: boolean;
  onSwitch: (template: TemplateKind) => void;
}

export const TemplateSelector = ({
  current,
  currentPreset,
  disabled,
  onSwitch,
}: TemplateSelectorProps) => {
  const [pending, setPending] = useState<TemplateKind | null>(null);
  const quadPresets = DAY1_QUAD_DURATION_PRESETS as readonly DurationPreset[];

  return (
    <>
      {/*
        day1-quad Design §4.3 — a dropdown rather than one button per template:
        four buttons already crowd the header and the list is meant to grow.

        Deliberately controlled on `current`. Choosing an option only opens the
        dialog, so React re-renders with `value={current}` and the select snaps
        back on its own — cancelling needs no restore logic at all (D-2).
      */}
      <select
        aria-label="템플릿"
        className="template-select"
        data-testid="template-selector"
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value as TemplateKind;

          if (next !== current) {
            setPending(next);
          }
        }}
        value={current}
      >
        {TEMPLATE_KINDS.map((template) => (
          <option key={template} value={template}>
            {TEMPLATE_LABELS[template]}
          </option>
        ))}
      </select>

      {pending ? (
        <div className="dialog" data-testid="template-switch-dialog" role="dialog">
          <div className="dialog__panel dialog__panel--narrow">
            <div className="dialog__title">
              <h2>{TEMPLATE_LABELS[pending]} 템플릿으로 바꿀까요?</h2>
            </div>
            <p className="panel__hint">
              {TEMPLATE_LOSS[current]}이 사라지고 새 템플릿의 기본값으로
              시작합니다. 프로젝트 이름·카피·오디오·렌더 설정은 그대로
              유지됩니다.
            </p>
            {/* Plan Q8a / Design §4.4 — the quad template offers 15s and 30s, so
                a 60s project is coerced on the way in. Say so before it happens,
                the same contract the looping template's ratio note has. */}
            {pending === 'day1-quad' && !quadPresets.includes(currentPreset) ? (
              <p
                className="panel__hint"
                data-testid="template-switch-preset-note"
              >
                4분할은 15초·30초만 지원합니다. 현재 {currentPreset}초 프로젝트는
                30초로 바뀝니다.
              </p>
            ) : null}
            {/* key-visual-looping FR-L14 / §6.1 — the ratio is coerced on the way
                in, so the dialog says so before it happens. */}
            {pending === 'kv-loop' ? (
              <p className="panel__hint" data-testid="template-switch-ratio-note">
                루핑 템플릿은 세로 전용입니다. 출력 규격이 9:16으로 고정되고,
                선택해 둔 다른 규격은 해제됩니다.
              </p>
            ) : null}
            <div className="dialog__actions">
              <button
                className="button button--secondary"
                data-testid="template-switch-cancel"
                onClick={() => setPending(null)}
                type="button"
              >
                취소
              </button>
              <button
                className="button button--danger"
                data-testid="template-switch-confirm"
                onClick={() => {
                  onSwitch(pending);
                  setPending(null);
                }}
                type="button"
              >
                바꾸기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
