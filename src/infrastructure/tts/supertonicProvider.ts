// Design Ref: §4.2 — "TransformersJsSupertonicProvider is Beta for ko/en/ja
// only." The runtime is loaded from a pinned URL only after the user asks for
// generated narration, so the editor stays fully offline until then (§7).
//
// Scope note: this provider is capability-gated. If the pinned runtime or model
// cannot load it reports `available: false` with an actionable reason and the
// uploaded-audio path stays the supported route for every locale.
import {TTS_SUPPORTED_LOCALES, type Locale} from '../../domain/editor/types';
import type {
  TtsCapabilities,
  TtsProvider,
  TtsRequest,
  TtsResult,
  TtsVoice,
} from '../../domain/tts/types';
import {SUPERTONIC_BETA, type TtsModelConfig} from '../../shared/config/models';
import {createAppError, fail, ok, type Result} from '../../shared/errors/appError';

interface SynthesisRuntime {
  synthesize(
    request: TtsRequest,
    onProgress: (progress: number) => void,
  ): Promise<{audio: Float32Array; sampleRate: number}>;
  dispose(): Promise<void>;
}

/** Minimal shape this provider needs from the pinned Transformers.js bundle. */
interface TransformersModule {
  pipeline: (
    task: string,
    model: string,
    options?: Record<string, unknown>,
  ) => Promise<
    (
      text: string,
      options?: Record<string, unknown>,
    ) => Promise<{audio: Float32Array; sampling_rate: number}>
  >;
  env?: {allowLocalModels?: boolean};
}

const modelLoadFailed = (reason: string, cause?: unknown) =>
  createAppError(
    'TTS_MODEL_LOAD_FAILED',
    `음성 모델을 불러오지 못했습니다(${reason}). 다시 시도하거나 음성 파일을 업로드하세요.`,
    {
      action: {label: '음성 파일 업로드', target: 'audio'},
      retryable: true,
      ...(cause === undefined ? {} : {cause}),
    },
  );

/** WAV so the browser can decode the result without another dependency. */
const encodeWav = (samples: Float32Array, sampleRate: number) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index] as number));

    view.setInt16(
      44 + index * 2,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true,
    );
  }

  return new Blob([buffer], {type: 'audio/wav'});
};

export const createSupertonicProvider = (
  config: TtsModelConfig = SUPERTONIC_BETA,
): TtsProvider => {
  let runtime: SynthesisRuntime | null = null;
  let capabilities: TtsCapabilities | null = null;

  const supportedLocales = TTS_SUPPORTED_LOCALES.filter((locale) =>
    config.locales.includes(locale),
  ) as readonly Locale[];

  const loadRuntime = async (
    onProgress: (progress: number) => void,
  ): Promise<SynthesisRuntime> => {
    if (runtime) {
      return runtime;
    }

    // `@vite-ignore` keeps the pinned CDN URL out of the build graph: nothing is
    // fetched unless the user asks for generated narration.
    const module = (await import(
      /* @vite-ignore */ config.runtimeUrl
    )) as TransformersModule;

    if (typeof module.pipeline !== 'function') {
      throw new Error('runtime-shape');
    }

    onProgress(0.2);

    const synthesizer = await module.pipeline('text-to-speech', config.modelId, {
      revision: config.revision,
      progress_callback: (event: {progress?: number}) =>
        onProgress(0.2 + (event.progress ?? 0) * 0.006),
    });

    onProgress(0.8);

    runtime = {
      synthesize: async (request) => {
        const output = await synthesizer(request.text, {
          speaker_id: request.voiceId,
          speed: request.speed,
        });

        return {audio: output.audio, sampleRate: output.sampling_rate};
      },
      dispose: async () => {
        runtime = null;
      },
    };

    return runtime;
  };

  return {
    id: config.providerId,

    getCapabilities: async () => {
      if (capabilities) {
        return capabilities;
      }

      // Availability is a static platform question; the model itself only loads
      // on the first synthesise call.
      const hasWasm = typeof WebAssembly !== 'undefined';
      const online = typeof navigator === 'undefined' || navigator.onLine;

      capabilities = {
        providerId: config.providerId,
        available: hasWasm && online,
        supportedLocales,
        modelRevision: config.revision,
        ...(hasWasm
          ? online
            ? {}
            : {
                unavailableReason:
                  '오프라인 상태에서는 음성 모델을 내려받을 수 없습니다. 음성 파일을 업로드하세요.',
              }
          : {
              unavailableReason:
                '이 브라우저는 WebAssembly를 지원하지 않아 음성 생성을 사용할 수 없습니다.',
            }),
      };

      return capabilities;
    },

    listVoices: async (locale) =>
      supportedLocales.includes(locale)
        ? ([
            {id: 'default', label: '기본 음성 (Beta)', locale},
          ] satisfies TtsVoice[])
        : [],

    synthesize: async (request, {signal, onProgress}) => {
      if (!supportedLocales.includes(request.locale)) {
        return fail<TtsResult>(
          createAppError(
            'TTS_UNSUPPORTED_LOCALE',
            `${request.locale}는 음성 생성을 지원하지 않습니다. 음성 파일을 업로드하세요.`,
            {action: {label: '음성 파일 업로드', target: 'audio'}},
          ),
        );
      }

      if (!request.text.trim()) {
        return fail<TtsResult>(
          createAppError(
            'TTS_GENERATION_FAILED',
            '읽을 문구가 비어 있습니다. 자막 또는 나레이션 문구를 입력하세요.',
            {action: {label: '문구 입력', target: 'audio'}},
          ),
        );
      }

      let loaded: SynthesisRuntime;

      try {
        loaded = await loadRuntime(onProgress);
      } catch (cause) {
        return fail<TtsResult>(modelLoadFailed('모델 로드 실패', cause));
      }

      if (signal.aborted) {
        return fail<TtsResult>(
          createAppError('TTS_GENERATION_FAILED', '음성 생성을 취소했습니다.', {
            retryable: true,
          }),
        );
      }

      try {
        const {audio, sampleRate} = await loaded.synthesize(request, onProgress);

        onProgress(1);

        return ok<TtsResult>({
          blob: encodeWav(audio, sampleRate),
          durationMs: Math.round((audio.length / sampleRate) * 1000),
          sampleRate,
          providerId: config.providerId,
          modelRevision: config.revision,
        }) as Result<TtsResult>;
      } catch (cause) {
        return fail<TtsResult>(
          createAppError(
            'TTS_GENERATION_FAILED',
            '음성을 생성하지 못했습니다. 다시 시도하거나 음성 파일을 업로드하세요.',
            {
              action: {label: '음성 파일 업로드', target: 'audio'},
              retryable: true,
              cause,
            },
          ),
        );
      }
    },

    dispose: async () => {
      await runtime?.dispose();
      runtime = null;
    },
  };
};
