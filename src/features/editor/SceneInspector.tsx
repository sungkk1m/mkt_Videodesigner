// Design Ref: §5.5 Scene Inspector — trim, Cover framing with an optional
// per-ratio override, subtitle styling, transition, and the Hook and CTA
// controls that belong to the selected scene.
import {
  HOOK_MOTION_PRESETS,
  MAX_CTA_BACKGROUND_BLUR,
  MAX_OFFSET_PERCENT,
  MAX_SCALE,
  MAX_SUBTITLE_FONT_SIZE,
  MAX_TRANSITION_MS,
  MIN_SCALE,
  MIN_SUBTITLE_FONT_SIZE,
  MIN_TRANSITION_MS,
  SCENE_LABELS,
  SUBTITLE_ALIGNMENTS,
  SUBTITLE_POSITIONS,
  TRANSITION_KINDS,
  type AspectRatio,
  type CtaSceneSettings,
  type EditorScene,
  type HookSceneSettings,
  type MediaTransform,
  type SceneTransition,
  type SubtitleStyle,
} from '../../domain/editor/types';
import {isSceneShorterThanSection} from '../../domain/editor/project';
import type {FrameSampler} from '../../domain/ports';
import {InspectorSection} from './InspectorSection';
import {
  AssetField,
  PercentField,
  PlainField,
  SecondsField,
  formatSeconds,
} from './inspectorFields';
import {TrimStrip} from './TrimStrip';

export type CtaAssetSlot = 'media' | 'appIcon' | 'logo' | 'storeBadge';

const CTA_ASSET_LABELS: Record<CtaAssetSlot, string> = {
  media: 'CTA 전용 영상',
  appIcon: '앱 아이콘',
  logo: '로고',
  storeBadge: '스토어 배지',
};

const TRANSITION_LABELS: Record<SceneTransition['kind'], string> = {
  cut: 'Cut',
  fade: 'Fade',
  zoom: 'Zoom',
};

const HOOK_PRESET_LABELS: Record<HookSceneSettings['motionPreset'], string> = {
  impact: 'Impact',
  caption: 'Caption',
  focus: 'Focus',
};

const POSITION_LABELS: Record<SubtitleStyle['position'], string> = {
  top: '위',
  center: '가운데',
  bottom: '아래',
};

const ALIGN_LABELS: Record<SubtitleStyle['align'], string> = {
  left: '왼쪽',
  center: '가운데',
  right: '오른쪽',
};

export interface SceneInspectorProps {
  scene: EditorScene;
  /** From the shared section axis, which now owns durations. Day1 Design Ref: §3.1. */
  sceneDurationMs: number;
  ratio: AspectRatio;
  transform: MediaTransform;
  hasRatioOverride: boolean;
  sourceDurationMs: number | null;
  /** Three-Scene Trim Parity FR-P01 — the three scenes share one source. */
  sourceUrl: string | null;
  /** Thumbnail cache key, so switching scenes does not resample. */
  sourceId: string | null;
  frameSampler: FrameSampler;
  disabled: boolean;
  onTrimInMs: (ms: number) => void;
  onTransform: (patch: Partial<Omit<MediaTransform, 'fit'>>) => void;
  onResetTransform: () => void;
  onToggleRatioOverride: (enabled: boolean) => void;
  onSubtitle: (patch: Partial<SubtitleStyle>) => void;
  onTransition: (patch: Partial<SceneTransition>) => void;
  onHook: (patch: Partial<HookSceneSettings>) => void;
  onCta: (patch: Partial<CtaSceneSettings>) => void;
  onCtaAsset: (slot: CtaAssetSlot, file: File | null) => void;
  /** Resolves a CTA asset to its object URL so the dropzone can show a thumbnail. */
  resolveCtaAssetUrl: (slot: CtaAssetSlot) => string | null;
}

