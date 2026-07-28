// Design Ref: §6.1 Error Shape — every expected failure carries a code, a user
// action, and retryability. Raw SDK errors never reach the user directly.
//
// Scope note: only codes with a producer today are listed. The remaining codes
// in Design §6.2 join this union with the modules that raise them.

export type AppErrorCode =
  | 'AUTOSAVE_FAILED'
  | 'CODEC_UNSUPPORTED'
  | 'HOOK_ANALYSIS_FAILED'
  | 'MEDIA_MISSING'
  | 'MEDIA_PERMISSION_REQUIRED'
  | 'MEDIA_PROBE_FAILED'
  | 'NARRATION_TOO_LONG'
  | 'OUTPUT_PERMISSION_DENIED'
  | 'OUTPUT_WRITE_FAILED'
  | 'PROJECT_INVALID'
  | 'RENDER_CANCELLED'
  | 'RENDER_FAILED'
  | 'RENDER_PREFLIGHT_FAILED'
  | 'TTS_GENERATION_FAILED'
  | 'TTS_MODEL_LOAD_FAILED'
  | 'TTS_UNSUPPORTED_LOCALE';

export type AppErrorActionTarget =
  | 'audio'
  | 'diagnostics'
  | 'relink'
  | 'retry'
  | 'scene'
  | 'settings'
  | 'source';

export interface AppError {
  code: AppErrorCode;
  /** Korean, user-facing, states the problem and the required action. */
  message: string;
  details?: Record<string, unknown>;
  action?: {
    label: string;
    target: AppErrorActionTarget;
  };
  retryable: boolean;
  cause?: unknown;
}

export type Result<TValue> =
  | {ok: true; value: TValue}
  | {ok: false; error: AppError};

export const createAppError = (
  code: AppErrorCode,
  message: string,
  options: Omit<AppError, 'code' | 'message' | 'retryable'> & {
    retryable?: boolean;
  } = {},
): AppError => ({
  code,
  message,
  retryable: options.retryable ?? false,
  ...(options.details ? {details: options.details} : {}),
  ...(options.action ? {action: options.action} : {}),
  ...(options.cause !== undefined ? {cause: options.cause} : {}),
});

export const isAppError = (value: unknown): value is AppError =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as AppError).code === 'string' &&
  typeof (value as AppError).message === 'string' &&
  typeof (value as AppError).retryable === 'boolean';

export const ok = <TValue>(value: TValue): Result<TValue> => ({
  ok: true,
  value,
});

export const fail = <TValue>(error: AppError): Result<TValue> => ({
  ok: false,
  error,
});
