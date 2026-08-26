// key-visual-looping Design Ref: §6.3 — the selected key visual's framing and
// motion, the loop-wide motion values, and the two optional overlays.
import {
  KV_MOTION_LABELS,
  KV_MOTION_PRESETS,
  MAX_KV_BLUR_PX,
  MAX_OFFSET_PERCENT,
  MAX_SCALE,
  MAX_SUBTITLE_FONT_SIZE,
  MAX_TRANSITION_MS,
  MIN_SCALE,
  MIN_SUBTITLE_FONT_SIZE,
  type KvLoopSettings,
  type KvMotion,
  type KvMotionPreset,
  type Locale,
  type MediaReference,
  type MediaTransform,
} from '../../domain/editor/types';
import {
  effectiveKvMotion,
  resolveKvMotion,
} from '../../domain/kvloop/motion';
import {LOCALE_LABELS} from './CopyPanel';
import {AssetField, PercentField, PlainField} from './inspectorFields';

export interface KvLoopInspectorProps {
  settings: KvLoopSettings;
  /** Which key visual the timeline has selected. */
  index: number;
  locale: Locale;
  /** For the blur hint only — the stored value stays in ms (D-07). */
  fps: number;
  titleReference: MediaReference | null;
  titleInheritedFrom: Locale | null;
  titleUrl: string | null;
  supportsFilePicker: boolean;
  titleCanGrantPermission: boolean;
  disabled: boolean;
  onTransform: (patch: Partial<MediaTransform>) => void;
  onResetTransform: () => void;
  onSlotMotion: (motion: KvMotion | null) => void;
  onDefaultMotion: (motion: KvMotion) => void;
  onLoop: (
    patch: Partial<{
      kenBurnsIntensity: number;
      transitionMs: number;
      fadeOutMs: number;
      roundTrip: boolean;
      blurDurationMs: number;
      blurAmountPx: number;
    }>,
  ) => void;
  onTitleImage: (file: File | null) => void;
  onPickTitle: () => void;
  onTitleGrantPermission: (mediaId: string) => void;
  onTitleTransform: (patch: Partial<MediaTransform>) => void;
  onDisclaimerStyle: (patch: Partial<KvLoopSettings['disclaimer']>) => void;
}

