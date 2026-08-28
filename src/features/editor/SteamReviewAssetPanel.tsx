// steam-review Design Ref: §9 — the store page's uploads: ① the shared
// gameplay video plus four collapsible per-locale replacement slots (Plan Q4),
// ② the one landscape key art (Plan Q3·Q7), ③ the four thumbnails (Plan Q10).
import {
  LOCALES,
  STEAM_REVIEW_THUMBNAIL_COUNT,
  type Locale,
  type MediaReference,
  type SteamReviewSettings,
} from '../../domain/editor/types';
import type {AppError} from '../../shared/errors/appError';
import {LOCALE_LABELS} from './CopyPanel';
import {Dropzone} from './Dropzone';

const THUMBNAIL_SLOTS = Array.from(
  {length: STEAM_REVIEW_THUMBNAIL_COUNT},
  (_, index) => index,
);

/** The reference/session states a slot can be in, worded once. */
const UnresolvedNotice = ({
  reference,
  url,
  canGrant,
  busy,
  disabled,
  testIdPrefix,
  onGrant,
}: {
  reference: MediaReference | null;
  url: string | null;
  canGrant: boolean;
  busy: boolean;
  disabled: boolean;
  testIdPrefix: string;
  onGrant: (mediaId: string) => void;
}) =>
  reference && url === null ? (
    <div data-testid={`${testIdPrefix}-reupload`}>
      <p className="notice notice--warning">
        {canGrant
          ? '저장된 파일 접근 권한이 만료되었습니다. 권한을 허용하거나 같은 파일을 다시 올려주세요.'
          : '파일을 다시 올려주세요.'}{' '}
        기대 파일: {reference.name}
      </p>
      {canGrant ? (
        <button
          className="button button--secondary"
          data-testid={`${testIdPrefix}-grant`}
          disabled={disabled || busy}
          onClick={() => onGrant(reference.id)}
          type="button"
        >
          저장된 파일 권한 허용
        </button>
      ) : null}
    </div>
  ) : null;

export interface SteamReviewAssetPanelProps {
  settings: SteamReviewSettings;
  disabled: boolean;
  busy: boolean;
  uploadError: AppError | null;
  autosaveError: AppError | null;
  supportsFilePicker: boolean;
  urlFor: (reference: MediaReference | null | undefined) => string | null;
  canGrantPermission: (reference: MediaReference | null) => boolean;
  onUploadSource: (file: File | null) => void;
  onPickSource: () => void;
  onUploadLocaleSource: (locale: Locale, file: File | null) => void;
  onPickLocaleSource: (locale: Locale) => void;
  onUploadKeyArt: (file: File | null) => void;
  onPickKeyArt: () => void;
  onUploadThumbnail: (index: number, file: File | null) => void;
  onPickThumbnail: (index: number) => void;
  onGrantPermission: (mediaId: string) => void;
}

