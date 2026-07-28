// Drag-and-drop file target. Design Ref: §5.5 — every upload in the editor was a
// bare file input, which renders as an unlabelled box. The pattern (dashed
// border, drag highlight, thumbnail, remove) matches the sibling banner tool.
//
// The <input type="file"> stays in the DOM and is only visually hidden, so
// Playwright `setInputFiles` keeps working against the existing test ids.
import {useRef, useState, type ChangeEvent, type DragEvent} from 'react';

export type DropzoneKind = 'video' | 'image' | 'audio';

const ACCEPT: Record<DropzoneKind, string> = {
  video: 'video/*',
  image: 'image/*',
  audio: 'audio/*',
};

export interface DropzoneProps {
  kind: DropzoneKind;
  /** Preserved from the pre-existing bare input so E2E selectors keep working. */
  inputTestId: string;
  prompt: string;
  hint?: string;
  disabled?: boolean;
  fileName?: string | null;
  /** Object URL for the preview thumbnail; audio never shows one. */
  previewUrl?: string | null;
  onFile: (file: File) => void;
  onRemove?: () => void;
}

export const Dropzone = ({
  kind,
  inputTestId,
  prompt,
  hint,
  disabled = false,
  fileName = null,
  previewUrl = null,
  onFile,
  onRemove,
}: DropzoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const filled = fileName !== null;
  const showThumbnail = filled && previewUrl !== null && kind !== 'audio';

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      onFile(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setOver(false);

    if (disabled) {
      return;
    }

    const file = event.dataTransfer.files[0];

    if (file && file.type.startsWith(`${kind}/`)) {
      onFile(file);
    }
  };

  return (
    <label
      className={`dropzone${over ? ' dropzone--over' : ''}${
        filled ? ' dropzone--filled' : ''
      }${disabled ? ' dropzone--disabled' : ''}`}
      onDragLeave={() => setOver(false)}
      onDragOver={(event) => {
        event.preventDefault();

        if (!disabled) {
          setOver(true);
        }
      }}
      onDrop={handleDrop}
    >
      <input
        accept={ACCEPT[kind]}
        className="dropzone__input"
        data-testid={inputTestId}
        disabled={disabled}
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />

      {filled ? (
        <>
          {showThumbnail ? (
            kind === 'video' ? (
              <video
                className="dropzone__thumb"
                muted
                preload="metadata"
                src={previewUrl ?? undefined}
              />
            ) : (
              <img alt="" className="dropzone__thumb" src={previewUrl ?? ''} />
            )
          ) : null}
          <span className="dropzone__file">
            <span className="dropzone__name">{fileName}</span>
          </span>
          {onRemove ? (
            <button
              aria-label={`${prompt} 제거`}
              className="dropzone__remove"
              disabled={disabled}
              onClick={(event) => {
                // Stops the wrapping <label> from re-opening the file picker.
                event.preventDefault();
                event.stopPropagation();
                onRemove();
              }}
              type="button"
            >
              ×
            </button>
          ) : null}
        </>
      ) : (
        <>
          <span className="dropzone__prompt">{prompt}</span>
          <span className="dropzone__sub">
            {hint ?? '파일을 끌어다 놓거나 클릭해 선택'}
          </span>
        </>
      )}
    </label>
  );
};
