// Day1 Design Ref: §6.3 Day1 인스펙터 — panel A/B framing, the split line with an
// eyedropper, the four-locale panel labels with their styling, and the end card.
// Reuses the three-scene accordion and field primitives so both inspectors feel
// identical to operate.
import type {Day1PanelKey} from '../../domain/editor/project';
import {
  DAY1_CARD_MOTIONS,
  DAY1_ICON_ANIMATIONS,
  LOCALES,
  MAX_ICON_ADJUST,
  MAX_ICON_SCALE,
  MAX_LABEL_OUTLINE_WIDTH_PX,
  MAX_OFFSET_PERCENT,
  MAX_SCALE,
  MAX_SPLIT_LINE_WIDTH_PX,
  MAX_SUBTITLE_FONT_SIZE,
  MIN_ICON_SCALE,
  MIN_SCALE,
  MIN_SUBTITLE_FONT_SIZE,
  SUBTITLE_POSITIONS,
  type ActivePanel,
  type AspectRatio,
  type Day1CardMotion,
  type Day1IconAnimation,
  type Day1Settings,
  type Locale,
  type LocalizedCopy,
  type MediaReference,
  type MediaTransform,
  type SubtitleStyle,
} from '../../domain/editor/types';
import {ColorField} from './ColorField';
import {InspectorSection} from './InspectorSection';
import type {Day1EndCardPatch} from '../../domain/editor/project';
import type {Day1EndCardSlot} from './useDay1Assets';
import {
  AssetField,
  PercentField,
  PlainField,
  SecondsField,
  formatSeconds,
} from './inspectorFields';

const PANEL_TITLES: Record<Day1PanelKey, string> = {
  panelA: '패널 A',
  panelB: '패널 B',
};

