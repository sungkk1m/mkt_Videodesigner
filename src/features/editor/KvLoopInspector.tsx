// key-visual-looping Design Ref: §6.3 — the selected key visual's framing and
// motion, the loop-wide motion values, and the two optional overlays.
import {
  MAX_OFFSET_PERCENT,
  MAX_SCALE,
  MAX_SUBTITLE_FONT_SIZE,
  MAX_TRANSITION_MS,
  MIN_SCALE,
  MIN_SUBTITLE_FONT_SIZE,
  MIN_TRANSITION_MS,
  type KvLoopSettings,
  type Locale,
  type MediaReference,
  type MediaTransform,
} from '../../domain/editor/types';
import {LOCALE_LABELS} from './CopyPanel';
import {AssetField, PercentField, PlainField} from './inspectorFields';

export interface KvLoopInspectorProps {
  settings: KvLoopSettings;
  /** Which key visual the timeline has selected. */
  index: number;
  locale: Locale;
  titleReference: MediaReference | null;
  titleInheritedFrom: Locale | null;
  titleUrl: string | null;
  supportsFilePicker: boolean;
  titleCanGrantPermission: boolean;
  disabled: boolean;
  onTransform: (patch: Partial<MediaTransform>) => void;
  onResetTransform: () => void;
  onKenBurns: (enabled: boolean) => void;
  onLoop: (
    patch: Partial<{
      kenBurnsIntensity: number;
      transitionMs: number;
      fadeOutMs: number;
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
  titleReference,
  titleInheritedFrom,
  titleUrl,
  supportsFilePicker,
  titleCanGrantPermission,
  disabled,
  onTransform,
  onResetTransform,
  onKenBurns,
  onLoop,
  onTitleImage,
  onPickTitle,
  onTitleGrantPermission,
  onTitleTransform,
  onDisclaimerStyle,
}: KvLoopInspectorProps) => {
  const slot = settings.slots[index];

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

          {/* FR-L09 — per key visual, because one busy illustration can be worth
              holding still while the rest push in. */}
          <label className="field field--toggle">
            <input
              checked={slot.kenBurns}
              data-testid="kv-ken-burns"
              disabled={disabled}
              onChange={(event) => onKenBurns(event.target.checked)}
              type="checkbox"
            />
            <span>이 KV에 Ken Burns 적용</span>
          </label>
        </section>
      ) : null}

      <section className="panel__group" data-testid="kv-inspector-motion">
        <h3 className="panel__subtitle">모션 · 전환</h3>

        <PercentField
          disabled={disabled}
          label="Ken Burns 강도"
          max={1}
          min={0}
          onChange={(kenBurnsIntensity) => onLoop({kenBurnsIntensity})}
          step={0.01}
          testId="kv-ken-burns-intensity"
          value={settings.kenBurnsIntensity}
        />
        <PlainField
          disabled={disabled}
          label="크로스페이드"
          max={MAX_TRANSITION_MS}
          min={MIN_TRANSITION_MS}
          onChange={(transitionMs) => onLoop({transitionMs})}
          step={50}
          suffix="ms"
          testId="kv-transition"
          value={settings.transitionMs}
        />
        {/* FR-L17 — zero turns the closing fade off. */}
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
