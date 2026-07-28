// Design Ref: §5.5 "Project and Recovery Dialogs" — new project, JSON export and
// import, and the list of autosaved local projects with their update time.
import {useEffect, useState, type ChangeEvent} from 'react';

import {
  parseProjectFile,
  projectFileName,
  serializeProjectFile,
} from '../../domain/editor/projectFile';
import type {EditorProject} from '../../domain/editor/types';
import type {ProjectRepository, StoredProjectSummary} from '../../domain/ports';
import type {AppError} from '../../shared/errors/appError';

export interface ProjectMenuProps {
  project: EditorProject;
  repository: ProjectRepository;
  disabled: boolean;
  onNewProject: () => void;
  onOpenProject: (project: EditorProject) => void;
}

const formatUpdatedAt = (isoDate: string) =>
  new Date(isoDate).toLocaleString('ko-KR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

const downloadText = (fileName: string, text: string) => {
  const url = URL.createObjectURL(
    new Blob([text], {type: 'application/json'}),
  );
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const ProjectMenu = ({
  project,
  repository,
  disabled,
  onNewProject,
  onOpenProject,
}: ProjectMenuProps) => {
  const [open, setOpen] = useState(false);
  const [summaries, setSummaries] = useState<StoredProjectSummary[]>([]);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    void repository.list().then((result) => {
      if (result.ok) {
        setSummaries(result.value);
      } else {
        setError(result.error);
      }
    });
  }, [open, repository, project.updatedAt]);

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const result = parseProjectFile(await file.text());

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setError(null);
    setOpen(false);
    onOpenProject(result.value);
  };

  const handleOpen = async (id: string) => {
    const result = await repository.load(id);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    if (result.value) {
      setError(null);
      setOpen(false);
      onOpenProject(result.value);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await repository.delete(id);

    if (result.ok) {
      setSummaries((current) => current.filter((entry) => entry.id !== id));
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="menu">
      <button
        aria-expanded={open}
        className="button button--ghost"
        data-testid="project-menu-toggle"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        프로젝트
      </button>

      {open ? (
        <div className="menu__panel" data-testid="project-menu">
          <div className="menu__row">
            <button
              className="button button--secondary"
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                onNewProject();
              }}
              type="button"
            >
              새 프로젝트
            </button>
            <button
              className="button button--secondary"
              onClick={() =>
                downloadText(
                  projectFileName(project),
                  serializeProjectFile(project),
                )
              }
              type="button"
            >
              JSON 내보내기
            </button>
          </div>

          <label className="menu__import">
            <span>JSON 가져오기</span>
            <input
              accept="application/json,.json"
              data-testid="project-import-input"
              disabled={disabled}
              onChange={(event) => void handleImport(event)}
              type="file"
            />
          </label>
          <p className="panel__hint">
            JSON에는 설정과 파일 지문만 담깁니다. 영상 파일은 가져온 뒤 다시
            연결하세요.
          </p>

          {error ? (
            <p className="notice notice--error" data-testid="project-menu-error">
              {error.message}
            </p>
          ) : null}

          <div className="menu__list">
            <h3>저장된 프로젝트</h3>
            {summaries.length === 0 ? (
              <p className="panel__readout">저장된 프로젝트가 없습니다.</p>
            ) : (
              <ul>
                {summaries.map((summary) => (
                  <li key={summary.id}>
                    <button
                      className="menu__entry"
                      disabled={disabled}
                      onClick={() => void handleOpen(summary.id)}
                      type="button"
                    >
                      <strong>{summary.name || '(이름 없음)'}</strong>
                      <span>{formatUpdatedAt(summary.updatedAt)}</span>
                      <span>{summary.sourceName ?? '소재 없음'}</span>
                    </button>
                    <button
                      aria-label={`${summary.name} 삭제`}
                      className="button button--ghost"
                      disabled={disabled || summary.id === project.id}
                      onClick={() => void handleDelete(summary.id)}
                      type="button"
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
