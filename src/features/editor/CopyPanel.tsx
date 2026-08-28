// Design Ref: §5.5 Left Input Panel — Hook copy and subcopy, per-scene subtitles,
// and CTA copy for all four locales. Each locale keeps an independent value.
import {
  LOCALES,
  SCENE_LABELS,
  SCENE_ORDER,
  type Locale,
  type LocalizedCopy,
  type SceneKind,
} from '../../domain/editor/types';

/**
 * key-visual-looping FR-L11 — the bannerdesigner disclaimer policy: no wrapping,
 * with a character-count hint once a line is long enough to be at risk. The
 * reference line ("확률형 아이템 포함") is well inside this.
 */
const DISCLAIMER_HINT_LENGTH = 24;

export const LOCALE_LABELS: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  'zh-TW': '繁體中文',
};

export interface CopyPanelProps {
  copy: LocalizedCopy;
  locale: Locale;
  disabled: boolean;
  onLocale: (locale: Locale) => void;
  onField: (
    field: 'hook' | 'hookSubcopy' | 'ctaText' | 'ctaSubcopy',
    value: string,
  ) => void;
  onSubtitle: (kind: SceneKind, value: string) => void;
  /**
   * key-visual-looping FR-L15 — its presence turns the panel into the single
   * disclaimer field.
   *
   * The looping template is the only one that opens the copy tab today, so the
   * other arm is currently unreachable. It is kept because the fields it edits
   * are still live project data: `sceneSubtitles` is the text the narration
   * generator reads, and a template that opens the copy tab gets them back with
   * no work.
   */
  kvLoop?: {onDisclaimer: (value: string) => void};
}

export const CopyPanel = ({
  copy,
  locale,
  disabled,
  onLocale,
  onField,
  onSubtitle,
  kvLoop,
}: CopyPanelProps) => (
  <div className="copy">
    <div aria-label="언어" className="segmented" role="group">
      {LOCALES.map((entry) => (
        <button
          aria-pressed={locale === entry}
          className={`segmented__item${
            locale === entry ? ' segmented__item--on' : ''
          }`}
          data-testid={`locale-${entry}`}
          key={entry}
          onClick={() => onLocale(entry)}
          type="button"
        >
          {LOCALE_LABELS[entry]}
        </button>
      ))}
    </div>

    {kvLoop ? (
      <div className="panel__group">
        <h3>하단 고지문구</h3>
        <label className="field">
          <span>고지문구 ({LOCALE_LABELS[locale]})</span>
          <input
            data-testid="copy-kv-disclaimer"
            disabled={disabled}
            onChange={(event) => kvLoop.onDisclaimer(event.target.value)}
            type="text"
            value={copy.kvLoopDisclaimer ?? ''}
          />
        </label>
        {/* FR-L11 — the render never wraps this line, so a line that will not
            fit is worth saying now rather than discovering in the output. */}
        {(copy.kvLoopDisclaimer ?? '').length > DISCLAIMER_HINT_LENGTH ? (
          <p className="panel__hint" data-testid="copy-kv-disclaimer-hint">
            {DISCLAIMER_HINT_LENGTH}자를 넘으면 한 줄에 들어가지 않을 수 있습니다
            (현재 {(copy.kvLoopDisclaimer ?? '').length}자). 줄바꿈 없이
            출력됩니다.
          </p>
        ) : null}
        <p className="panel__hint">
          크기와 색은 오른쪽 인스펙터에서 조절합니다. 비워 두면 고지문구 없이
          렌더됩니다.
        </p>
      </div>
    ) : (
      <>
    <div className="panel__group">
      <h3>Hook</h3>
      <label className="field">
        <span>Hook 문구</span>
        <textarea
          data-testid="copy-hook"
          disabled={disabled}
          onChange={(event) => onField('hook', event.target.value)}
          rows={2}
          value={copy.hook}
        />
      </label>
      <label className="field">
        <span>Hook 보조 문구</span>
        <input
          data-testid="copy-hook-subcopy"
          disabled={disabled}
          onChange={(event) => onField('hookSubcopy', event.target.value)}
          type="text"
          value={copy.hookSubcopy}
        />
      </label>
    </div>

    <div className="panel__group">
      <h3>장면 자막</h3>
      {SCENE_ORDER.map((kind) => (
        <label className="field" key={kind}>
          <span>{SCENE_LABELS[kind]}</span>
          <input
            data-testid={`copy-subtitle-${kind}`}
            disabled={disabled}
            onChange={(event) => onSubtitle(kind, event.target.value)}
            type="text"
            value={copy.sceneSubtitles[kind] ?? ''}
          />
        </label>
      ))}
    </div>

    <div className="panel__group">
      <h3>CTA</h3>
      <label className="field">
        <span>CTA 문구</span>
        <input
          data-testid="copy-cta"
          disabled={disabled}
          onChange={(event) => onField('ctaText', event.target.value)}
          type="text"
          value={copy.ctaText}
        />
      </label>
      <label className="field">
        <span>CTA 보조 문구</span>
        <input
          data-testid="copy-cta-subcopy"
          disabled={disabled}
          onChange={(event) => onField('ctaSubcopy', event.target.value)}
          type="text"
          value={copy.ctaSubcopy}
        />
      </label>
    </div>
      </>
    )}
  </div>
);
