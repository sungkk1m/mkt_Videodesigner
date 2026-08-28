// failure-video Design §7.2 — the failure inspector, assembled from the pieces
// M1 extracted: three `PanelSection`s bound to the orientation the preview ratio
// selects, the caption bar's wording and styling, the FAIL beat's toggles, and
// the shared `EndCardSection`.
//
// There is no orientation control here on purpose (D-1). The preview ratio
// toggle in the stage toolbar *is* the orientation toggle, and the badge at the
// top says which group is being edited — inventing a second control would give
// the operator two ways to mean the same thing, and let them disagree.
import type {FailurePanelKey} from '../../domain/editor/project';
import {
  FAILURE_PANEL_KEYS,
  LOCALES,
  MAX_CAPTION_FONT_SIZE,
  MAX_OFFSET_PERCENT,
  MIN_SUBTITLE_FONT_SIZE,
  type AspectRatio,
  type Day1Panel,
  type FailureOrientation,
  type FailureSettings,
  type FailureSlot,
  type Locale,
  type LocalizedCopy,
  type MediaTransform,
} from '../../domain/editor/types';
import {FAIL_WINDOW_MS} from '../../domain/failure/effects';
import {failureLayout} from '../../domain/failure/layout';
import {ColorField} from './ColorField';
import {EndCardSection} from './EndCardSection';
import {InspectorSection} from './InspectorSection';
import {PanelSection} from './PanelSection';
import type {Day1EndCardPatch} from '../../domain/editor/project';
import type {Day1EndCardSlot} from './useDay1Assets';
import type {FrameSampler} from '../../domain/ports';
import {PlainField, formatSeconds} from './inspectorFields';

/** Plan §1.1 — the reference's own three levels, and the caption slot each owns. */
const SEGMENT_TITLES: Record<FailurePanelKey, string> = {
  panelA: '레벨 1 (FAIL 구간)',
  panelB: '레벨 20',
  panelC: '레벨 99',
};

const SEGMENT_SLOTS: Record<FailurePanelKey, FailureSlot> = {
  panelA: 'a',
  panelB: 'b',
  panelC: 'c',
};

const CAPTION_PLACEHOLDERS: Record<FailureSlot, string> = {
  a: 'LEVEL 1',
  b: 'LEVEL 20',
  c: 'LEVEL 99',
};

const ORIENTATION_LABELS: Record<FailureOrientation, string> = {
  vertical: '세로 (9:16)',
  horizontal: '가로 (16:9)',
};

const LOCALE_LABELS: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  'zh-TW': '繁體中文',
};

/** Plan D-5 — every element of the beat, and what turning it off is for. */
const FAIL_TOGGLES: {
  key: keyof FailureSettings['fail'];
  label: string;
  hint: string;
}[] = [
  {
    key: 'stampEnabled',
    label: 'FAIL 스탬프',
    hint: '레벨 1 구간 마지막 1초에 빨간 도장이 찍힙니다.',
  },
  {
    key: 'zoomEnabled',
    label: '펀치 줌',
    hint: '죽는 순간 화면이 2.2배까지 밀고 들어갑니다. 소스에 이미 있으면 끄세요.',
  },
  {
    key: 'desaturateEnabled',
    label: '탈색',
    hint: '영상만 흑백으로 빠집니다. 스탬프는 빨간색을 유지합니다.',
  },
  {
    key: 'shakeEnabled',
    label: '스크린 셰이크',
    hint: '도장이 안착하는 순간 캡션 바까지 함께 흔들립니다.',
  },
  {
    key: 'sfxEnabled',
    label: '임팩트 사운드',
    hint: '도장이 찍히는 프레임에 타격음 한 발. 스탬프를 끄면 같이 꺼집니다.',
  },
];

