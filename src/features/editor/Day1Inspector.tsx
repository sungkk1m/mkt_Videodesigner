// Day1 Design Ref: §6.3 Day1 인스펙터 — panel A/B framing, the split line with an
// eyedropper, the four-locale panel labels with their styling, and the end card.
// Reuses the three-scene accordion and field primitives so both inspectors feel
// identical to operate.
import type {Day1PanelKey} from '../../domain/editor/project';
import {
  DAY1_CARD_MOTIONS,
  DAY1_END_CARD_MODES,
  DAY1_ICON_ANIMATIONS,
  LOCALES,
  MAX_ICON_ADJUST,
  MAX_ICON_SCALE,
  MAX_LABEL_OUTLINE_WIDTH_PX,
  MAX_OFFSET_PERCENT,
  MAX_SCALE,
  MAX_SPLIT_LINE_WIDTH_PX,
  MAX_SUBTITLE_FONT_SIZE,
  MEDIA_FITS,
  MIN_ICON_SCALE,
  MIN_SCALE,
  MIN_SUBTITLE_FONT_SIZE,
  SUBTITLE_POSITIONS,
  type ActivePanel,
  type AspectRatio,
  type Day1CardMotion,
  type Day1EndCardMode,
  type Day1IconAnimation,
  type Day1Settings,
  type Locale,
  type LocalizedCopy,
  type MediaFit,
  type MediaReference,
  type MediaTransform,
  type SubtitleStyle,
} from '../../domain/editor/types';
import {
  DAY1_END_CARD_MS,
  MIN_END_CARD_TRIM_MS,
} from '../../domain/day1/playback';
import {splitLayout} from '../../domain/day1/layout';
import {ColorField} from './ColorField';
import {InspectorSection} from './InspectorSection';
import {TrimStrip} from './TrimStrip';
import type {Day1EndCardPatch} from '../../domain/editor/project';
import type {Day1EndCardSlot} from './useDay1Assets';
import type {FrameSampler} from '../../domain/ports';
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

/** Narrowed to the `SplitLayout` keys so a panel can look its own rect up. */
const PANEL_TEST_KEY: Record<Day1PanelKey, 'a' | 'b'> = {
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
  video: '엔드카드 영상',
};

/** day1-video — what each fit does to a source that is not the panel's shape. */
const FIT_LABELS: Record<MediaFit, string> = {
  cover: '꽉 채우기',
  contain: '전체 보기',
};

const END_CARD_MODE_LABELS: Record<Day1EndCardMode, string> = {
  banner: '배너+아이콘',
  video: '영상',
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
  onLabelText: (locale: Locale, panel: ActivePanel, value: string) => void;
  onEndCard: (patch: Day1EndCardPatch) => void;
  onEndCardAsset: (slot: Day1EndCardSlot, file: File | null) => void;
  /** Endcard-Video FR-07 — trim moves only through the reconciling command. */
  onEndCardTrimIn: (ms: number) => void;
  /** day1-trim-preview FR-05 — window length, same reconciliation rule. */
  onEndCardTrimLength: (ms: number) => void;
  resolveEndCardUrl: (slot: Day1EndCardSlot) => string | null;
}

