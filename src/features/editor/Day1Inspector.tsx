// Day1 Design Ref: §6.3 Day1 인스펙터 — panel A/B framing, the split line with an
// eyedropper, the four-locale panel labels with their styling, and the end card.
// Reuses the three-scene accordion and field primitives so both inspectors feel
// identical to operate.
//
// failure-video Design §4.1-1 — the panel block and the end-card block moved out
// to `PanelSection.tsx` and `EndCardSection.tsx` so a second panelled inspector
// can assemble them. What is left here is the split line and the labels, which
// are Day1's own.
import type {Day1PanelKey} from '../../domain/editor/project';
import {
  LOCALES,
  MAX_LABEL_GLOW_PX,
  MAX_LABEL_OUTLINE_WIDTH_PX,
  MAX_SPLIT_LINE_WIDTH_PX,
  MAX_SUBTITLE_FONT_SIZE,
  MIN_SUBTITLE_FONT_SIZE,
  SUBTITLE_POSITIONS,
  type AspectRatio,
  type Day1Panel,
  type Day1PanelSlot,
  type Day1QuadSettings,
  type Day1Settings,
  type Locale,
  type LocalizedCopy,
  type MediaTransform,
  type PanelRect,
  type SubtitleStyle,
} from '../../domain/editor/types';
import {quadLayout, splitLayout} from '../../domain/day1/layout';
import {ColorField} from './ColorField';
import {EndCardSection} from './EndCardSection';
import {InspectorSection} from './InspectorSection';
import {PANEL_TEST_KEY, PanelSection} from './PanelSection';
import type {Day1EndCardPatch} from '../../domain/editor/project';
import type {Day1EndCardSlot} from './useDay1Assets';
import type {FrameSampler} from '../../domain/ports';
import {PercentField, PlainField} from './inspectorFields';

const LABEL_PLACEHOLDERS: Record<Day1PanelSlot, string> = {
  a: 'DAY 1',
  b: 'DAY 30',
  c: 'DAY 3',
  d: 'DAY 7',
};

/** day1-quad Design §5.1 — a panel's own slot in the output, for the trim preview. */
const PANEL_RECT = (
  panels: readonly Day1PanelKey[],
  key: Day1PanelKey,
  ratio: AspectRatio,
  lineWidthPx: number,
): PanelRect => {
  const index = panels.indexOf(key);

  return panels.length > 2
    ? (quadLayout(ratio, lineWidthPx).cells[index] as PanelRect)
    : (splitLayout(ratio, lineWidthPx)[index === 0 ? 'a' : 'b'] as PanelRect);
};

const LOCALE_LABELS: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  'zh-TW': '繁體中文',
};

const POSITION_LABELS: Record<SubtitleStyle['position'], string> = {
  top: '위',
  center: '가운데',
  bottom: '아래',
};

export interface Day1InspectorProps {
  /** day1-quad Design §7.1 — either panelled payload; the fields read here are shared. */
  settings: Day1Settings | Day1QuadSettings;
  /** The panel keys this template has, in order: two for Day1, four for the quad. */
  panelKeys: readonly Day1PanelKey[];
  /** Resolves a panel without indexing the payload (conventions §3.1). */
  panelOf: (panel: Day1PanelKey) => Day1Panel | null;
  copy: Record<Locale, LocalizedCopy>;
  ratio: AspectRatio;
  /** Section length for each panel, from the shared axis. Day1 Design Ref: §3.1. */
  panelDurationsMs: Record<Day1PanelKey, number>;
  /**
   * The end card section's own length. day1-quad Design §4.1 — this used to be
   * the `DAY1_END_CARD_MS` constant, which made the trim slot disagree with a
   * card the operator had dragged longer.
   */
  endCardDurationMs: number;
  activeTransformOf: (panel: Day1PanelKey) => MediaTransform;
  hasRatioOverride: (panel: Day1PanelKey) => boolean;
  disabled: boolean;
  /** Day1 Trim UX Design Ref: §1.2 — injected, because features cannot reach
      into infrastructure. */
  frameSampler: FrameSampler;
  /** Session URL of a panel's video, or null while it is unresolved. */
  resolvePanelUrl: (panel: Day1PanelKey) => string | null;
  onTrimIn: (panel: Day1PanelKey, ms: number) => void;
  onTransform: (panel: Day1PanelKey, patch: Partial<MediaTransform>) => void;
  onResetTransform: (panel: Day1PanelKey) => void;
  onToggleRatioOverride: (panel: Day1PanelKey, enabled: boolean) => void;
  onSplit: (patch: Partial<Day1Settings['split']>) => void;
  onLabelStyle: (patch: Partial<Day1Settings['labelStyle']>) => void;
  onLabelText: (locale: Locale, panel: Day1PanelSlot, value: string) => void;
  onEndCard: (patch: Day1EndCardPatch) => void;
  onEndCardAsset: (slot: Day1EndCardSlot, file: File | null) => void;
  /** Endcard-Video FR-07 — trim moves only through the reconciling command. */
  onEndCardTrimIn: (ms: number) => void;
  /** day1-trim-preview FR-05 — window length, same reconciliation rule. */
  onEndCardTrimLength: (ms: number) => void;
  resolveEndCardUrl: (slot: Day1EndCardSlot) => string | null;
}

