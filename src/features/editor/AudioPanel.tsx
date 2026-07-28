// Design Ref: §5.5 Left Input Panel (Audio/TTS) — original/BGM/narration volume,
// auto ducking, per-scene narration upload or Beta generation, and the zh-TW
// upload-required notice.
import type {ChangeEvent} from 'react';

import {narrationOf} from '../../domain/audio/mix';
import {
  SCENE_LABELS,
  SCENE_ORDER,
  TTS_SUPPORTED_LOCALES,
  type EditorProject,
  type SceneKind,
} from '../../domain/editor/types';
import type {TtsCapabilities} from '../../domain/tts/types';
import {MODEL_NETWORK_NOTICE} from '../../shared/config/models';
import type {NarrationJob} from './useEditorAudio';

export interface AudioPanelProps {
  project: EditorProject;
  capabilities: TtsCapabilities | null;
  job: NarrationJob;
  disabled: boolean;
  onOriginalVolume: (volume: number) => void;
  onBgmFile: (file: File | null) => void;
  onBgmPatch: (patch: {volume?: number; startMs?: number; loop?: boolean}) => void;
  onDucking: (patch: {
    enabled?: boolean;
    targetGain?: number;
    attackMs?: number;
    releaseMs?: number;
  }) => void;
  onNarrationFile: (kind: SceneKind, file: File) => void;
  onNarrationGenerate: (kind: SceneKind) => void;
  onNarrationRemove: (kind: SceneKind) => void;
  onNarrationVolume: (kind: SceneKind, volume: number) => void;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

const pickFile = (
  event: ChangeEvent<HTMLInputElement>,
  handle: (file: File) => void,
) => {
  const file = event.target.files?.[0];
  event.target.value = '';

  if (file) {
    handle(file);
  }
};

export const AudioPanel = ({
  project,
  capabilities,
  job,
  disabled,
  onOriginalVolume,
  onBgmFile,
  onBgmPatch,
  onDucking,
  onNarrationFile,
  onNarrationGenerate,
  onNarrationRemove,
  onNarrationVolume,
}: AudioPanelProps) => {
  const {audio, selectedLocale} = project;
  const localeSupported = (
    TTS_SUPPORTED_LOCALES as readonly string[]
  ).includes(selectedLocale);
  const canGenerate = localeSupported && capabilities?.available === true;

  return (
    <div className="copy">
      <div className="panel__group">
        <h3>원본 사운드</h3>
        <label className="field field--range">
          <span>
            원본 볼륨<strong>{percent(audio.originalVolume)}</strong>
          </span>
          <input
            data-testid="audio-original-volume"
            disabled={disabled}
            max={1}
            min={0}
            onChange={(event) => onOriginalVolume(Number(event.target.value))}
            step={0.05}
            type="range"
            value={audio.originalVolume}
          />
        </label>
      </div>

      <div className="panel__group">
        <h3>BGM</h3>
        <label className="field">
          <span>배경음악 파일</span>
          <input
            accept="audio/*"
            data-testid="audio-bgm-input"
            disabled={disabled}
            onChange={(event) => pickFile(event, (file) => onBgmFile(file))}
            type="file"
          />
        </label>
        <p className="panel__readout">
          {audio.bgm?.source.name ?? '없음'}
          {audio.bgm ? (
            <button
              className="button button--ghost"
              disabled={disabled}
              onClick={() => onBgmFile(null)}
              type="button"
            >
              제거
            </button>
          ) : null}
        </p>

        {audio.bgm ? (
          <>
            <label className="field field--range">
              <span>
                BGM 볼륨<strong>{percent(audio.bgm.volume)}</strong>
              </span>
              <input
                data-testid="audio-bgm-volume"
                disabled={disabled}
                max={1}
                min={0}
                onChange={(event) =>
                  onBgmPatch({volume: Number(event.target.value)})
                }
                step={0.05}
                type="range"
                value={audio.bgm.volume}
              />
            </label>
            <label className="field field--toggle">
              <input
                checked={audio.bgm.loop}
                data-testid="audio-bgm-loop"
                disabled={disabled}
                onChange={(event) => onBgmPatch({loop: event.target.checked})}
                type="checkbox"
              />
              <span>반복 재생</span>
            </label>
          </>
        ) : null}
      </div>

      <div className="panel__group">
        <h3>자동 더킹</h3>
        <label className="field field--toggle">
          <input
            checked={audio.ducking.enabled}
            data-testid="audio-ducking"
            disabled={disabled}
            onChange={(event) => onDucking({enabled: event.target.checked})}
            type="checkbox"
          />
          <span>나레이션 중 원본·BGM 낮추기</span>
        </label>
        {audio.ducking.enabled ? (
          <label className="field field--range">
            <span>
              낮출 볼륨<strong>{percent(audio.ducking.targetGain)}</strong>
            </span>
            <input
              data-testid="audio-ducking-gain"
              disabled={disabled}
              max={1}
              min={0}
              onChange={(event) =>
                onDucking({targetGain: Number(event.target.value)})
              }
              step={0.05}
              type="range"
              value={audio.ducking.targetGain}
            />
          </label>
        ) : null}
      </div>

      <div className="panel__group">
        <h3>나레이션 · {selectedLocale}</h3>

        {localeSupported ? null : (
          <p className="notice notice--warning" data-testid="tts-locale-notice">
            {selectedLocale}는 음성 생성을 지원하지 않습니다. 음성 파일을
            업로드하세요.
          </p>
        )}

        {localeSupported && capabilities && !capabilities.available ? (
          <p className="notice notice--warning" data-testid="tts-unavailable">
            {capabilities.unavailableReason}
          </p>
        ) : null}

        <p className="panel__hint">{MODEL_NETWORK_NOTICE}</p>

        {SCENE_ORDER.map((kind) => {
          const track = narrationOf(project, selectedLocale, kind);
          const sceneMs = project.scenes[SCENE_ORDER.indexOf(kind)]?.durationMs ?? 0;
          const tooLong = track ? track.durationMs > sceneMs : false;
          const working = job.status === 'working' && job.kind === kind;

          return (
            <div className="narration" key={kind}>
              <strong>{SCENE_LABELS[kind]}</strong>

              <div className="narration__actions">
                <label className="field">
                  <span>음성 업로드</span>
                  <input
                    accept="audio/*"
                    data-testid={`narration-upload-${kind}`}
                    disabled={disabled}
                    onChange={(event) =>
                      pickFile(event, (file) => onNarrationFile(kind, file))
                    }
                    type="file"
                  />
                </label>
                <button
                  className="button button--secondary"
                  data-testid={`narration-generate-${kind}`}
                  disabled={disabled || !canGenerate || working}
                  onClick={() => onNarrationGenerate(kind)}
                  type="button"
                >
                  음성 생성 (Beta)
                </button>
              </div>

              {working ? (
                <p className="panel__readout" data-testid={`narration-progress-${kind}`}>
                  생성 중 {Math.round(job.progress * 100)}%
                </p>
              ) : null}

              {job.status === 'failed' && job.kind === kind ? (
                <p className="notice notice--error" data-testid={`narration-error-${kind}`}>
                  {job.error.message}
                </p>
              ) : null}

              {track ? (
                <>
                  <p className="panel__readout" data-testid={`narration-info-${kind}`}>
                    {track.mode === 'generated' ? '생성됨' : '업로드됨'} ·{' '}
                    {(track.durationMs / 1000).toFixed(2)}초
                    <button
                      className="button button--ghost"
                      disabled={disabled}
                      onClick={() => onNarrationRemove(kind)}
                      type="button"
                    >
                      제거
                    </button>
                  </p>
                  <label className="field field--range">
                    <span>
                      나레이션 볼륨<strong>{percent(track.volume)}</strong>
                    </span>
                    <input
                      data-testid={`narration-volume-${kind}`}
                      disabled={disabled}
                      max={1}
                      min={0}
                      onChange={(event) =>
                        onNarrationVolume(kind, Number(event.target.value))
                      }
                      step={0.05}
                      type="range"
                      value={track.volume}
                    />
                  </label>
                  {tooLong ? (
                    <p
                      className="notice notice--error"
                      data-testid={`narration-too-long-${kind}`}
                    >
                      나레이션이 장면보다 깁니다 (
                      {(track.durationMs / 1000).toFixed(2)}초 &gt;{' '}
                      {(sceneMs / 1000).toFixed(2)}초). 문구를 줄이거나 장면
                      길이를 늘리세요.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="panel__readout">없음</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