export interface FailureInspectorProps {
  settings: FailureSettings;
  /** The group the preview ratio selects — what these three sections edit. */
  orientation: FailureOrientation;
  copy: Record<Locale, LocalizedCopy>;
  ratio: AspectRatio;
  /** Section length for each segment, from the shared axis. */
  segmentDurationsMs: Record<FailurePanelKey, number>;
  endCardDurationMs: number;
  activeTransformOf: (key: FailurePanelKey) => MediaTransform;
  hasRatioOverride: (key: FailurePanelKey) => boolean;
  panelOf: (key: FailurePanelKey) => Day1Panel | null;
  disabled: boolean;
  frameSampler: FrameSampler;
  resolvePanelUrl: (key: FailurePanelKey) => string | null;
  onTrimIn: (key: FailurePanelKey, ms: number) => void;
  onTransform: (key: FailurePanelKey, patch: Partial<MediaTransform>) => void;
  onResetTransform: (key: FailurePanelKey) => void;
  onToggleRatioOverride: (key: FailurePanelKey, enabled: boolean) => void;
  onCaption: (patch: Partial<FailureSettings['caption']>) => void;
  onCaptionText: (locale: Locale, slot: FailureSlot, value: string) => void;
  onFail: (patch: Partial<FailureSettings['fail']>) => void;
  onEndCard: (patch: Day1EndCardPatch) => void;
  onEndCardAsset: (slot: Day1EndCardSlot, file: File | null) => void;
  onEndCardTrimIn: (ms: number) => void;
  onEndCardTrimLength: (ms: number) => void;
  resolveEndCardUrl: (slot: Day1EndCardSlot) => string | null;
}