export const Day1Inspector = ({
  settings,
  copy,
  ratio,
  panelDurationsMs,
  activeTransformOf,
  frameSampler,
  hasRatioOverride,
  disabled,
  resolvePanelUrl,
  onTrimIn,
  onTransform,
  onResetTransform,
  onToggleRatioOverride,
  onSplit,
  onLabelStyle,
  onLabelText,
  onEndCard,
  onEndCardAsset,
  onEndCardTrimIn,
  onEndCardTrimLength,
  resolveEndCardUrl,
  endCardDurationMs,
  panelKeys,
  panelOf,
}: Day1InspectorProps) => {
  const {endCard, labelStyle, split} = settings;

  return (
    <aside aria-label="Day1 속성" className="inspector">
      <div className="inspector__head">
        <h2>Day1 속성</h2>
        <span className="inspector__scene" data-testid="inspector-template">
          {panelKeys.length > 2 ? 'Day1(4 video)' : 'Day1 비교'}
        </span>
      </div>

      <div className="inspector__body">
        {panelKeys.map((panel) => {
          const panelData = panelOf(panel);

          return panelData ? (
            <PanelSection
              disabled={disabled}
              durationMs={panelDurationsMs[panel]}
              frameSampler={frameSampler}
              hasOverride={hasRatioOverride(panel)}
              key={panel}
              onResetTransform={() => onResetTransform(panel)}
              onToggleRatioOverride={(enabled) =>
                onToggleRatioOverride(panel, enabled)
              }
              onTransform={(patch) => onTransform(panel, patch)}
              onTrimIn={(ms) => onTrimIn(panel, ms)}
              panel={panel}
              panelData={panelData}
              ratio={ratio}
              rect={PANEL_RECT(panelKeys, panel, ratio, split.lineWidthPx)}
              transform={activeTransformOf(panel)}
              url={resolvePanelUrl(panel)}
            />
          ) : null;
        })}

        <InspectorSection
          badge={`${split.lineWidthPx}px`}
          defaultOpen
          id="day1-split"
          title="분할선"
        >
          <PlainField
            disabled={disabled}
            label="두께"
            max={MAX_SPLIT_LINE_WIDTH_PX}
            min={0}
            onChange={(lineWidthPx) => onSplit({lineWidthPx})}
            step={1}
            suffix="px"
            testId="day1-split-width"
            value={split.lineWidthPx}
          />
          <ColorField
            disabled={disabled}
            label="색"
            onChange={(lineColor) => onSplit({lineColor})}
            testId="day1-split-color"
            value={split.lineColor}
          />
        </InspectorSection>

        <InspectorSection
          badge={POSITION_LABELS[labelStyle.position]}
          id="day1-label"
          title="라벨"
        >
          {LOCALES.map((locale) => (
            <div className="field field--pair" key={locale}>
              <span>{LOCALE_LABELS[locale]}</span>
              <div className="pair-row">
                {/* day1-quad Design §7.2 — one input per panel the template
                    has: two for Day1, four for the quad. */}
                {panelKeys.map((key) => {
                  const panel = PANEL_TEST_KEY[key];

                  return (
                    <input
                      aria-label={`${LOCALE_LABELS[locale]} 패널 ${panel.toUpperCase()} 라벨`}
                      data-testid={`day1-label-${locale}-${panel}`}
                      disabled={disabled}
                      key={panel}
                      onChange={(event) =>
                        onLabelText(locale, panel, event.target.value)
                      }
                      placeholder={LABEL_PLACEHOLDERS[panel]}
                      type="text"
                      value={
                        (copy[locale] as LocalizedCopy).day1Labels?.[panel] ?? ''
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
          <p className="panel__hint">
            {panelKeys.length > 2
              ? '왼쪽부터 패널 A·B·C·D입니다.'
              : '왼쪽이 패널 A, 오른쪽이 패널 B입니다.'}{' '}
            렌더에는 헤더에서 고른 언어의
            문구가 들어갑니다.
          </p>

          <label className="field">
            <span>위치</span>
            <select
              data-testid="day1-label-position"
              disabled={disabled}
              onChange={(event) =>
                onLabelStyle({
                  position: event.target.value as SubtitleStyle['position'],
                })
              }
              value={labelStyle.position}
            >
              {SUBTITLE_POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {POSITION_LABELS[position]}
                </option>
              ))}
            </select>
          </label>
          <PlainField
            disabled={disabled}
            label="크기"
            max={MAX_SUBTITLE_FONT_SIZE}
            min={MIN_SUBTITLE_FONT_SIZE}
            onChange={(fontSize) => onLabelStyle({fontSize})}
            step={1}
            suffix="px"
            testId="day1-label-size"
            value={labelStyle.fontSize}
          />
          <ColorField
            disabled={disabled}
            label="글자색"
            onChange={(textColor) => onLabelStyle({textColor})}
            testId="day1-label-color"
            value={labelStyle.textColor}
          />
          <ColorField
            disabled={disabled}
            label="외곽선 색"
            onChange={(outlineColor) => onLabelStyle({outlineColor})}
            testId="day1-label-outline-color"
            value={labelStyle.outlineColor}
          />
          <PlainField
            disabled={disabled}
            label="외곽선 두께"
            max={MAX_LABEL_OUTLINE_WIDTH_PX}
            min={0}
            onChange={(outlineWidthPx) => onLabelStyle({outlineWidthPx})}
            step={1}
            suffix="px"
            testId="day1-label-outline-width"
            value={labelStyle.outlineWidthPx}
          />

          {/* day1-label-effects FR-01 ~ FR-04 — two independent effects, each
              revealing its own settings only while it is on. Same shape as the
              subtitle background block in `SceneInspector`. */}
          <label className="field field--toggle">
            <input
              checked={labelStyle.showBackground}
              data-testid="day1-label-background"
              disabled={disabled}
              onChange={(event) =>
                onLabelStyle({showBackground: event.target.checked})
              }
              type="checkbox"
            />
            <span>배경 박스</span>
          </label>
          {labelStyle.showBackground ? (
            <>
              <ColorField
                disabled={disabled}
                label="박스 색"
                onChange={(backgroundColor) => onLabelStyle({backgroundColor})}
                testId="day1-label-background-color"
                value={labelStyle.backgroundColor}
              />
              <PercentField
                disabled={disabled}
                label="박스 불투명도"
                max={1}
                min={0}
                onChange={(backgroundOpacity) =>
                  onLabelStyle({backgroundOpacity})
                }
                step={0.05}
                testId="day1-label-background-opacity"
                value={labelStyle.backgroundOpacity}
              />
              {/* FR-07/FR-08 — the plate's own halo. Same three controls as the
                  glyph glow below, on its own fields: the two never share a
                  colour or a radius. */}
              <label className="field field--toggle">
                <input
                  checked={labelStyle.boxGlowEnabled}
                  data-testid="day1-label-box-glow"
                  disabled={disabled}
                  onChange={(event) =>
                    onLabelStyle({boxGlowEnabled: event.target.checked})
                  }
                  type="checkbox"
                />
                <span>박스 글로우</span>
              </label>
              {labelStyle.boxGlowEnabled ? (
                <>
                  <ColorField
                    disabled={disabled}
                    label="박스 글로우 색"
                    onChange={(boxGlowColor) => onLabelStyle({boxGlowColor})}
                    testId="day1-label-box-glow-color"
                    value={labelStyle.boxGlowColor}
                  />
                  <PlainField
                    disabled={disabled}
                    label="박스 글로우 세기"
                    max={MAX_LABEL_GLOW_PX}
                    min={0}
                    onChange={(boxGlowStrengthPx) =>
                      onLabelStyle({boxGlowStrengthPx})
                    }
                    step={1}
                    suffix="px"
                    testId="day1-label-box-glow-strength"
                    value={labelStyle.boxGlowStrengthPx}
                  />
                </>
              ) : null}
            </>
          ) : null}

          <label className="field field--toggle">
            <input
              checked={labelStyle.glowEnabled}
              data-testid="day1-label-glow"
              disabled={disabled}
              onChange={(event) =>
                onLabelStyle({glowEnabled: event.target.checked})
              }
              type="checkbox"
            />
            <span>글자 글로우</span>
          </label>
          {labelStyle.glowEnabled ? (
            <>
              <ColorField
                disabled={disabled}
                label="글자 글로우 색"
                onChange={(glowColor) => onLabelStyle({glowColor})}
                testId="day1-label-glow-color"
                value={labelStyle.glowColor}
              />
              <PlainField
                disabled={disabled}
                label="글자 글로우 세기"
                max={MAX_LABEL_GLOW_PX}
                min={0}
                onChange={(glowStrengthPx) => onLabelStyle({glowStrengthPx})}
                step={1}
                suffix="px"
                testId="day1-label-glow-strength"
                value={labelStyle.glowStrengthPx}
              />
            </>
          ) : null}
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