export const SceneInspector = ({
  scene,
  sceneDurationMs,
  ratio,
  transform,
  hasRatioOverride,
  sourceDurationMs,
  sourceUrl,
  sourceId,
  frameSampler,
  disabled,
  onTrimInMs,
  onTransform,
  onResetTransform,
  onToggleRatioOverride,
  onSubtitle,
  onTransition,
  onHook,
  onCta,
  onCtaAsset,
  resolveCtaAssetUrl,
}: SceneInspectorProps) => {
  const hasSource = sourceDurationMs !== null && sourceDurationMs > 0;
  const controlsDisabled = disabled || !hasSource;
  // Three-Scene Trim Parity D-D02 — the same predicate the render gate uses, so
  // a warning here always means a block there and never the other way round.
  const shortSource = isSceneShorterThanSection(
    scene,
    sourceDurationMs ?? 0,
    sceneDurationMs,
  );
  const maxTransitionMs = Math.min(
    MAX_TRANSITION_MS,
    Math.floor(sceneDurationMs / 2),
  );

  return (
    <aside aria-label="장면 속성" className="inspector">
      <div className="inspector__head">
        <h2>장면 속성</h2>
        <span className="inspector__scene" data-testid="inspector-scene">
          {SCENE_LABELS[scene.kind]}
        </span>
      </div>

      <div className="inspector__body">
        {hasSource ? null : (
          <p className="notice notice--warning">
            영상을 업로드하면 Trim과 Transform을 조절할 수 있습니다.
          </p>
        )}

        <InspectorSection
          badge={`장면 ${formatSeconds(sceneDurationMs)}s`}
          id="trim"
          defaultOpen
          title="Trim"
        >
          {/* Three-Scene Trim Parity FR-P02 — the strip Day1 already uses, wired
              to the shared source. The window width is this scene's section. */}
          <TrimStrip
            disabled={controlsDisabled}
            inMs={scene.trim.inMs}
            onCommit={onTrimInMs}
            sampler={frameSampler}
            sectionDurationMs={sceneDurationMs}
            sourceDurationMs={sourceDurationMs ?? 0}
            sourceId={sourceId}
            testIdPrefix="scene"
            url={sourceUrl}
          />
          <SecondsField
            disabled={controlsDisabled}
            label="Trim In (초)"
            max={sourceDurationMs ?? 0}
            min={0}
            onCommit={onTrimInMs}
            testId="trim-in"
            valueMs={scene.trim.inMs}
          />
          {/* Three-Scene Trim Parity FR-P05 — `reconcileTrim` derives the out
              point from the in point, so showing it as an input invited edits
              that were silently turned into a window move. */}
          <p className="field field--readout">
            <span>
              Trim Out (초)
              <strong data-testid="trim-out">
                {formatSeconds(scene.trim.outMs)}
              </strong>
            </span>
          </p>
          <p className="panel__hint" data-testid="trim-range">
            소스 구간 {formatSeconds(scene.trim.inMs)}s –{' '}
            {formatSeconds(scene.trim.outMs)}s · 장면{' '}
            {formatSeconds(sceneDurationMs)}s
            {hasSource ? ` · 원본 ${formatSeconds(sourceDurationMs)}s` : ''}
          </p>
          {/* Three-Scene Trim Parity FR-S07 — the render is blocked now, so the
              warning names both ways out rather than only the shorter scene. */}
          {shortSource ? (
            <p
              className="notice notice--warning"
              data-testid="scene-trim-short"
            >
              원본이 장면보다 짧아 남은 시간은 검은 화면으로 출력됩니다. 장면
              길이를 줄이거나 더 긴 영상을 사용하세요.
            </p>
          ) : null}
        </InspectorSection>

        <InspectorSection
          badge={hasRatioOverride ? `${ratio} 전용` : '공통 프레이밍'}
          id="transform"
          defaultOpen
          title="Transform"
        >
          <p className="panel__hint">Fit · Cover 고정</p>
          <label className="field field--toggle">
            <input
              checked={hasRatioOverride}
              data-testid="ratio-override"
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
            testId="transform-scale"
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
            testId="transform-x"
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
            testId="transform-y"
            value={transform.y}
          />
          <button
            className="button button--secondary"
            disabled={controlsDisabled}
            onClick={onResetTransform}
            type="button"
          >
            Transform 초기화
          </button>
        </InspectorSection>

        <InspectorSection
          badge={POSITION_LABELS[scene.subtitle.position]}
          id="subtitle"
          title="자막"
        >
          <label className="field">
            <span>위치</span>
            <select
              data-testid="subtitle-position"
              disabled={disabled}
              onChange={(event) =>
                onSubtitle({
                  position: event.target.value as SubtitleStyle['position'],
                })
              }
              value={scene.subtitle.position}
            >
              {SUBTITLE_POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {POSITION_LABELS[position]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>정렬</span>
            <select
              data-testid="subtitle-align"
              disabled={disabled}
              onChange={(event) =>
                onSubtitle({align: event.target.value as SubtitleStyle['align']})
              }
              value={scene.subtitle.align}
            >
              {SUBTITLE_ALIGNMENTS.map((align) => (
                <option key={align} value={align}>
                  {ALIGN_LABELS[align]}
                </option>
              ))}
            </select>
          </label>
          <PlainField
            disabled={disabled}
            label="크기"
            max={MAX_SUBTITLE_FONT_SIZE}
            min={MIN_SUBTITLE_FONT_SIZE}
            onChange={(fontSize) => onSubtitle({fontSize})}
            step={1}
            suffix="px"
            testId="subtitle-size"
            value={scene.subtitle.fontSize}
          />
          <label className="field field--color">
            <span>글자색</span>
            <input
              data-testid="subtitle-color"
              disabled={disabled}
              onChange={(event) => onSubtitle({textColor: event.target.value})}
              type="color"
              value={scene.subtitle.textColor}
            />
          </label>
          <label className="field field--color">
            <span>강조색</span>
            <input
              data-testid="subtitle-emphasis-color"
              disabled={disabled}
              onChange={(event) =>
                onSubtitle({emphasisColor: event.target.value})
              }
              type="color"
              value={scene.subtitle.emphasisColor}
            />
          </label>
          <label className="field field--toggle">
            <input
              checked={scene.subtitle.showBackground}
              data-testid="subtitle-background"
              disabled={disabled}
              onChange={(event) =>
                onSubtitle({showBackground: event.target.checked})
              }
              type="checkbox"
            />
            <span>배경 사용</span>
          </label>
          {scene.subtitle.showBackground ? (
            <>
              <label className="field field--color">
                <span>배경색</span>
                <input
                  disabled={disabled}
                  onChange={(event) =>
                    onSubtitle({backgroundColor: event.target.value})
                  }
                  type="color"
                  value={scene.subtitle.backgroundColor}
                />
              </label>
              <PercentField
                disabled={disabled}
                label="배경 불투명도"
                max={1}
                min={0}
                onChange={(backgroundOpacity) => onSubtitle({backgroundOpacity})}
                step={0.05}
                testId="subtitle-opacity"
                value={scene.subtitle.backgroundOpacity}
              />
            </>
          ) : null}
        </InspectorSection>

        {scene.kind === 'cta' ? null : (
          <InspectorSection
            badge={TRANSITION_LABELS[scene.transitionOut.kind]}
          id="transition"
            title="전환"
          >
            <div aria-label="전환 종류" className="segmented" role="group">
              {TRANSITION_KINDS.map((kind) => (
                <button
                  aria-pressed={scene.transitionOut.kind === kind}
                  className={`segmented__item${
                    scene.transitionOut.kind === kind
                      ? ' segmented__item--on'
                      : ''
                  }`}
                  data-testid={`transition-${kind}`}
                  disabled={disabled}
                  key={kind}
                  onClick={() => onTransition({kind})}
                  type="button"
                >
                  {TRANSITION_LABELS[kind]}
                </button>
              ))}
            </div>
            {scene.transitionOut.kind === 'cut' ? null : (
              <PlainField
                disabled={disabled}
                displayStep={50}
                label="전환 길이"
                max={maxTransitionMs}
                min={MIN_TRANSITION_MS}
                onChange={(durationMs) => onTransition({durationMs})}
                step={50}
                suffix="ms"
                testId="transition-duration"
                value={scene.transitionOut.durationMs}
              />
            )}
          </InspectorSection>
        )}

        {scene.hook ? (
          <InspectorSection
            badge={HOOK_PRESET_LABELS[scene.hook.motionPreset]}
          id="hook"
            title="Hook 모션"
          >
            <div aria-label="Hook 모션 프리셋" className="segmented" role="group">
              {HOOK_MOTION_PRESETS.map((preset) => (
                <button
                  aria-pressed={scene.hook?.motionPreset === preset}
                  className={`segmented__item${
                    scene.hook?.motionPreset === preset
                      ? ' segmented__item--on'
                      : ''
                  }`}
                  data-testid={`hook-preset-${preset}`}
                  disabled={disabled}
                  key={preset}
                  onClick={() => onHook({motionPreset: preset})}
                  type="button"
                >
                  {HOOK_PRESET_LABELS[preset]}
                </button>
              ))}
            </div>
            <label className="field">
              <span>강조할 문구</span>
              <input
                data-testid="hook-emphasis"
                disabled={disabled}
                onChange={(event) => onHook({emphasizedText: event.target.value})}
                type="text"
                value={scene.hook.emphasizedText}
              />
            </label>
            <label className="field field--toggle">
              <input
                checked={scene.hook.dimBackground}
                data-testid="hook-dim"
                disabled={disabled}
                onChange={(event) =>
                  onHook({dimBackground: event.target.checked})
                }
                type="checkbox"
              />
              <span>배경 어둡게</span>
            </label>
          </InspectorSection>
        ) : null}

        {scene.cta ? (
          <InspectorSection
            badge={`에셋 ${
              (['media', 'appIcon', 'logo', 'storeBadge'] as const).filter(
                (slot) => scene.cta?.[slot],
              ).length
            }/4`}
            id="cta"
            title="CTA"
          >
            {(['media', 'appIcon', 'logo', 'storeBadge'] as const).map((slot) => (
              <AssetField
                disabled={disabled}
                inputTestId={`cta-asset-${slot}`}
                key={slot}
                kind={slot === 'media' ? 'video' : 'image'}
                label={CTA_ASSET_LABELS[slot]}
                name={scene.cta?.[slot]?.name ?? null}
                onPick={(file) => onCtaAsset(slot, file)}
                previewUrl={resolveCtaAssetUrl(slot)}
              />
            ))}
            <label className="field field--toggle">
              <input
                checked={scene.cta.useGeneratedBackground}
                data-testid="cta-generated-background"
                disabled={disabled || scene.cta.media !== null}
                onChange={(event) =>
                  onCta({useGeneratedBackground: event.target.checked})
                }
                type="checkbox"
              />
              <span>마지막 Gameplay 프레임으로 배경 생성</span>
            </label>
            <PlainField
              disabled={disabled}
              label="배경 블러"
              max={MAX_CTA_BACKGROUND_BLUR}
              min={0}
              onChange={(backgroundBlur) => onCta({backgroundBlur})}
              step={1}
              suffix="px"
              testId="cta-blur"
              value={scene.cta.backgroundBlur}
            />
            <PercentField
              disabled={disabled}
              label="배경 어둡게"
              max={1}
              min={0}
              onChange={(backgroundDim) => onCta({backgroundDim})}
              step={0.05}
              testId="cta-dim"
              value={scene.cta.backgroundDim}
            />
          </InspectorSection>
        ) : null}
      </div>
    </aside>
  );
};