export const FailureInspector = ({
  settings,
  orientation,
  copy,
  ratio,
  segmentDurationsMs,
  endCardDurationMs,
  activeTransformOf,
  hasRatioOverride,
  panelOf,
  disabled,
  frameSampler,
  resolvePanelUrl,
  onTrimIn,
  onTransform,
  onResetTransform,
  onToggleRatioOverride,
  onCaption,
  onCaptionText,
  onFail,
  onEndCard,
  onEndCardAsset,
  onEndCardTrimIn,
  onEndCardTrimLength,
  resolveEndCardUrl,
}: FailureInspectorProps) => {
  const {caption, endCard, fail} = settings;
  const videoRect = failureLayout(ratio).video;
  // Design D-11 — a level-1 section shorter than the beat plus a second of
  // playing room compresses the beat instead of rejecting the document, so this
  // is a hint rather than a blocker.
  const levelOneMs = segmentDurationsMs.panelA;
  const isBeatCompressed = levelOneMs < FAIL_WINDOW_MS + 1000;

  return (
    <aside aria-label="실패(FAIL) 속성" className="inspector">
      <div className="inspector__head">
        <h2>실패(FAIL) 속성</h2>
        <span className="inspector__scene" data-testid="inspector-template">
          실패(FAIL)
        </span>
      </div>

      <div className="inspector__body">
        {/* D-1 — the edit target follows the preview ratio, so say which group
            is on screen rather than leaving it to be inferred. */}
        <p className="panel__hint" data-testid="failure-orientation-badge">
          지금 편집 중: <b>{ORIENTATION_LABELS[orientation]}</b>용 영상 3개. 다른
          방향은 우상단 비율을 바꾸면 나타납니다.
        </p>

        {isBeatCompressed ? (
          <p
            className="notice notice--warning"
            data-testid="failure-beat-compressed"
          >
            레벨 1 구간이 {formatSeconds(levelOneMs)}s로 짧아 FAIL 연출이
            압축됩니다. 도장 1초는 그대로 남고 앞의 줌이 줄어듭니다.
          </p>
        ) : null}

        {FAILURE_PANEL_KEYS.map((key) => {
          const panelData = panelOf(key);

          return panelData ? (
            <PanelSection
              disabled={disabled}
              durationMs={segmentDurationsMs[key]}
              frameSampler={frameSampler}
              hasOverride={hasRatioOverride(key)}
              key={key}
              onResetTransform={() => onResetTransform(key)}
              onToggleRatioOverride={(enabled) =>
                onToggleRatioOverride(key, enabled)
              }
              onTransform={(patch) => onTransform(key, patch)}
              onTrimIn={(ms) => onTrimIn(key, ms)}
              panel={key}
              panelData={panelData}
              ratio={ratio}
              // A failure segment fills the whole video band — there is no
              // split or grid to place it in.
              rect={videoRect}
              testIdPrefix="failure"
              title={SEGMENT_TITLES[key]}
              transform={activeTransformOf(key)}
              url={resolvePanelUrl(key)}
            />
          ) : null;
        })}

        <InspectorSection
          badge={`${caption.fontSize}px`}
          defaultOpen
          id="failure-caption"
          title="캡션 바"
        >
          {LOCALES.map((locale) => (
            <div className="field field--pair" key={locale}>
              <span>{LOCALE_LABELS[locale]}</span>
              <div className="pair-row">
                {FAILURE_PANEL_KEYS.map((key) => {
                  const slot = SEGMENT_SLOTS[key];

                  return (
                    <input
                      aria-label={`${LOCALE_LABELS[locale]} ${SEGMENT_TITLES[key]} 캡션`}
                      data-testid={`failure-caption-${locale}-${slot}`}
                      disabled={disabled}
                      key={slot}
                      onChange={(event) =>
                        onCaptionText(locale, slot, event.target.value)
                      }
                      placeholder={CAPTION_PLACEHOLDERS[slot]}
                      type="text"
                      value={
                        (copy[locale] as LocalizedCopy).failureLabels?.[slot] ??
                        ''
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
          <p className="panel__hint">
            왼쪽부터 레벨 1·20·99입니다. 렌더에는 헤더에서 고른 언어의 문구가
            들어갑니다. 바 높이는 프레임의 10%로 고정입니다.
          </p>

          <PlainField
            disabled={disabled}
            label="글자 크기"
            max={MAX_CAPTION_FONT_SIZE}
            min={MIN_SUBTITLE_FONT_SIZE}
            onChange={(fontSize) => onCaption({fontSize})}
            step={1}
            suffix="px"
            testId="failure-caption-size"
            value={caption.fontSize}
          />
          <p className="panel__hint">
            세로 기준 크기입니다. 가로(16:9)에서는 프레임 높이에 맞춰 자동으로
            줄어듭니다.
          </p>
          <ColorField
            disabled={disabled}
            label="글자색"
            onChange={(textColor) => onCaption({textColor})}
            testId="failure-caption-color"
            value={caption.textColor}
          />
          <ColorField
            disabled={disabled}
            label="바 색"
            onChange={(barColor) => onCaption({barColor})}
            testId="failure-caption-bar-color"
            value={caption.barColor}
          />
        </InspectorSection>

        <InspectorSection
          badge={`${FAIL_TOGGLES.filter((toggle) => fail[toggle.key]).length}/${FAIL_TOGGLES.length}`}
          defaultOpen
          id="failure-fail"
          title="FAIL 연출"
        >
          <p className="panel__hint">
            레벨 1 구간의 마지막 1.5초에 들어갑니다. 구간 경계를 옮기면 연출도
            따라갑니다.
          </p>

          {FAIL_TOGGLES.map((toggle) => (
            <div key={toggle.key}>
              <label className="field field--toggle">
                <input
                  checked={Boolean(fail[toggle.key])}
                  data-testid={`failure-toggle-${toggle.key}`}
                  disabled={
                    disabled ||
                    // A hit with no stamp under it is a bug, not an option —
                    // the composition gates it the same way.
                    (toggle.key === 'sfxEnabled' && !fail.stampEnabled)
                  }
                  onChange={(event) =>
                    onFail({[toggle.key]: event.target.checked})
                  }
                  type="checkbox"
                />
                <span>{toggle.label}</span>
              </label>
              <p className="panel__hint">{toggle.hint}</p>
            </div>
          ))}

          {/* FR-12 — the dying character is not always centre frame. */}
          <PlainField
            disabled={disabled || !fail.zoomEnabled}
            label="줌 초점 X"
            max={MAX_OFFSET_PERCENT}
            min={-MAX_OFFSET_PERCENT}
            onChange={(focusX) => onFail({focusX})}
            step={1}
            suffix="%"
            testId="failure-focus-x"
            value={fail.focusX}
          />
          <PlainField
            disabled={disabled || !fail.zoomEnabled}
            label="줌 초점 Y"
            max={MAX_OFFSET_PERCENT}
            min={-MAX_OFFSET_PERCENT}
            onChange={(focusY) => onFail({focusY})}
            step={1}
            suffix="%"
            testId="failure-focus-y"
            value={fail.focusY}
          />
          <p className="panel__hint">
            0%가 화면 중앙입니다. 죽는 캐릭터가 한쪽에 있으면 그쪽으로 옮기세요.
            줌 배율(2.2배)과 전환 세기는 레퍼런스 실측값으로 고정입니다.
          </p>
        </InspectorSection>

        <EndCardSection
          disabled={disabled}
          endCard={endCard}
          endCardDurationMs={endCardDurationMs}
          frameSampler={frameSampler}
          onEndCard={onEndCard}
          onEndCardAsset={onEndCardAsset}
          onEndCardTrimIn={onEndCardTrimIn}
          onEndCardTrimLength={onEndCardTrimLength}
          ratio={ratio}
          resolveEndCardUrl={resolveEndCardUrl}
        />
      </div>
    </aside>
  );
};
