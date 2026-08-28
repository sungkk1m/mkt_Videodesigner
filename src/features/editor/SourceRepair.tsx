// Design Ref: §5.5 "List: missing assets with expected metadata" and §3.6
// assisted relinking — the user sees exactly which file is expected and what
// differs about the replacement before it is accepted.
import type {ChangeEvent} from 'react';

import type {RelinkVerdict} from '../../domain/media/relink';
import type {MediaReference} from '../../domain/editor/types';
import type {AppError} from '../../shared/errors/appError';

export interface SourceRepairProps {
  reference: MediaReference;
  verdict: RelinkVerdict | null;
  error: AppError | null;
  busy: boolean;
  onRelink: (file: File) => void;
  /** Present only when a stored file handle can be re-authorised. */
  onGrantPermission: (() => void) | null;
  /**
   * Day1 Design Ref: §6.2 — every panel needs its own repair block, so the
   * caller names them. There is no default: a shared id would make two blocks on
   * screen indistinguishable to the E2E suite.
   */
  testId: string;
  inputTestId: string;
}

const STATUS_MESSAGE: Record<string, string> = {
  missing: '원본 영상을 찾을 수 없습니다. 같은 파일을 다시 선택하세요.',
  'permission-required':
    '저장된 파일 접근 권한이 만료되었습니다. 권한을 허용하거나 파일을 다시 선택하세요.',
  unsupported: '이 파일은 Chrome에서 재생할 수 없습니다. 다른 파일을 선택하세요.',
};

export const SourceRepair = ({
  reference,
  verdict,
  error,
  busy,
  onRelink,
  onGrantPermission,
  testId,
  inputTestId,
}: SourceRepairProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      onRelink(file);
    }
  };

  return (
    <section className="repair" data-testid={testId}>
      <p className="notice notice--warning">
        {STATUS_MESSAGE[reference.status] ?? '원본 영상을 다시 연결하세요.'}
      </p>

      <dl className="metadata">
        <div>
          <dt>기대 파일</dt>
          <dd>{reference.name}</dd>
        </div>
        <div>
          <dt>크기</dt>
          <dd>{(reference.sizeBytes / 1024 / 1024).toFixed(1)} MB</dd>
        </div>
        <div>
          <dt>길이</dt>
          <dd>{((reference.durationMs ?? 0) / 1000).toFixed(2)}초</dd>
        </div>
      </dl>

      {onGrantPermission ? (
        <button
          className="button button--secondary"
          disabled={busy}
          onClick={onGrantPermission}
          type="button"
        >
          저장된 파일 권한 허용
        </button>
      ) : null}

      <label className="upload">
        <span>파일 다시 연결</span>
        <input
          accept="video/*"
          data-testid={inputTestId}
          disabled={busy}
          onChange={handleChange}
          type="file"
        />
      </label>

      {error ? (
        <p className="notice notice--error" data-testid="relink-error">
          {error.message}
        </p>
      ) : null}

      {verdict && verdict.confidence !== 'exact' ? (
        <div className="notice notice--warning" data-testid="relink-verdict">
          <p>선택한 파일이 원본과 완전히 같지는 않습니다.</p>
          <ul>
            {verdict.differences.map((difference) => (
              <li key={difference}>{difference}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
