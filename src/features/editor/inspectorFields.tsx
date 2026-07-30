// Design Ref: §5.5 — the inspector's field primitives. Day1 Design Ref: §6.3
// reuses them for the Day1 inspector, so they live here instead of inside
// SceneInspector: two inspectors with drifting sliders would be a UI bug.
import {useEffect, useRef, useState} from 'react';

import {Dropzone} from './Dropzone';

export const formatSeconds = (ms: number) => (ms / 1000).toFixed(2);

export const SecondsField = ({
  disabled,
  label,
  max,
  min,
  onCommit,
  testId,
  valueMs,
}: {
  disabled: boolean;
  label: string;
  max: number;
  min: number;
  onCommit: (ms: number) => void;
  testId: string;
  valueMs: number;
}) => {
  const [draft, setDraft] = useState(() => formatSeconds(valueMs));
  const focusedRef = useRef(false);

  // Reformat from the committed value only while the user is not typing.
  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(formatSeconds(valueMs));
    }
  }, [valueMs]);

  return (
    <label className="field">
      <span>{label}</span>
      <input
        data-testid={testId}
        disabled={disabled}
        max={max / 1000}
        min={min / 1000}
        onBlur={() => {
          focusedRef.current = false;
          setDraft(formatSeconds(valueMs));
        }}
        onChange={(event) => {
          const next = event.target.value;
          const parsed = Number(next);

          setDraft(next);

          if (next.trim() !== '' && Number.isFinite(parsed)) {
            onCommit(parsed * 1000);
          }
        }}
        onFocus={() => {
          focusedRef.current = true;
        }}
        step="0.1"
        type="number"
        value={draft}
      />
    </label>
  );
};

/**
 * Slider plus an exact numeric entry. Dragging alone cannot reliably land on
 * round values such as 100% scale or 0 offset, which is the most common thing
 * to want back.
 */
const RangeField = ({
  disabled,
  displayStep,
  label,
  max,
  min,
  onChange,
  step,
  suffix,
  testId,
  toDisplay,
  fromDisplay,
  value,
}: {
  disabled: boolean;
  /** Step for the numeric input, in display units. */
  displayStep: number;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  suffix: string;
  testId: string;
  /** Maps the stored value to the number shown (e.g. 0.5 scale -> 50%). */
  toDisplay: (value: number) => number;
  fromDisplay: (display: number) => number;
  value: number;
}) => (
  <div className="field field--range">
    <span>
      {label}
      <strong>
        {Number(toDisplay(value).toFixed(2))}
        {suffix}
      </strong>
    </span>
    <div className="range-row">
      <input
        aria-label={label}
        data-testid={testId}
        disabled={disabled}
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <input
        aria-label={`${label} 값`}
        data-testid={`${testId}-number`}
        disabled={disabled}
        max={toDisplay(max)}
        min={toDisplay(min)}
        onChange={(event) => {
          const next = Number(event.target.value);

          if (Number.isFinite(next)) {
            onChange(Math.min(Math.max(fromDisplay(next), min), max));
          }
        }}
        step={displayStep}
        type="number"
        value={Number(toDisplay(value).toFixed(2))}
      />
    </div>
  </div>
);

/** Percentage-style range: stored 0-1, shown 0-100. */
export const PercentField = (props: {
  disabled: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  testId: string;
  value: number;
}) => (
  <RangeField
    {...props}
    displayStep={1}
    fromDisplay={(display) => display / 100}
    suffix="%"
    toDisplay={(value) => Math.round(value * 100)}
  />
);

/** Range whose stored value is already the displayed number. */
export const PlainField = (props: {
  disabled: boolean;
  displayStep?: number;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  suffix: string;
  testId: string;
  value: number;
}) => (
  <RangeField
    {...props}
    displayStep={props.displayStep ?? props.step}
    fromDisplay={(display) => display}
    toDisplay={(value) => value}
  />
);

export const AssetField = ({
  disabled,
  inputTestId,
  kind,
  label,
  name,
  onPick,
  previewUrl,
}: {
  disabled: boolean;
  inputTestId: string;
  kind: 'video' | 'image';
  label: string;
  name: string | null;
  onPick: (file: File | null) => void;
  previewUrl: string | null;
}) => (
  <div className="field field--asset">
    <span>{label}</span>
    <Dropzone
      disabled={disabled}
      fileName={name}
      inputTestId={inputTestId}
      kind={kind}
      onFile={(file) => onPick(file)}
      onRemove={() => onPick(null)}
      previewUrl={previewUrl}
      prompt={label}
    />
  </div>
);
