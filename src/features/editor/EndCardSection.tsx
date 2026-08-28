// failure-video Design §4.1-1 — extracted from `Day1Inspector.tsx` as a pure
// move, alongside `PanelSection`. The end card is shared verbatim by every
// panelled template (day1-quad Plan Q7), so its inspector block is too.
// Markup, constants, and test ids are the Day1 ones unchanged; the end-card
// E2E specs are the gate on that.
import {
  DAY1_CARD_MOTIONS,
  DAY1_END_CARD_MODES,
  DAY1_ICON_ANIMATIONS,
  MAX_ICON_ADJUST,
  MAX_ICON_SCALE,
  MIN_ICON_SCALE,
  type AspectRatio,
  type Day1CardMotion,
  type Day1EndCardMode,
  type Day1IconAnimation,
  type Day1Settings,
  type MediaReference,
} from '../../domain/editor/types';
import {MIN_END_CARD_TRIM_MS} from '../../domain/day1/playback';
import {InspectorSection} from './InspectorSection';
import {TrimStrip} from './TrimStrip';
import type {Day1EndCardPatch} from '../../domain/editor/project';
import type {Day1EndCardSlot} from './useDay1Assets';
import type {FrameSampler} from '../../domain/ports';
import {
  AssetField,
  PercentField,
  PlainField,
  formatSeconds,
} from './inspectorFields';

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

const END_CARD_MODE_LABELS: Record<Day1EndCardMode, string> = {
  banner: '배너+아이콘',
  video: '영상',
};

export const EndCardSection = ({
  disabled,
  endCard,
  endCardDurationMs,
  frameSampler,
  ratio,
  onEndCard,
  onEndCardAsset,
  onEndCardTrimIn,
  onEndCardTrimLength,
  resolveEndCardUrl,
}: {
  disabled: boolean;
  endCard: Day1Settings['endCard'];
  /**
   * The end card section's own length. day1-quad Design §4.1 — this used to be
   * the `DAY1_END_CARD_MS` constant, which made the trim slot disagree with a
   * card the operator had dragged longer.
   */
  endCardDurationMs: number;
  frameSampler: FrameSampler;
  ratio: AspectRatio;
  onEndCard: (patch: Day1EndCardPatch) => void;
  onEndCardAsset: (slot: Day1EndCardSlot, file: File | null) => void;
  /** Endcard-Video FR-07 — trim moves only through the reconciling command. */
  onEndCardTrimIn: (ms: number) => void;
  /** day1-trim-preview FR-05 — window length, same reconciliation rule. */
  onEndCardTrimLength: (ms: number) => void;
  resolveEndCardUrl: (slot: Day1EndCardSlot) => string | null;
}) => {
  // day1-trim-preview FR-05 — the chosen window length; {0,0} (no video yet)
  // reads as the whole card, mirroring the domain fallback.
  const endCardTrimLenMs =
    endCard.videoTrim.outMs - endCard.videoTrim.inMs || endCardDurationMs;
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
            maxLengthMs={endCardDurationMs}
            minLengthMs={MIN_END_CARD_TRIM_MS}
            onCommit={onEndCardTrimIn}
            onCommitLength={onEndCardTrimLength}
            playbackSlotMs={endCardDurationMs}
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
              {formatSeconds(endCardDurationMs)}s
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
              to fill it; the bar shows exactly how the slot is covered. */}
          {endCard.video && endCardTrimLenMs < endCardDurationMs ? (
            <>
              <p
                className="panel__hint"
                data-testid="day1-endcard-loop-note"
              >
                선택 구간 {formatSeconds(endCardTrimLenMs)}s가 엔드카드{' '}
                {formatSeconds(endCardDurationMs)}s보다 짧아{' '}
                {formatSeconds(endCardDurationMs)}s를 채울 때까지 반복
                재생됩니다.
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
                    flexGrow: endCardDurationMs - endCardTrimLenMs,
                  }}
                >
                  루프 {formatSeconds(endCardDurationMs - endCardTrimLenMs)}s
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
  );
};
