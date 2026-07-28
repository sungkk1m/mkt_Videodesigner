// Design Ref: §10.4 — "Public model revision and asset URLs centralized in
// src/shared/config/models.ts" and §7 — the network allowlist is limited to the
// static app assets, approved fonts, and these pinned model assets.
//
// Nothing here is fetched until the user explicitly asks for generated narration.

export interface TtsModelConfig {
  providerId: string;
  /** Pinned ES module that exposes the Transformers.js runtime. */
  runtimeUrl: string;
  /** Model repository id on the hub. */
  modelId: string;
  /** Pinned revision so a hub update cannot silently change output. */
  revision: string;
  /** Locales this model can synthesise. Design Ref: §4.2. */
  locales: readonly string[];
}

export const SUPERTONIC_BETA: TtsModelConfig = {
  providerId: 'supertonic-beta',
  runtimeUrl:
    'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6/dist/transformers.min.js',
  modelId: 'Supertone/supertonic',
  revision: 'main',
  locales: ['ko', 'en', 'ja'],
};

/** Design Ref: §7 — first use of a model is not offline; user media is never sent. */
export const MODEL_NETWORK_NOTICE =
  '음성 생성 모델은 처음 사용할 때만 내려받습니다. 업로드한 영상과 문구는 서버로 전송되지 않습니다.';
