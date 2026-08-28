// Design Ref: §5.5 Left Input Panel — Hook copy and subcopy, per-scene subtitles,
// and CTA copy for all four locales. Each locale keeps an independent value.
import {
  LOCALES,
  SCENE_LABELS,
  SCENE_ORDER,
  STEAM_REVIEW_KR_NOTICE,
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
   * key-visual-looping FR-L15 — present only for the looping template, where
   * every other field on this panel is a three-scene concept. Its presence is
   * what turns the panel into the single disclaimer field.
   */
  kvLoop?: {onDisclaimer: (value: string) => void};
  /**
   * steam-review Design §9 — present only for the store page template. Its
   * presence turns the panel into title/description/tags, and the Korean
   * fourth tag renders locked (D-6).
   */
  steamReview?: {
    onTitle: (value: string) => void;
    onDescription: (value: string) => void;
    onTag: (index: number, value: string) => void;
  };
}

export const CopyPanel = ({
  copy,
  locale,
  disabled,
  onLocale,
  onField,
  onSubtitle,
  kvLoop,
  steamReview,
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

    {steamReview ? (
      <>
        <div className="panel__group">
          <h3>게임 타이틀</h3>
          <label className="field">
            <span>타이틀 ({LOCALE_LABELS[locale]})</span>
            <input
              data-testid="copy-steam-title"
              disabled={disabled}
              onChange={(event) => steamReview.onTitle(event.target.value)}
              type="text"
              value={copy.steamReview?.title ?? ''}
            />
          </label>
        </div>

        <div className="panel__group">
          <h3>스토어 설명</h3>
          <label className="field">
            <span>설명 ({LOCALE_LABELS[locale]})</span>
            <textarea
              data-testid="copy-steam-description"
              disabled={disabled}
              onChange={(event) =>
                steamReview.onDescription(event.target.value)
              }
              rows={5}
              value={copy.steamReview?.description ?? ''}
            />
          </label>
          <p className="panel__hint">
            16:9 사이드바에서만 렌더됩니다. 줄바꿈이 그대로 반영됩니다.
          </p>
        </div>

        <div className="panel__group">
          <h3>태그 4개</h3>
          {[0, 1, 2, 3].map((index) => {
            // D-6 / Plan Q5 — the Korean fourth chip is the loot-box notice.
            const locked = locale === 'ko' && index === 3;

            return (
              <label className="field" key={index}>
                <span>
                  태그 {index + 1}
                  {locked ? ' 🔒' : ''}
                </span>
                <input
                  data-testid={`copy-steam-tag-${index}`}
                  disabled={disabled || locked}
                  onChange={(event) =>
                    steamReview.onTag(index, event.target.value)
                  }
                  type="text"
                  value={
                    locked
                      ? STEAM_REVIEW_KR_NOTICE
                      : (copy.steamReview?.tags[index] ?? '')
                  }
                />
              </label>
            );
          })}
          {locale === 'ko' ? (
            <p className="panel__hint" data-testid="copy-steam-tag-locked-hint">
              한국어 4번째 태그는 「{STEAM_REVIEW_KR_NOTICE}」로 고정되어
              수정할 수 없습니다.
            </p>
          ) : null}
        </div>
      </>
    ) : kvLoop ? (
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