const PanelSection = ({
  disabled,
  durationMs,
  frameSampler,
  hasOverride,
  panel,
  ratio,
  settings,
  transform,
  url,
  onResetTransform,
  onToggleRatioOverride,
  onTransform,
  onTrimIn,
}: {
  disabled: boolean;
  durationMs: number;
  frameSampler: FrameSampler;
  hasOverride: boolean;
  panel: Day1PanelKey;
  ratio: AspectRatio;
  settings: Day1Settings;
  transform: MediaTransform;
  /** Session URL of this panel's video, or null while it is unresolved. */
  url: string | null;
  onResetTransform: () => void;
  onToggleRatioOverride: (enabled: boolean) => void;
  onTransform: (patch: Partial<MediaTransform>) => void;
  onTrimIn: (ms: number) => void;
}) => {
  const key = PANEL_TEST_KEY[panel];
  const {source, trim} = settings[panel];
  // day1-video — the panel's own slot in the output, so the strip's preview can
  // show the crop the render will make instead of the whole source. Half of a
  // 9:16 frame is landscape, which is why letterboxing a portrait source into a
  // 16:9 box left most of the box black.
  const rect = splitLayout(ratio, settings.split.lineWidthPx)[key];
  const sourceMs = source?.durationMs ?? 0;
  const controlsDisabled = disabled || sourceMs <= 0;
  // FR-S02. Mirrors `day1PanelsShorterThanSection`, which the render gate uses.
  const isShortSource = sourceMs > 0 && sourceMs < durationMs;

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

      {/* Day1 Trim UX FR-T01, FR-T02 — pick the interval by looking at it. */}
      <TrimStrip
        backdrop={transform.fit === 'contain'}
        disabled={controlsDisabled}
        framing={{aspectRatio: rect.width / rect.height, transform}}
        inMs={trim.inMs}
        onCommit={onTrimIn}
        sampler={frameSampler}
        sectionDurationMs={durationMs}
        sourceDurationMs={sourceMs}
        sourceId={source?.id ?? null}
        testIdPrefix={`day1-${key}`}
        url={url}
      />

      {/* Day1 Trim UX FR-T06 — kept alongside the strip, sharing `onTrimIn`, so
          the two stay in sync and 0.1s precision survives the strip's pixel
          resolution (Plan §5). */}
      <SecondsField
        disabled={controlsDisabled}
        label="Trim In (초)"
        max={sourceMs}
        min={0}
        onCommit={onTrimIn}
        testId={`day1-${key}-trim-in`}
        valueMs={trim.inMs}
      />
      {/* Day1 Trim UX FR-T07 — `reconcileTrim` derives the out point from the in
          point, so showing it as an input invited edits that were discarded. */}
      <p className="field field--readout">
        <span>
          Trim Out (초)
          <strong data-testid={`day1-${key}-trim-out`}>
            {formatSeconds(trim.outMs)}
          </strong>
        </span>
      </p>
      <p className="panel__hint" data-testid={`day1-${key}-trim-range`}>
        소스 구간 {formatSeconds(trim.inMs)}s – {formatSeconds(trim.outMs)}s · 구간{' '}
        {formatSeconds(durationMs)}s
        {sourceMs > 0 ? ` · 원본 ${formatSeconds(sourceMs)}s` : ''}
      </p>
      {/* Day1 Trim UX FR-S02 — the three-scene inspector has said this since the
          start; Day1 was the one template where it went unsaid. Unlike the
          three-scene wording this names both ways out, because a Day1 section is
          resized by dragging the timeline boundary (Plan SC5). */}
      {isShortSource ? (
        <p className="notice notice--warning" data-testid={`day1-${key}-trim-short`}>
          원본이 구간보다 짧아 남은 시간은 검은 화면으로 출력됩니다. 구간 길이를
          줄이거나 더 긴 영상을 사용하세요.
        </p>
      ) : null}

      {/* day1-video — half of a 9:16 frame is landscape, so a portrait capture
          either loses half its height or keeps all of it against the blurred
          backdrop. That is a per-panel call, not a fixed one. */}
      <p className="field field--readout">
        <span>Fit</span>
      </p>
      <div className="segmented">
        {MEDIA_FITS.map((fit) => (
          <button
            aria-pressed={transform.fit === fit}
            className={`segmented__item${
              transform.fit === fit ? ' segmented__item--on' : ''
            }`}
            data-testid={`day1-${key}-fit-${fit}`}
            disabled={controlsDisabled}
            key={fit}
            onClick={() => onTransform({fit})}
            type="button"
          >
            {FIT_LABELS[fit]}
          </button>
        ))}
      </div>
      <p className="panel__hint">
        {transform.fit === 'cover'
          ? '패널을 꽉 채우고 넘치는 부분은 잘립니다. Y로 어느 부분을 살릴지 고르세요.'
          : '원본을 모두 남기고, 남는 자리는 원본을 흐리게 깐 배경으로 채웁니다. Scale을 올리면 점점 잘립니다.'}
      </p>
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
}: Day1InspectorProps) => {
  const {endCard, labelStyle, split} = settings;
  // day1-trim-preview FR-05 — the chosen window length; {0,0} (no video yet)
  // reads as the full 3s card, mirroring the domain fallback.
  const endCardTrimLenMs =
    endCard.videoTrim.outMs - endCard.videoTrim.inMs || DAY1_END_CARD_MS;
  // Endcard-Video §5.5 — the badge counts the active treatment's assets only.
  const endCardAssetBadge =
    endCard.mode === 'video'
      ? `에셋 ${endCard.video ? 1 : 0}/1`
      : `에셋 ${
          (['banner', 'appIcon'] as const).filter(
            (slot) => endCard[slot] !== null,
          ).length
        }/2`;

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
            ratio={ratio}
            settings={settings}
            transform={activeTransformOf(panel)}
            url={resolvePanelUrl(panel)}
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
          badge={endCardAssetBadge}
          id="day1-endcard"
          title="엔드카드"
        >
          {/* Endcard-Video FR-09 — the two treatments are an either/or; the
              inactive side's settings stay stored, just hidden (D-02). */}
          <div aria-label="엔드카드 방식" className="segmented" role="group">
            {DAY1_END_CARD_MODES.map((mode) => (
              <button
                aria-pressed={endCard.mode === mode}
                className={`segmented__item${
                  endCard.mode === mode ? ' segmented__item--on' : ''
                }`}
                data-testid={`day1-endcard-mode-${mode}`}
                disabled={disabled}
                key={mode}
                onClick={() => onEndCard({mode})}
                type="button"
              >
                {END_CARD_MODE_LABELS[mode]}
              </button>
            ))}
          </div>

          {endCard.mode === 'banner' && !endCard.banner ? (
            <p className="notice notice--warning" data-testid="day1-banner-missing">
              배너를 올리지 않으면 마지막 구간이 빈 화면으로 렌더됩니다. 렌더 자체는
              막지 않습니다.
            </p>
          ) : null}
          {endCard.mode === 'video' && !endCard.video ? (
            <p
              className="notice notice--warning"
              data-testid="day1-endcard-video-missing"
            >
              영상을 올리지 않으면 마지막 구간이 빈 화면으로 렌더됩니다. 렌더 자체는
              막지 않습니다.
            </p>
          ) : null}

          {endCard.mode === 'banner' ? (
            <>
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
                      endCard.iconAnimation === preset
                        ? ' segmented__item--on'
                        : ''
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
            </>
          ) : (
            <>
              <AssetField
                disabled={disabled}
                inputTestId="day1-endcard-video"
                kind="video"
                label={END_CARD_LABELS.video}
                name={endCard.video?.name ?? null}
                onPick={(file) => onEndCardAsset('video', file)}
                previewUrl={null}
              />

              {/* Endcard-Video FR-07 / day1-trim-preview FR-05 — same strip as
                  the panels, at the chosen window length with an out-handle. */}
              <TrimStrip
                disabled={disabled}
                inMs={endCard.videoTrim.inMs}
                maxLengthMs={DAY1_END_CARD_MS}
                minLengthMs={MIN_END_CARD_TRIM_MS}
                onCommit={onEndCardTrimIn}
                onCommitLength={onEndCardTrimLength}
                playbackSlotMs={DAY1_END_CARD_MS}
                sampler={frameSampler}
                sectionDurationMs={endCardTrimLenMs}
                sourceDurationMs={endCard.video?.durationMs ?? 0}
                sourceId={endCard.video?.id ?? null}
                testIdPrefix="day1-endcard"
                url={resolveEndCardUrl('video')}
              />

              {endCard.video ? (
                <p className="panel__hint" data-testid="day1-endcard-trim-range">
                  소스 구간 {formatSeconds(endCard.videoTrim.inMs)}s –{' '}
                  {formatSeconds(endCard.videoTrim.outMs)}s · 구간{' '}
                  {formatSeconds(endCardTrimLenMs)}s · 슬롯{' '}
                  {formatSeconds(DAY1_END_CARD_MS)}s
                </p>
              ) : null}

              {/* day1-endcard-audio FR-01 — the card video's own audio; the
                  panels' audio path is untouched. */}
              <label className="field field--toggle">
                <input
                  checked={endCard.videoAudioEnabled}
                  data-testid="day1-endcard-audio-toggle"
                  disabled={disabled || !endCard.video}
                  onChange={(event) =>
                    onEndCard({videoAudioEnabled: event.target.checked})
                  }
                  type="checkbox"
                />
                <span>영상 오디오 사용 (끝 0.25초 페이드아웃)</span>
              </label>
              <PercentField
                disabled={
                  disabled || !endCard.video || !endCard.videoAudioEnabled
                }
                label="오디오 볼륨"
                max={1}
                min={0}
                onChange={(videoAudioVolume) =>
                  onEndCard({videoAudioVolume})
                }
                step={0.01}
                testId="day1-endcard-audio-volume"
                value={endCard.videoAudioVolume}
              />

              {/* day1-trim-preview FR-06 — a window shorter than the card loops
                  to fill it; the bar shows exactly how the 3s slot is covered. */}
              {endCard.video && endCardTrimLenMs < DAY1_END_CARD_MS ? (
                <>
                  <p
                    className="panel__hint"
                    data-testid="day1-endcard-loop-note"
                  >
                    선택 구간 {formatSeconds(endCardTrimLenMs)}s가 3초보다 짧아
                    3초를 채울 때까지 반복 재생됩니다.
                  </p>
                  <div
                    aria-hidden
                    className="loopfill"
                    data-testid="day1-endcard-loop-fill"
                  >
                    <span
                      className="loopfill__seg"
                      style={{flexGrow: endCardTrimLenMs}}
                    >
                      선택 컷 {formatSeconds(endCardTrimLenMs)}s
                    </span>
                    <span
                      className="loopfill__rest"
                      style={{
                        flexGrow: DAY1_END_CARD_MS - endCardTrimLenMs,
                      }}
                    >
                      루프 {formatSeconds(DAY1_END_CARD_MS - endCardTrimLenMs)}s
                    </span>
                  </div>
                </>
              ) : null}
            </>
          )}

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

          {endCard.mode === 'banner' ? (
            <>
              {/* Every ratio has bannerdesigner coordinates since its v1.18 added
                  the app-badge 16:9 layout, so there is no manual-placement case
                  left. */}
              <p className="panel__hint">
                아이콘은 {ratio} 배너의 아이콘 좌표에 자동 배치됩니다. 어긋나면
                아래에서 미세조정하세요.
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
            </>
          ) : null}
        </InspectorSection>
      </div>
    </aside>
  );
};
