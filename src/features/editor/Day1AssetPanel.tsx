// Day1 Design Ref: §6.2 — panel A and panel B each get a dropzone plus metadata,
// and the render blocker states its reason here rather than only on the header
// button. Plan SC: FR-D03 "Day1은 영상 2개를 받으며, 둘 다 없으면 렌더를 차단한다".
import type {Day1PanelKey} from '../../domain/editor/project';
import type {
  Day1Settings,
  MediaReference,
} from '../../domain/editor/types';
import type {RelinkVerdict} from '../../domain/media/relink';
import type {AppError} from '../../shared/errors/appError';
import {Dropzone} from './Dropzone';
import {SourceRepair} from './SourceRepair';

const PANEL_LABELS: Record<Day1PanelKey, string> = {
  panelA: '패널 A · 먼저 재생',
  panelB: '패널 B · 나중에 재생',
};

const PANEL_TEST_KEY: Record<Day1PanelKey, string> = {
  panelA: 'a',
  panelB: 'b',
};

const PANELS: Day1PanelKey[] = ['panelA', 'panelB'];

export interface Day1AssetPanelProps {
  settings: Day1Settings;
  disabled: boolean;
  busy: boolean;
  uploadError: AppError | null;
  relinkVerdict: RelinkVerdict | null;
  /** Panels with no video at all. A non-empty list blocks the render (FR-D03). */
  missingPanels: Day1PanelKey[];
  autosaveError: AppError | null;
  panelUrl: (panel: Day1PanelKey) => string | null;
  onUpload: (panel: Day1PanelKey, file: File) => void;
  onRelink: (panel: Day1PanelKey, file: File) => void;
}

const PanelBlock = ({
  disabled,
  busy,
  panel,
  relinkVerdict,
  source,
  uploadError,
  url,
  onUpload,
  onRelink,
}: {
  disabled: boolean;
  busy: boolean;
  panel: Day1PanelKey;
  relinkVerdict: RelinkVerdict | null;
  source: MediaReference | null;
  uploadError: AppError | null;
  url: string | null;
  onUpload: (file: File) => void;
  onRelink: (file: File) => void;
}) => {
  const key = PANEL_TEST_KEY[panel];

  return (
    <section className="panel__group" data-testid={`day1-panel-${key}`}>
      <h3 className="panel__subtitle">{PANEL_LABELS[panel]}</h3>

      <Dropzone
        disabled={disabled}
        fileName={source?.name ?? null}
        hint="영상을 끌어다 놓거나 클릭해 선택"
        inputTestId={`day1-panel-${key}-input`}
        kind="video"
        onFile={onUpload}
        previewUrl={url}
        prompt={`패널 ${key.toUpperCase()} 영상`}
      />

      {source ? (
        <dl className="metadata" data-testid={`day1-panel-${key}-metadata`}>
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
          inputTestId={`day1-panel-${key}-relink`}
          onGrantPermission={null}
          onRelink={onRelink}
          reference={source}
          testId={`day1-panel-${key}-repair`}
          verdict={relinkVerdict}
        />
      ) : null}
    </section>
  );
};

export const Day1AssetPanel = ({
  settings,
  disabled,
  busy,
  uploadError,
  relinkVerdict,
  missingPanels,
  autosaveError,
  panelUrl,
  onUpload,
  onRelink,
}: Day1AssetPanelProps) => (
  <>
    {missingPanels.length > 0 ? (
      <p className="notice notice--warning" data-testid="day1-panels-blocker">
        영상 2개를 모두 올려야 렌더할 수 있습니다. 남은 패널:{' '}
        {missingPanels.map((panel) => PANEL_TEST_KEY[panel].toUpperCase()).join(' · ')}
      </p>
    ) : null}

    {PANELS.map((panel) => (
      <PanelBlock
        busy={busy}
        disabled={disabled}
        key={panel}
        onRelink={(file) => onRelink(panel, file)}
        onUpload={(file) => onUpload(panel, file)}
        panel={panel}
        relinkVerdict={relinkVerdict}
        source={settings[panel].source}
        uploadError={uploadError}
        url={panelUrl(panel)}
      />
    ))}

    <p className="panel__hint">
      패널 A가 먼저 컬러로 재생되고, 그 사이 패널 B는 첫 프레임에서 흑백으로
      멈춥니다. 전환 시점은 타임라인의 경계를 끌어 조절합니다.
    </p>

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
