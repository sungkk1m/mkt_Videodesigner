// Day1 Design Ref: §6.4 Eyedropper (FR-D08 / FR-D15) — a colour picker with an
// EyeDropper button next to it. The button is absent, not disabled, where the API
// is missing so the picker is the whole control rather than a broken one.
import {useState} from 'react';

/**
 * Chrome 95+ only, and not in the DOM lib. Declared locally rather than globally
 * so nothing else in the app can reach for it without the feature check.
 */
interface EyeDropperApi {
  open: (options?: {signal?: AbortSignal}) => Promise<{sRGBHex: string}>;
}

const eyeDropperCtor = ():
  | (new () => EyeDropperApi)
  | null => {
  if (typeof window === 'undefined' || !('EyeDropper' in window)) {
    return null;
  }

  return (window as unknown as {EyeDropper: new () => EyeDropperApi}).EyeDropper;
};

export const supportsEyeDropper = () => eyeDropperCtor() !== null;

export interface ColorFieldProps {
  disabled: boolean;
  label: string;
  onChange: (hex: string) => void;
  testId: string;
  value: string;
}

export const ColorField = ({
  disabled,
  label,
  onChange,
  testId,
  value,
}: ColorFieldProps) => {
  const [picking, setPicking] = useState(false);
  const Ctor = eyeDropperCtor();

  const pick = async () => {
    if (!Ctor) {
      return;
    }

    setPicking(true);

    try {
      const {sRGBHex} = await new Ctor().open();

      onChange(sRGBHex);
    } catch {
      // AbortError: the user pressed Escape. Keeping the current colour is the
      // right outcome, so there is nothing to report.
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className="field field--color-pick">
      <span>
        {label}
        <strong>{value.toUpperCase()}</strong>
      </span>
      <div className="color-row">
        <input
          aria-label={label}
          data-testid={testId}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          type="color"
          value={value}
        />
        {Ctor ? (
          <button
            className="button button--secondary"
            data-testid={`${testId}-eyedropper`}
            disabled={disabled || picking}
            onClick={() => void pick()}
            title="화면의 아무 색이나 집습니다"
            type="button"
          >
            {picking ? '집는 중…' : '스포이트'}
          </button>
        ) : null}
      </div>
      {Ctor ? (
        <p className="panel__hint">
          스포이트는 프리뷰 밖 화면까지 집을 수 있습니다. 게임 스크린샷을 띄워
          두고 키컬러를 집어보세요.
        </p>
      ) : (
        <p className="panel__hint" data-testid={`${testId}-no-eyedropper`}>
          이 브라우저는 스포이트를 지원하지 않아 컬러 피커만 사용합니다.
        </p>
      )}
    </div>
  );
};