export const SteamReviewAssetPanel = ({
  settings,
  disabled,
  busy,
  uploadError,
  autosaveError,
  supportsFilePicker,
  urlFor,
  canGrantPermission,
  onUploadSource,
  onPickSource,
  onUploadLocaleSource,
  onPickLocaleSource,
  onUploadKeyArt,
  onPickKeyArt,
  onUploadThumbnail,
  onPickThumbnail,
  onGrantPermission,
}: SteamReviewAssetPanelProps) => {
  const pickerButton = (testId: string, onPick: () => void) =>
    supportsFilePicker ? (
      <button
        className="button button--secondary"
        data-testid={testId}
        disabled={disabled}
        onClick={onPick}
        type="button"
      >
        파일 선택 (다음 실행에서도 복구)
      </button>
    ) : null;

  return (
    <>
      <div className="panel__group">
        <h3 className="panel__subtitle">게임플레이 영상 (공통)</h3>
        <Dropzone
          disabled={disabled}
          fileName={settings.source?.name ?? null}
          hint="영상을 끌어다 놓거나 클릭해 선택"
          inputTestId="steam-source-input"
          kind="video"
          onFile={(file) => onUploadSource(file)}
          onRemove={() => onUploadSource(null)}
          previewUrl={urlFor(settings.source)}
          prompt="게임플레이 영상"
        />
        {pickerButton('steam-source-picker', onPickSource)}
        <UnresolvedNotice
          busy={busy}
          canGrant={canGrantPermission(settings.source)}
          disabled={disabled}
          onGrant={onGrantPermission}
          reference={settings.source}
          testIdPrefix="steam-source"
          url={urlFor(settings.source)}
        />
        <p className="panel__hint">
          모든 언어가 이 영상을 씁니다. 언어별로 다른 소스가 필요할 때만 아래
          교체 슬롯을 채우세요.
        </p>
      </div>

      {/* Plan Q4 — the KR loot-box-subtitled cut is the real-world case. */}
      <details className="panel__group" data-testid="steam-locale-sources">
        <summary className="panel__subtitle">언어별 교체 영상</summary>
        {LOCALES.map((locale) => {
          const reference = settings.localeSources[locale] ?? null;

          return (
            <section
              className="panel__group"
              data-testid={`steam-locale-${locale}`}
              key={locale}
            >
              <h4 className="panel__subtitle">
                {LOCALE_LABELS[locale]}
                {reference ? '' : ' — 공통 사용'}
              </h4>
              <Dropzone
                disabled={disabled}
                fileName={reference?.name ?? null}
                hint="비워 두면 공통 영상을 씁니다"
                inputTestId={`steam-locale-${locale}-input`}
                kind="video"
                onFile={(file) => onUploadLocaleSource(locale, file)}
                onRemove={() => onUploadLocaleSource(locale, null)}
                previewUrl={urlFor(reference)}
                prompt={`${LOCALE_LABELS[locale]} 교체 영상`}
              />
              {pickerButton(`steam-locale-${locale}-picker`, () =>
                onPickLocaleSource(locale),
              )}
              <UnresolvedNotice
                busy={busy}
                canGrant={canGrantPermission(reference)}
                disabled={disabled}
                onGrant={onGrantPermission}
                reference={reference}
                testIdPrefix={`steam-locale-${locale}`}
                url={urlFor(reference)}
              />
            </section>
          );
        })}
      </details>

      <div className="panel__group">
        <h3 className="panel__subtitle">키아트</h3>
        <Dropzone
          disabled={disabled}
          fileName={settings.keyArt.image?.name ?? null}
          hint="가로형 1200×628 이상 권장"
          inputTestId="steam-keyart-input"
          kind="image"
          onFile={(file) => onUploadKeyArt(file)}
          onRemove={() => onUploadKeyArt(null)}
          previewUrl={urlFor(settings.keyArt.image)}
          prompt="키아트 이미지"
        />
        {pickerButton('steam-keyart-picker', onPickKeyArt)}
        <UnresolvedNotice
          busy={busy}
          canGrant={canGrantPermission(settings.keyArt.image)}
          disabled={disabled}
          onGrant={onGrantPermission}
          reference={settings.keyArt.image}
          testIdPrefix="steam-keyart"
          url={urlFor(settings.keyArt.image)}
        />
        <p className="panel__hint">
          16:9 사이드바와 9:16 상단 배너 두 자리에 쓰입니다. 1:1만 렌더할 때는
          없어도 됩니다.
        </p>
      </div>

      <div className="panel__group">
        <h3 className="panel__subtitle">썸네일 4장</h3>
        {THUMBNAIL_SLOTS.map((index) => {
          const reference = settings.thumbnails[index] ?? null;

          return (
            <section
              className="panel__group"
              data-testid={`steam-thumb-${index}`}
              key={index}
            >
              <Dropzone
                disabled={disabled}
                fileName={reference?.name ?? null}
                hint="이미지를 끌어다 놓거나 클릭해 선택"
                inputTestId={`steam-thumb-${index}-input`}
                kind="image"
                onFile={(file) => onUploadThumbnail(index, file)}
                onRemove={() => onUploadThumbnail(index, null)}
                previewUrl={urlFor(reference)}
                prompt={`썸네일 ${index + 1}`}
              />
              {pickerButton(`steam-thumb-${index}-picker`, () =>
                onPickThumbnail(index),
              )}
              <UnresolvedNotice
                busy={busy}
                canGrant={canGrantPermission(reference)}
                disabled={disabled}
                onGrant={onGrantPermission}
                reference={reference}
                testIdPrefix={`steam-thumb-${index}`}
                url={urlFor(reference)}
              />
            </section>
          );
        })}
        <p className="panel__hint">
          가로 4장 · 세로 3장이 노출되고 1:1에는 나오지 않습니다. 16:9·9:16
          렌더에는 4장이 모두 필요합니다.
        </p>
      </div>

      {supportsFilePicker ? (
        <p className="panel__hint">
          “파일 선택”으로 올린 파일은 접근 권한이 저장되어 새로고침 후에도 다시
          연결됩니다. 끌어다 놓은 파일은 권한이 없어 다시 올려야 합니다.
        </p>
      ) : null}

      {busy ? <p className="panel__hint">확인 중…</p> : null}

      {uploadError ? (
        <p className="notice notice--error" data-testid="steam-upload-error">
          {uploadError.message}
        </p>
      ) : null}

      {autosaveError ? (
        <p className="notice notice--error" data-testid="autosave-error">
          {autosaveError.message}
        </p>
      ) : null}
    </>
  );
};
