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
}

export const CopyPanel = ({
  copy,
  locale,
  disabled,
  onLocale,
  onField,
  onSubtitle,
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
  </div>
);