const PANEL_TEST_KEY: Record<Day1PanelKey, string> = {
  panelA: 'a',
  panelB: 'b',
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

const ICON_ANIMATION_LABELS: Record<Day1IconAnimation, string> = {
  pop: '팝인',
  pulse: '펄스',
  glow: '글로우',
  none: '없음',
};

const CARD_MOTION_LABELS: Record<Day1CardMotion, string> = {
  'ken-burns': 'Ken Burns',
  fade: '페이드 인',
  none: '없음',
};

const END_CARD_LABELS: Record<Day1EndCardSlot, string> = {
  banner: '완성 배너 PNG',
  appIcon: '앱 아이콘 PNG',
};

export interface Day1InspectorProps {
  settings: Day1Settings;
  copy: Record<Locale, LocalizedCopy>;
  ratio: AspectRatio;
  /** Section length for each panel, from the shared axis. Day1 Design Ref: §3.1. */
  panelDurationsMs: Record<Day1PanelKey, number>;
  activeTransformOf: (panel: Day1PanelKey) => MediaTransform;
  hasRatioOverride: (panel: Day1PanelKey) => boolean;
  disabled: boolean;
  onTrimIn: (panel: Day1PanelKey, ms: number) => void;
  onTrimOut: (panel: Day1PanelKey, ms: number) => void;
  onTransform: (
    panel: Day1PanelKey,
    patch: Partial<Omit<MediaTransform, 'fit'>>,
  ) => void;
  onResetTransform: (panel: Day1PanelKey) => void;
  onToggleRatioOverride: (panel: Day1PanelKey, enabled: boolean) => void;
  onSplit: (patch: Partial<Day1Settings['split']>) => void;
  onLabelStyle: (patch: Partial<Day1Settings['labelStyle']>) => void;
  onLabelText: (locale: Locale, panel: ActivePanel, value: string) => void;
  onEndCard: (patch: Day1EndCardPatch) => void;
  onEndCardAsset: (slot: Day1EndCardSlot, file: File | null) => void;
  resolveEndCardUrl: (slot: Day1EndCardSlot) => string | null;
}

const PanelSection = ({
  disabled,
  durationMs,
  hasOverride,
  panel,
  ratio,
  settings,
  transform,
  onResetTransform,
  onToggleRatioOverride,
  onTransform,
  onTrimIn,
  onTrimOut,
}: {
  disabled: boolean;
  durationMs: number;
  hasOverride: boolean;
  panel: Day1PanelKey;
  ratio: AspectRatio;
  settings: Day1Settings;
  transform: MediaTransform;
  onResetTransform: () => void;
  onToggleRatioOverride: (enabled: boolean) => void;
  onTransform: (patch: Partial<Omit<MediaTransform, 'fit'>>) => void;
  onTrimIn: (ms: number) => void;
  onTrimOut: (ms: number) => void;
}) => {
  const key = PANEL_TEST_KEY[panel];
  const {source, trim} = settings[panel];
  const sourceMs = source?.durationMs ?? 0;
  const controlsDisabled = disabled || sourceMs <= 0;

  return (
    <InspectorSection
      badge={hasOverride ? `${ratio} 전용` : `${formatSeconds(durationMs)}s`}
      defaultOpen
      id={`day1-panel-${key}`}
      title={PANEL_TITLES[panel]}
    >
      {sourceMs > 0 ? null : (
        <p className="notice notice--warning">
          이 패널의 영상을 올리면 Trim과 프레이밍을 조절할 수 있습니다.
        </p>
      )}

      <SecondsField
        disabled={controlsDisabled}
        label="Trim In (초)"
        max={sourceMs}
        min={0}
        onCommit={onTrimIn}
        testId={`day1-${key}-trim-in`}
        valueMs={trim.inMs}
      />
      <SecondsField
        disabled={controlsDisabled}
        label="Trim Out (초)"
        max={sourceMs}
        min={0}
        onCommit={onTrimOut}
        testId={`day1-${key}-trim-out`}
        valueMs={trim.outMs}
      />
      <p className="panel__hint" data-testid={`day1-${key}-trim-range`}>
        소스 구간 {formatSeconds(trim.inMs)}s – {formatSeconds(trim.outMs)}s · 구간{' '}
        {formatSeconds(durationMs)}s
        {sourceMs > 0 ? ` · 원본 ${formatSeconds(sourceMs)}s` : ''}
      </p>

      <p className="panel__hint">Fit · Cover 고정</p>
      <label className="field field--toggle">
        <input
          checked={hasOverride}
          data-testid={`day1-${key}-ratio-override`}
          disabled={controlsDisabled}
          onChange={(event) => onToggleRatioOverride(event.target.checked)}
          type="checkbox"
        />
        <span>{ratio} 전용 프레이밍 사용</span>
      </label>
      <PercentField
        disabled={controlsDisabled}
        label="Scale"
        max={MAX_SCALE}
        min={MIN_SCALE}
        onChange={(scale) => onTransform({scale})}
        step={0.01}
        testId={`day1-${key}-scale`}
        value={transform.scale}
      />
      <PlainField
        disabled={controlsDisabled}
        label="X"
        max={MAX_OFFSET_PERCENT}
        min={-MAX_OFFSET_PERCENT}
        onChange={(x) => onTransform({x})}
        step={1}
        suffix="%"
        testId={`day1-${key}-x`}
        value={transform.x}
      />
      <PlainField
        disabled={controlsDisabled}
        label="Y"
        max={MAX_OFFSET_PERCENT}
        min={-MAX_OFFSET_PERCENT}
        onChange={(y) => onTransform({y})}
        step={1}
        suffix="%"
        testId={`day1-${key}-y`}
        value={transform.y}
      />
      <button
        className="button button--secondary"
        disabled={controlsDisabled}
        onClick={onResetTransform}
        type="button"
      >
        프레이밍 초기화
      </button>
    </InspectorSection>
  );
};

export const Day1Inspector = ({
  settings,
  copy,
  ratio,
  panelDurationsMs,
  activeTransformOf,
  hasRatioOverride,
  disabled,
  onTrimIn,
  onTrimOut,
  onTransform,
  onResetTransform,
  onToggleRatioOverride,
  onSplit,
  onLabelStyle,
  onLabelText,
  onEndCard,
  onEndCardAsset,
  resolveEndCardUrl,
}: Day1InspectorProps) => {
  const {endCard, labelStyle, split} = settings;
  const endCardAssetCount = (['banner', 'appIcon'] as Day1EndCardSlot[]).filter(
    (slot) => endCard[slot] !== null,
  ).length;

  return (
    <aside aria-label="Day1 속성" className="inspector">
      <div className="inspector__head">
        <h2>Day1 속성</h2>
        <span className="inspector__scene" data-testid="inspector-template">
          Day1 비교
        </span>
      </div>

      <div className="inspector__body">
        {(['panelA', 'panelB'] as Day1PanelKey[]).map((panel) => (
          <PanelSection
            disabled={disabled}
            durationMs={panelDurationsMs[panel]}
            hasOverride={hasRatioOverride(panel)}
            key={panel}
            onResetTransform={() => onResetTransform(panel)}
            onToggleRatioOverride={(enabled) =>
              onToggleRatioOverride(panel, enabled)
            }
            onTransform={(patch) => onTransform(panel, patch)}
            onTrimIn={(ms) => onTrimIn(panel, ms)}
            onTrimOut={(ms) => onTrimOut(panel, ms)}
            panel={panel}
            ratio={ratio}
            settings={settings}
            transform={activeTransformOf(panel)}
          />
        ))}

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
                {(['a', 'b'] as ActivePanel[]).map((panel) => (
                  <input
                    aria-label={`${LOCALE_LABELS[locale]} 패널 ${panel.toUpperCase()} 라벨`}
                    data-testid={`day1-label-${locale}-${panel}`}
                    disabled={disabled}
                    key={panel}
                    onChange={(event) =>
                      onLabelText(locale, panel, event.target.value)
                    }
                    placeholder={panel === 'a' ? 'DAY 1' : 'DAY 30'}
                    type="text"
                    value={(copy[locale] as LocalizedCopy).day1Labels?.[panel] ?? ''}
                  />
                ))}
              </div>
            </div>
          ))}
          <p className="panel__hint">
            왼쪽이 패널 A, 오른쪽이 패널 B입니다. 렌더에는 헤더에서 고른 언어의
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
        </InspectorSection>

        <InspectorSection
          badge={`에셋 ${endCardAssetCount}/2`}
          id="day1-endcard"
          title="엔드카드"
        >
          {endCard.banner ? null : (
            <p className="notice notice--warning" data-testid="day1-banner-missing">
              배너를 올리지 않으면 마지막 구간이 빈 화면으로 렌더됩니다. 렌더 자체는
              막지 않습니다.
            </p>
          )}

          {(['banner', 'appIcon'] as Day1EndCardSlot[]).map((slot) => (
            <AssetField
              disabled={disabled}
              inputTestId={`day1-endcard-${slot}`}
              key={slot}
              kind="image"
              label={END_CARD_LABELS[slot]}
              name={(endCard[slot] as MediaReference | null)?.name ?? null}
              onPick={(file) => onEndCardAsset(slot, file)}
              previewUrl={resolveEndCardUrl(slot)}
            />
          ))}

          <div aria-label="아이콘 애니메이션" className="segmented" role="group">
            {DAY1_ICON_ANIMATIONS.map((preset) => (
              <button
                aria-pressed={endCard.iconAnimation === preset}
                className={`segmented__item${
                  endCard.iconAnimation === preset ? ' segmented__item--on' : ''
                }`}
                data-testid={`day1-icon-animation-${preset}`}
                disabled={disabled}
                key={preset}
                onClick={() => onEndCard({iconAnimation: preset})}
                type="button"
              >
                {ICON_ANIMATION_LABELS[preset]}
              </button>
            ))}
          </div>
          <div aria-label="카드 모션" className="segmented" role="group">
            {DAY1_CARD_MOTIONS.map((motion) => (
              <button
                aria-pressed={endCard.cardMotion === motion}
                className={`segmented__item${
                  endCard.cardMotion === motion ? ' segmented__item--on' : ''
                }`}
                data-testid={`day1-card-motion-${motion}`}
                disabled={disabled}
                key={motion}
                onClick={() => onEndCard({cardMotion: motion})}
                type="button"
              >
                {CARD_MOTION_LABELS[motion]}
              </button>
            ))}
          </div>

          {/* Every ratio has bannerdesigner coordinates since its v1.18 added the
              app-badge 16:9 layout, so there is no manual-placement case left. */}
          <p className="panel__hint">
            아이콘은 {ratio} 배너의 아이콘 좌표에 자동 배치됩니다. 어긋나면 아래에서
            미세조정하세요.
          </p>

          <PlainField
            disabled={disabled}
            displayStep={0.01}
            label="X 미세조정"
            max={MAX_ICON_ADJUST}
            min={-MAX_ICON_ADJUST}
            onChange={(dx) => onEndCard({iconAdjust: {dx}})}
            step={0.005}
            suffix=""
            testId="day1-icon-dx"
            value={endCard.iconAdjust.dx}
          />
          <PlainField
            disabled={disabled}
            displayStep={0.01}
            label="Y 미세조정"
            max={MAX_ICON_ADJUST}
            min={-MAX_ICON_ADJUST}
            onChange={(dy) => onEndCard({iconAdjust: {dy}})}
            step={0.005}
            suffix=""
            testId="day1-icon-dy"
            value={endCard.iconAdjust.dy}
          />
          <PercentField
            disabled={disabled}
            label="아이콘 크기"
            max={MAX_ICON_SCALE}
            min={MIN_ICON_SCALE}
            onChange={(scale) => onEndCard({iconAdjust: {scale}})}
            step={0.01}
            testId="day1-icon-scale"
            value={endCard.iconAdjust.scale}
          />
          <button
            className="button button--secondary"
            disabled={disabled}
            onClick={() => onEndCard({iconAdjust: {dx: 0, dy: 0, scale: 1}})}
            type="button"
          >
            아이콘 위치 초기화
          </button>
          <p className="panel__hint">
            배너에 아이콘이 이미 구워져 있어 100% 아래로 줄이면 밑이 드러납니다.
          </p>
        </InspectorSection>
      </div>
    </aside>
  );
};
