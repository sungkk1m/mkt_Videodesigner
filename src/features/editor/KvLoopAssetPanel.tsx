// key-visual-looping Design Ref: §6.2 — the key visual set for the locale in the
// header, how many there are, how often the cycle repeats, and the one warning a
// non-portrait source earns (FR-L19).
import {
  KV_LOOP_MAX_LOOPS,
  KV_LOOP_MIN_LOOPS,
  LOCALES,
  MAX_SECTION_COUNT,
  MIN_SECTION_COUNT,
  type DurationPreset,
  type KvLoopSettings,
  type Locale,
  type MediaReference,
} from '../../domain/editor/types';
import {kvLoopCombination} from '../../domain/kvloop/cycle';
import type {AppError} from '../../shared/errors/appError';
import {LOCALE_LABELS} from './CopyPanel';
import {Dropzone} from './Dropzone';

const countRange = Array.from(
  {length: MAX_SECTION_COUNT - MIN_SECTION_COUNT + 1},
  (_, index) => MIN_SECTION_COUNT + index,
);

const loopRange = Array.from(
  {length: KV_LOOP_MAX_LOOPS - KV_LOOP_MIN_LOOPS + 1},
  (_, index) => KV_LOOP_MIN_LOOPS + index,
);

/** A landscape or square key visual loses its sides in a 9:16 frame. */
const isPortrait = (reference: MediaReference | null) =>
  reference === null ||
  reference.width === undefined ||
  reference.height === undefined ||
  reference.height >= reference.width;

export interface KvLoopAssetPanelProps {
  settings: KvLoopSettings;
  locale: Locale;
  preset: DurationPreset;
  /** The set actually in play, inherited or not. */
  references: readonly (MediaReference | null)[];
  inheritedFrom: Locale | null;
  /** How many more key visuals the loop needs before it can render (FR-L13). */
  missingImages: number;
  disabled: boolean;
  busy: boolean;
  uploadError: AppError | null;
  autosaveError: AppError | null;
  imageUrl: (index: number) => string | null;
  onLocale: (locale: Locale) => void;
  onUpload: (index: number, file: File | null) => void;
  onMove: (from: number, to: number) => void;
  onCount: (count: number) => void;
  onLoopCount: (loopCount: number) => void;
  onFit: (index: number, fit: 'cover' | 'contain') => void;
}

