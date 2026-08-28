// Day1 Design Ref: §6.2 — panel A and panel B each get a dropzone plus metadata,
// and the render blocker states its reason here rather than only on the header
// button. Plan SC: FR-D03 "Day1은 영상 2개를 받으며, 둘 다 없으면 렌더를 차단한다".
import type {Day1PanelKey} from '../../domain/editor/project';
import type {
  MediaReference,
} from '../../domain/editor/types';
import type {RelinkVerdict} from '../../domain/media/relink';
import type {AppError} from '../../shared/errors/appError';
import {Dropzone} from './Dropzone';
import {SourceRepair} from './SourceRepair';

const PANEL_LABELS: Record<Day1PanelKey, string> = {
  panelA: '패널 A · 먼저 재생',
  panelB: '패널 B · 두 번째',
  panelC: '패널 C · 세 번째',
  panelD: '패널 D · 마지막',
};

const PANEL_TEST_KEY: Record<Day1PanelKey, string> = {
  panelA: 'a',
  panelB: 'b',
  panelC: 'c',
  panelD: 'd',
};

export interface Day1AssetPanelProps {
  /**
   * day1-quad Design §7.1 — the panel keys this template has, in order. Two for
   * Day1, four for Day1-quad. The block below is otherwise identical.
   */
  panels: readonly Day1PanelKey[];
  /**
   * failure-video Design §7.3 — heading per panel. Defaults to the Day1 wording,
   * so the two panelled templates render exactly what they did.
   */
  panelLabels?: Record<Day1PanelKey, string>;
  /** Test id and dropzone prefix, for the same reason. */
  testIdPrefix?: string;
  /** Resolves a panel off the project, so this component never indexes the payload. */
  panelSource: (panel: Day1PanelKey) => MediaReference | null;
  disabled: boolean;
  busy: boolean;
  uploadError: AppError | null;
  relinkVerdict: RelinkVerdict | null;
  /** Panels with no video at all. A non-empty list blocks the render (FR-D03). */
  missingPanels: Day1PanelKey[];
  autosaveError: AppError | null;
  supportsFilePicker: boolean;
  panelUrl: (panel: Day1PanelKey) => string | null;
  canGrantPermission: (panel: Day1PanelKey) => boolean;
  onUpload: (panel: Day1PanelKey, file: File) => void;
  onPickFile: (panel: Day1PanelKey) => void;
  onRelink: (panel: Day1PanelKey, file: File) => void;
  onGrantPermission: (panel: Day1PanelKey) => void;
}

const PanelBlock = ({
  disabled,
  busy,
  canGrantPermission,
  label,
  panel,
  relinkVerdict,
  source,
  supportsFilePicker,
  testIdPrefix,
  uploadError,
  url,
  onUpload,
  onPickFile,
  onRelink,
  onGrantPermission,
}: {
  disabled: boolean;
  busy: boolean;
  canGrantPermission: boolean;
  label: string;
  panel: Day1PanelKey;
  relinkVerdict: RelinkVerdict | null;
  source: MediaReference | null;
  supportsFilePicker: boolean;
  testIdPrefix: string;
  uploadError: AppError | null;
  url: string | null;
  onUpload: (file: File) => void;
  onPickFile: () => void;
  onRelink: (file: File) => void;
  onGrantPermission: () => void;
}) => {
  const key = PANEL_TEST_KEY[panel];

  return (
    <section className="panel__group" data-testid={`${testIdPrefix}-${key}`}>
      <h3 className="panel__subtitle">{label}</h3>

      <Dropzone
        disabled={disabled}
        fileName={source?.name ?? null}
        hint="영상을 끌어다 놓거나 클릭해 선택"
        inputTestId={`${testIdPrefix}-${key}-input`}
        kind="video"
        onFile={onUpload}
        previewUrl={url}
        prompt={`패널 ${key.toUpperCase()} 영상`}
      />

      {supportsFilePicker ? (
        <button
          className="button button--secondary"
          data-testid={`${testIdPrefix}-${key}-picker`}
          disabled={disabled}
          onClick={onPickFile}
          type="button"
        >
          파일 선택 (다음 실행에서도 복구)
        </button>
      ) : null}

      {source ? (
        <dl className="metadata" data-testid={`${testIdPrefix}-${key}-metadata`}>
          <div>
            <dt>이름</dt>
            <dd>{source.name}</dd>
          </div>
          <div>
            <dt>길이</dt>
            <dd>{((source.durationMs ?? 0) / 1000).toFixed(2)}초</dd>
          </div>
          <div>
            <dt>해상도</dt>
            <dd>
              {source.width ?? '-'}×{source.height ?? '-'}
            </dd>
          </div>
          <div>
            <dt>재생</dt>
            <dd>{url ? '디코딩 확인됨' : '연결 필요'}</dd>
          </div>
        </dl>
      ) : null}

      {source && source.status !== 'available' ? (
        <SourceRepair
          busy={busy}
          error={uploadError}
          inputTestId={`${testIdPrefix}-${key}-relink`}
          onGrantPermission={canGrantPermission ? onGrantPermission : null}
          onRelink={onRelink}
          reference={source}
          testId={`${testIdPrefix}-${key}-repair`}
          verdict={relinkVerdict}
        />
      ) : null}
    </section>
  );
};

export const Day1AssetPanel = ({
  panels,
  panelLabels = PANEL_LABELS,
  panelSource,
  disabled,
  busy,
  uploadError,
  relinkVerdict,
  missingPanels,
  autosaveError,
  supportsFilePicker,
  panelUrl,
  canGrantPermission,
  testIdPrefix = 'day1-panel',
  onUpload,
  onPickFile,
  onRelink,
  onGrantPermission,
}: Day1AssetPanelProps) => (
  <>
    {missingPanels.length > 0 ? (
      <p className="notice notice--warning" data-testid="day1-panels-blocker">
        영상 {panels.length}개를 모두 올려야 렌더할 수 있습니다. 남은 패널:{' '}
        {missingPanels.map((panel) => PANEL_TEST_KEY[panel].toUpperCase()).join(' · ')}
      </p>
    ) : null}

    {panels.map((panel) => (
      <PanelBlock
        busy={busy}
        canGrantPermission={canGrantPermission(panel)}
        disabled={disabled}
        key={panel}
        label={panelLabels[panel]}
        onGrantPermission={() => onGrantPermission(panel)}
        onPickFile={() => onPickFile(panel)}
        onRelink={(file) => onRelink(panel, file)}
        onUpload={(file) => onUpload(panel, file)}
        panel={panel}
        relinkVerdict={relinkVerdict}
        source={panelSource(panel)}
        supportsFilePicker={supportsFilePicker}
        testIdPrefix={testIdPrefix}
        uploadError={uploadError}
        url={panelUrl(panel)}
      />
    ))}

    <p className="panel__hint">
      패널 A가 먼저 컬러로 재생되고, 그 사이 패널 B는 첫 프레임에서 흑백으로
      멈춥니다. 전환 시점은 타임라인의 경계를 끌어 조절합니다.
    </p>

    {supportsFilePicker ? (
      <p className="panel__hint">
        “파일 선택”으로 올린 영상은 파일 접근 권한이 저장되어 새로고침 후에도 다시
        연결됩니다. 끌어다 놓은 영상은 권한이 없어 다시 연결해야 합니다.
      </p>
    ) : null}

    {busy ? <p className="panel__hint">확인 중…</p> : null}

    {uploadError ? (
      <p className="notice notice--error" data-testid="day1-source-error">
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
