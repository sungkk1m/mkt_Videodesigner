// Day1 Design Ref: §6.1 Template Selector — a segmented control in the header.
// Switching is destructive: per-scene settings and panel settings cannot be
// carried across, so the confirmation dialog is part of the control rather than
// something the caller is trusted to remember.
import {useState} from 'react';

import {
  TEMPLATE_KINDS,
  type TemplateKind,
} from '../../domain/editor/types';

const TEMPLATE_LABELS: Record<TemplateKind, string> = {
  'three-scene': '3장면',
  day1: 'Day1 비교',
};

const TEMPLATE_LOSS: Record<TemplateKind, string> = {
  'three-scene': '패널 A·B 영상과 분할선·라벨·엔드카드 설정',
  day1: 'Hook·Gameplay·CTA 장면 설정과 업로드한 영상',
};

export interface TemplateSelectorProps {
  current: TemplateKind;
  disabled: boolean;
  onSwitch: (template: TemplateKind) => void;
}

export const TemplateSelector = ({
  current,
  disabled,
  onSwitch,
}: TemplateSelectorProps) => {
  const [pending, setPending] = useState<TemplateKind | null>(null);

  return (
    <>
      <div
        aria-label="템플릿"
        className="segmented"
        data-testid="template-selector"
        role="group"
      >
        {TEMPLATE_KINDS.map((template) => (
          <button
            aria-pressed={current === template}
            className={`segmented__item${
              current === template ? ' segmented__item--on' : ''
            }`}
            data-testid={`template-${template}`}
            disabled={disabled}
            key={template}
            onClick={() => {
              if (template !== current) {
                setPending(template);
              }
            }}
            type="button"
          >
            {TEMPLATE_LABELS[template]}
          </button>
        ))}
      </div>

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