export const KvLoopInspector = ({
  settings,
  index,
  locale,
  fps,
  titleReference,
  titleInheritedFrom,
  titleUrl,
  supportsFilePicker,
  titleCanGrantPermission,
  disabled,
  onTransform,
  onResetTransform,
  onSlotMotion,
  onDefaultMotion,
  onLoop,
  onTitleImage,
  onPickTitle,
  onTitleGrantPermission,
  onTitleTransform,
  onDisclaimerStyle,
}: KvLoopInspectorProps) => {
  const slot = settings.slots[index];
  const effective = effectiveKvMotion(settings, index);
  const customMotion = effective.kind === 'custom';
  const panSelected = settings.slots.some((_, slotIndex) => {
    const motion = effectiveKvMotion(settings, slotIndex);

    return motion.kind === 'preset' && motion.preset.startsWith('pan');
  });
  const defaultPreset =
    settings.motion.kind === 'preset' ? settings.motion.preset : null;

  const motionValue = (motion: KvMotion | null) =>
    motion === null ? 'inherit' : motion.kind === 'custom' ? 'custom' : motion.preset;

  /**
   * Switching to a drawn pair seeds it from the keyframes already on screen, so
   * the rectangles appear where the camera currently is rather than somewhere
   * the operator has to hunt for.
   */
  const readMotion = (value: string): KvMotion | null => {
    if (value === 'inherit') {
      return null;
    }

    if (value === 'custom') {
      const {from, to} = resolveKvMotion(effective, settings.kenBurnsIntensity);

      return {kind: 'custom', from, to};
    }

    return {kind: 'preset', preset: value as KvMotionPreset};
  };

  return (
    <aside aria-label="루핑 인스펙터" className="inspector">
      <div className="inspector__head">
        <h2>KV {index + 1}</h2>
        <span className="inspector__scene" data-testid="inspector-template">
          반복 {settings.loopCount}회 · {settings.slots.length}장
        </span>
      </div>

      <div className="inspector__body">

      {slot ? (
        <section className="panel__group" data-testid="kv-inspector-framing">
          <h3 className="panel__subtitle">프레이밍</h3>

          <p className="panel__hint">
            {slot.transform.fit === 'cover'
              ? '프레임을 꽉 채우고 넘치는 부분은 잘립니다. Y로 어느 부분을 살릴지 고르세요.'
              : '원본을 모두 남기고, 남는 자리는 원본을 흐리게 깐 배경으로 채웁니다.'}
          </p>

          <PercentField
            disabled={disabled}
            label="Scale"
            max={MAX_SCALE}
            min={MIN_SCALE}
            onChange={(scale) => onTransform({scale})}
            step={0.01}
            testId="kv-scale"
            value={slot.transform.scale}
          />
          <PlainField
            disabled={disabled}
            label="X"
            max={MAX_OFFSET_PERCENT}
            min={-MAX_OFFSET_PERCENT}
            onChange={(x) => onTransform({x})}
            step={1}
            suffix="%"
            testId="kv-x"
            value={slot.transform.x}
          />
          <PlainField
            disabled={disabled}
            label="Y"
            max={MAX_OFFSET_PERCENT}
            min={-MAX_OFFSET_PERCENT}
            onChange={(y) => onTransform({y})}
            step={1}
            suffix="%"
            testId="kv-y"
            value={slot.transform.y}
          />

          <button
            className="button button--secondary"
            data-testid="kv-reset-transform"
            disabled={disabled}
            onClick={onResetTransform}
            type="button"
          >
            프레이밍 초기화
          </button>

          {/* FR-M01/FR-M02 — per key visual, because one busy illustration can
              be worth holding still while the rest push in. Inheriting is the
              default so raising the count does not ask for the same choice
              again on every new slot. */}
          <label className="field">
            <span>KV {index + 1} 모션</span>
            <select
              data-testid="kv-slot-motion"
              disabled={disabled}
              onChange={(event) => onSlotMotion(readMotion(event.target.value))}
              value={motionValue(slot.motion)}
            >
              <option value="inherit">
                기본값 따름 (
                {defaultPreset ? KV_MOTION_LABELS[defaultPreset] : '직접 지정'})
              </option>
              {KV_MOTION_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {KV_MOTION_LABELS[preset]}
                </option>
              ))}
              <option value="custom">직접 지정한 영역</option>
            </select>
          </label>

          {customMotion ? (
            <p className="panel__hint" data-testid="kv-motion-custom-hint">
              미리보기 위의 두 사각형이 카메라의 시작·끝입니다. 끌어서 옮기고
              모서리로 크기를 바꾸세요.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="panel__group" data-testid="kv-inspector-motion">
        <h3 className="panel__subtitle">모션 · 전환</h3>

        {/* D-04 — set the loop once; a slot above overrides it. */}
        <label className="field">
          <span>루프 기본 모션</span>
          <select
            data-testid="kv-default-motion"
            disabled={disabled}
            onChange={(event) =>
              onDefaultMotion({
                kind: 'preset',
                preset: event.target.value as KvMotionPreset,
              })
            }
            value={
              settings.motion.kind === 'preset'
                ? settings.motion.preset
                : 'zoomIn'
            }
          >
            {KV_MOTION_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {KV_MOTION_LABELS[preset]}
              </option>
            ))}
          </select>
        </label>

        <PercentField
          disabled={disabled || customMotion}
          label="모션 강도"
          max={1}
          min={0}
          onChange={(kenBurnsIntensity) => onLoop({kenBurnsIntensity})}
          step={0.01}
          testId="kv-ken-burns-intensity"
          value={settings.kenBurnsIntensity}
        />

        {/* I-4 — a drawn pair already says how far the camera goes, so letting
            the slider rescale it would make the preview disagree with the
            drawing. */}
        {customMotion ? (
          <p className="panel__hint" data-testid="kv-motion-strength-note">
            직접 지정한 영역은 강도를 따르지 않습니다. 사각형이 이동 폭입니다.
          </p>
        ) : null}

        {/* §4.1 — at zero there is no room to travel, so a pan is a still. */}
        {settings.kenBurnsIntensity === 0 && panSelected ? (
          <p className="notice notice--warning" data-testid="kv-motion-zero-hint">
            강도가 0이면 팬은 정지와 같습니다. 강도를 올리세요.
          </p>
        ) : null}
        {/* R-1/R-2 — the loop-wide round trip (D-02). The peak is derived, not
            entered: always the exact centre of each hold. */}
        <label className="field field--toggle">
          <input
            checked={settings.roundTrip}
            data-testid="kv-round-trip"
            disabled={disabled}
            onChange={(event) => onLoop({roundTrip: event.target.checked})}
            type="checkbox"
          />
          <span>왕복 — 들어갔다 제자리로</span>
        </label>
        {settings.roundTrip ? (
          <p className="panel__hint" data-testid="kv-round-trip-hint">
            각 장의 정확히 중앙에서 최대가 되고, 끝에서 원위치로 돌아옵니다.
            끝 배율이 시작과 같아 컷이 튀지 않습니다.
          </p>
        ) : null}
        {/* R-3 — zero is a hard cut, the reference's only transition. */}
        <PlainField
          disabled={disabled}
          label="크로스페이드"
          max={MAX_TRANSITION_MS}
          min={0}
          onChange={(transitionMs) => onLoop({transitionMs})}
          step={50}
          suffix="ms"
          testId="kv-transition"
          value={settings.transitionMs}
        />
        {settings.transitionMs === 0 ? (
          <p className="panel__hint" data-testid="kv-cut-hint">
            0은 컷입니다 — 겹침 없이 다음 장으로 바로 끊깁니다.
          </p>
        ) : null}
        {/* FR-L17 — zero turns the closing fade off. New projects open on the
            gaussian bookends below instead (D-06). */}
        <PlainField
          disabled={disabled}
          label="마지막 페이드아웃"
          max={MAX_TRANSITION_MS}
          min={0}
          onChange={(fadeOutMs) => onLoop({fadeOutMs})}
          step={50}
          suffix="ms"
          testId="kv-fade-out"
          value={settings.fadeOutMs}
        />

        {/* R-4/R-5 — the gaussian bookends. One duration for both ends (D-09);
            stored in ms so a 30↔60fps switch keeps the felt length (D-07). */}
        <PlainField
          disabled={disabled}
          label="시작·끝 블러 길이"
          max={MAX_TRANSITION_MS}
          min={0}
          onChange={(blurDurationMs) => onLoop({blurDurationMs})}
          step={1}
          suffix="ms"
          testId="kv-blur-duration"
          value={settings.blur.durationMs}
        />
        <PlainField
          disabled={disabled}
          label="시작·끝 블러 세기"
          max={MAX_KV_BLUR_PX}
          min={0}
          onChange={(blurAmountPx) => onLoop({blurAmountPx})}
          step={1}
          suffix="px"
          testId="kv-blur-amount"
          value={settings.blur.amountPx}
        />
        <p className="panel__hint" data-testid="kv-blur-hint">
          {settings.blur.durationMs > 0 && settings.blur.amountPx > 0
            ? `영상 처음과 끝 ${Math.round((settings.blur.durationMs / 1000) * fps)}프레임(${fps}fps 기준)이 블러에서 열리고 닫힙니다. 0이면 꺼집니다.`
            : '길이나 세기가 0이면 블러 없이 시작하고 끝납니다.'}
        </p>
      </section>

      <section className="panel__group" data-testid="kv-inspector-overlays">
        <h3 className="panel__subtitle">오버레이 (선택)</h3>

        <p className="panel__hint">
          타이틀과 고지문구는 없어도 렌더됩니다. 타이틀이 키비주얼에 이미 박혀
          있으면 비워 두세요.
        </p>

        <AssetField
          disabled={disabled}
          inputTestId="kv-title-input"
          kind="image"
          label={`타이틀 PNG · ${LOCALE_LABELS[locale]}`}
          name={titleReference?.name ?? null}
          onPick={onTitleImage}
          previewUrl={titleUrl}
        />

        {titleInheritedFrom ? (
          <p className="panel__hint" data-testid="kv-title-inherited">
            {LOCALE_LABELS[titleInheritedFrom]} 타이틀을 상속 중입니다.
          </p>
        ) : null}

        {supportsFilePicker ? (
          <button
            className="button button--secondary"
            data-testid="kv-title-picker"
            disabled={disabled}
            onClick={onPickTitle}
            type="button"
          >
            파일 선택 (다음 실행에서도 복구)
          </button>
        ) : null}

        {/* The same restored-project gap the key visual slots have. A warning
            rather than a blocker: Plan L5 keeps the overlays optional, so a
            title nobody re-uploads must not stop the render. */}
        {titleReference && titleUrl === null ? (
          <div data-testid="kv-title-reupload">
            <p className="notice notice--warning">
              {titleCanGrantPermission
                ? '저장된 파일 접근 권한이 만료되었습니다. 권한을 허용하거나 같은 파일을 다시 올려주세요.'
                : '타이틀 이미지를 다시 올려주세요.'}{' '}
              기대 파일: {titleReference.name}
            </p>

            {titleCanGrantPermission ? (
              <button
                className="button button--secondary"
                data-testid="kv-title-grant"
                disabled={disabled}
                onClick={() => onTitleGrantPermission(titleReference.id)}
                type="button"
              >
                저장된 파일 권한 허용
              </button>
            ) : null}
          </div>
        ) : null}

        <PercentField
          disabled={disabled}
          label="타이틀 크기"
          max={MAX_SCALE}
          min={MIN_SCALE}
          onChange={(scale) => onTitleTransform({scale})}
          step={0.01}
          testId="kv-title-scale"
          value={settings.title.transform.scale}
        />
        <PlainField
          disabled={disabled}
          label="타이틀 Y"
          max={MAX_OFFSET_PERCENT}
          min={-MAX_OFFSET_PERCENT}
          onChange={(y) => onTitleTransform({y})}
          step={1}
          suffix="%"
          testId="kv-title-y"
          value={settings.title.transform.y}
        />

        <PlainField
          disabled={disabled}
          label="고지문구 크기"
          max={MAX_SUBTITLE_FONT_SIZE}
          min={MIN_SUBTITLE_FONT_SIZE}
          onChange={(fontSize) => onDisclaimerStyle({fontSize})}
          step={1}
          suffix="px"
          testId="kv-disclaimer-size"
          value={settings.disclaimer.fontSize}
        />
        <label className="field field--color-pick">
          <span>
            고지문구 색<strong>{settings.disclaimer.textColor}</strong>
          </span>
          <input
            data-testid="kv-disclaimer-color"
            disabled={disabled}
            onChange={(event) =>
              onDisclaimerStyle({textColor: event.target.value})
            }
            type="color"
            value={settings.disclaimer.textColor}
          />
        </label>

        <p className="panel__hint">
          문구 자체는 카피 탭에서 언어별로 입력합니다.
        </p>
      </section>
      </div>
    </aside>
  );
};