export const KvLoopAssetPanel = ({
  settings,
  locale,
  preset,
  references,
  inheritedFrom,
  missingImages,
  disabled,
  busy,
  uploadError,
  autosaveError,
  imageUrl,
  onLocale,
  onUpload,
  onMove,
  onCount,
  onLoopCount,
  onFit,
}: KvLoopAssetPanelProps) => {
  const count = settings.slots.length;

  return (
    <>
      {missingImages > 0 ? (
        <p className="notice notice--warning" data-testid="kv-images-blocker">
          키비주얼 이미지를 {missingImages}장 더 올려야 렌더할 수 있습니다.
        </p>
      ) : null}

      <div aria-label="언어" className="segmented" role="group">
        {LOCALES.map((entry) => (
          <button
            aria-pressed={locale === entry}
            className={`segmented__item${
              locale === entry ? ' segmented__item--on' : ''
            }`}
            data-testid={`kv-locale-${entry}`}
            key={entry}
            onClick={() => onLocale(entry)}
            type="button"
          >
            {LOCALE_LABELS[entry]}
          </button>
        ))}
      </div>

      {/* FR-L04 — which set this locale is looking at, always visible. */}
      {inheritedFrom ? (
        <p className="notice" data-testid="kv-inherited-badge">
          {LOCALE_LABELS[inheritedFrom]} 셋을 상속 중입니다. 이 언어 전용 이미지를
          올리면 그 셋으로 대체됩니다.
        </p>
      ) : null}

      <div className="panel__group">
        <h3 className="panel__subtitle">키비주얼 {count}장</h3>

        {settings.slots.map((slot, index) => {
          const reference = references[index] ?? null;
          const url = imageUrl(index);

          return (
            <section
              className="panel__group"
              data-testid={`kv-slot-${index}`}
              key={index}
            >
              <div className="kv-slot__head">
                <strong>KV {index + 1}</strong>
                <span className="kv-slot__actions">
                  <button
                    aria-label={`KV ${index + 1} 앞으로`}
                    className="button button--secondary"
                    data-testid={`kv-slot-${index}-up`}
                    disabled={disabled || index === 0}
                    onClick={() => onMove(index, index - 1)}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`KV ${index + 1} 뒤로`}
                    className="button button--secondary"
                    data-testid={`kv-slot-${index}-down`}
                    disabled={disabled || index === count - 1}
                    onClick={() => onMove(index, index + 1)}
                    type="button"
                  >
                    ↓
                  </button>
                </span>
              </div>

              <Dropzone
                disabled={disabled}
                fileName={reference?.name ?? null}
                hint="이미지를 끌어다 놓거나 클릭해 선택"
                inputTestId={`kv-slot-${index}-input`}
                kind="image"
                onFile={(file) => onUpload(index, file)}
                onRemove={() => onUpload(index, null)}
                previewUrl={url}
                prompt={`KV ${index + 1} 이미지`}
              />

              {/* A reference with no session URL is a restored project: the
                  metadata came back from IndexedDB and the pixels did not. An
                  image slot keeps no file handle, so the same file has to be
                  uploaded again — say which one, the way `SourceRepair` does. */}
              {reference && url === null ? (
                <p
                  className="notice notice--warning"
                  data-testid={`kv-slot-${index}-reupload`}
                >
                  이미지를 다시 올려주세요. 기대 파일: {reference.name}
                </p>
              ) : null}

              {/* FR-L19 — the way out of a cropped landscape key visual is the
                  same one a Day1 panel has: keep it whole over a blurred copy. */}
              {isPortrait(reference) ? null : (
                <div data-testid={`kv-slot-${index}-orientation`}>
                  <p className="notice notice--warning">
                    세로 소재가 아닙니다 ({reference?.width}×{reference?.height}).
                    9:16 출력에서 좌우가 잘립니다.
                  </p>
                  <label className="field field--toggle">
                    <input
                      checked={slot.transform.fit === 'contain'}
                      data-testid={`kv-slot-${index}-contain`}
                      disabled={disabled}
                      onChange={(event) =>
                        onFit(index, event.target.checked ? 'contain' : 'cover')
                      }
                      type="checkbox"
                    />
                    <span>전체 보존 (남는 자리는 흐린 배경)</span>
                  </label>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="panel__group">
        <h3 className="panel__subtitle">장수 · 반복</h3>

        <label className="field">
          <span>키비주얼 장수</span>
          <select
            data-testid="kv-count"
            disabled={disabled}
            onChange={(event) => onCount(Number(event.target.value))}
            value={count}
          >
            {countRange.map((candidate) => {
              const verdict = kvLoopCombination(
                preset,
                settings.loopCount,
                candidate,
              );

              return (
                <option
                  disabled={!verdict.ok}
                  key={candidate}
                  value={candidate}
                >
                  {candidate}장{verdict.ok ? '' : ' (길이 부족)'}
                </option>
              );
            })}
          </select>
        </label>

        <label className="field">
          <span>반복 횟수</span>
          <select
            data-testid="kv-loop-count"
            disabled={disabled}
            onChange={(event) => onLoopCount(Number(event.target.value))}
            value={settings.loopCount}
          >
            {loopRange.map((candidate) => {
              const verdict = kvLoopCombination(preset, candidate, count);

              return (
                <option
                  disabled={!verdict.ok}
                  key={candidate}
                  value={candidate}
                >
                  {candidate}회{verdict.ok ? '' : ' (길이 부족)'}
                </option>
              );
            })}
          </select>
        </label>

        {/* FR-L07 — when the current choice is the one that does not fit, the
            reason and the way out are stated rather than left to be guessed. */}
        {(() => {
          const verdict = kvLoopCombination(preset, settings.loopCount, count);

          return verdict.ok ? null : (
            <p className="notice notice--error" data-testid="kv-combination">
              {verdict.error.message}
            </p>
          );
        })()}

        <p className="panel__hint">
          한 사이클은 {(preset / settings.loopCount).toFixed(2)}초이고, 타임라인에는
          그 한 사이클만 편집 가능한 상태로 보입니다. 뒤의 반복은 같은 타이밍을
          그대로 되풀이합니다.
        </p>
      </div>

      {busy ? <p className="panel__hint">확인 중…</p> : null}

      {uploadError ? (
        <p className="notice notice--error" data-testid="kv-source-error">
          {uploadError.message}
        </p>
      ) : null}

      {autosaveError ? (
        <p className="notice notice--error" data-testid="autosave-error">
          {autosaveError.message}
        </p>
      ) : null}
    </>
  );
};
