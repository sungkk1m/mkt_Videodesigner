// Renders one finished 3장면 (three-scene) example so the template's current
// state can be watched rather than read about.
//
// Nothing about the frame is drawn here: the project is built with the app's own
// domain commands, handed to `buildEditorSnapshot`, and rendered through the same
// `ThreeSceneComposition` the editor previews and the MP4 render both use. The
// only deviation from a production render is the encoder — this container's
// Chromium has no H.264 encoder or decoder, so the request `createEditorRenderRequest`
// builds is re-pointed at VP9/WebM and transcoded to MP4 by `run.mjs` afterwards.
// docs/03-analysis/day1-quad.m0-perf-gate.md §6 is the same limitation.
import {renderMediaOnWeb} from '@remotion/web-renderer';

import {
  applySourceToAllScenes,
  buildEditorSnapshot,
  createProject,
  renameProject,
  setCopyField,
  setRatioOverride,
  setSceneSubtitleText,
  setSceneTransition,
  setSceneTrimInMs,
  setSelectedLocale,
  setSelectedRatio,
  updateCtaSettings,
  updateHookSettings,
  updateSceneTransform,
  updateSubtitleStyle,
} from '../../src/domain/editor/project';
import type {
  AspectRatio,
  EditorProject,
  Locale,
  MediaReference,
} from '../../src/domain/editor/types';
import {createEditorRenderRequest} from '../../src/infrastructure/render/renderEditor';

const asset = (name: string) => new URL(`./assets/${name}`, document.baseURI).href;

const reference = (
  name: string,
  kind: MediaReference['kind'],
  mimeType: string,
  extra: Partial<MediaReference> = {},
): MediaReference => ({
  id: name,
  kind,
  name,
  mimeType,
  sizeBytes: 1,
  lastModified: 0,
  fingerprint: name,
  status: 'available',
  ...extra,
});

const SOURCE = reference('gameplay-placeholder.webm', 'video', 'video/webm', {
  durationMs: 14_000,
  width: 1080,
  height: 1920,
});
const APP_ICON = reference('app-icon.png', 'image', 'image/png');
const LOGO = reference('logo.png', 'image', 'image/png');
const STORE_BADGE = reference('store-badge.png', 'image', 'image/png');

const resolveUrl = (media: MediaReference | null | undefined) =>
  media ? asset(media.name) : null;

/** The Korean and English copy an operator would type into the Copy tab. */
const COPY: Record<Locale, {
  hook: string;
  hookSubcopy: string;
  hookSubtitle: string;
  emphasis: string;
  gameplaySubtitle: string;
  ctaText: string;
  ctaSubcopy: string;
}> = {
  ko: {
    hook: '3일 만에 만렙',
    hookSubcopy: '자동 전투로 잠든 사이에도 성장',
    hookSubtitle: '설치하면 SSR 영웅 즉시 지급',
    emphasis: 'SSR 영웅',
    gameplaySubtitle: '스킬 한 번으로 보스 처리',
    ctaText: '지금 무료로 시작',
    ctaSubcopy: '사전예약 보상 전원 지급',
  },
  en: {
    hook: 'Max level in 3 days',
    hookSubcopy: 'Idle battles level you up overnight',
    hookSubtitle: 'Install now for a free SSR hero',
    emphasis: 'SSR hero',
    gameplaySubtitle: 'One skill clears the boss',
    ctaText: 'Play free now',
    ctaSubcopy: 'Pre-registration rewards for everyone',
  },
  ja: {
    hook: '3日で最大レベル',
    hookSubcopy: '放置バトルで寝ている間も成長',
    hookSubtitle: 'インストールでSSR英雄を配布',
    emphasis: 'SSR英雄',
    gameplaySubtitle: 'スキル一発でボス撃破',
    ctaText: '今すぐ無料で始める',
    ctaSubcopy: '事前登録報酬を全員に',
  },
  'zh-TW': {
    hook: '3天滿級',
    hookSubcopy: '掛機戰鬥，睡覺也在變強',
    hookSubtitle: '安裝即送SSR英雄',
    emphasis: 'SSR英雄',
    gameplaySubtitle: '一個技能清掉首領',
    ctaText: '立即免費開玩',
    ctaSubcopy: '預約獎勵全員發放',
  },
};

/**
 * The example project, assembled the way the editor assembles one: upload,
 * trims, copy per locale, Hook motion, a fade at the first boundary, CTA assets,
 * and a framing override for each non-default ratio.
 */
export const exampleProject = (locale: Locale, ratio: AspectRatio): EditorProject => {
  let project = createProject(15, {
    id: 'project_three_scene_example',
    createdAt: '2026-08-27T00:00:00.000Z',
  });

  project = renameProject(project, '달빛원정대_3장면예시');
  project = applySourceToAllScenes(project, SOURCE);

  // Trim: the Hook takes a critical-hit beat, gameplay runs 2s-12s of the clip.
  project = setSceneTrimInMs(project, 'hook', 3_000);
  project = setSceneTrimInMs(project, 'gameplay', 2_000);

  // Copy, all four locales, so switching the render locale is a real switch.
  (Object.keys(COPY) as Locale[]).forEach((key) => {
    const copy = COPY[key];
    project = setCopyField(project, key, 'hook', copy.hook);
    project = setCopyField(project, key, 'hookSubcopy', copy.hookSubcopy);
    project = setCopyField(project, key, 'ctaText', copy.ctaText);
    project = setCopyField(project, key, 'ctaSubcopy', copy.ctaSubcopy);
    project = setSceneSubtitleText(project, key, 'hook', copy.hookSubtitle);
    project = setSceneSubtitleText(project, key, 'gameplay', copy.gameplaySubtitle);
  });

  project = updateHookSettings(project, {
    motionPreset: 'impact',
    emphasizedText: COPY[locale].emphasis,
    dimBackground: true,
  });

  // 48px is the default and reads small at 1080 wide; an operator bumps it.
  project = updateSubtitleStyle(project, 'hook', {fontSize: 54});
  project = updateSubtitleStyle(project, 'gameplay', {fontSize: 58});

  // A crossfade into gameplay, a hard cut into the CTA.
  project = setSceneTransition(project, 'hook', {kind: 'fade', durationMs: 500});

  project = updateCtaSettings(project, {
    appIcon: APP_ICON,
    logo: LOGO,
    storeBadge: STORE_BADGE,
    useGeneratedBackground: true,
    backgroundBlur: 18,
    backgroundDim: 0.45,
  });

  project = setSelectedLocale(project, locale);
  project = setSelectedRatio(project, ratio);

  // Per-ratio framing: a portrait source under `cover` in a square or landscape
  // frame crops vertically, so each non-default ratio gets its own offset. This
  // is the override the Scene Inspector writes.
  if (ratio !== '9:16') {
    (['hook', 'gameplay', 'cta'] as const).forEach((kind) => {
      project = setRatioOverride(project, kind, ratio, true);
      project = updateSceneTransform(project, kind, ratio, {
        scale: 1,
        x: 0,
        y: ratio === '1:1' ? -20 : -22,
      });
    });
  }

  return project;
};

declare global {
  interface Window {
    __renderExample: (input: {
      locale?: Locale;
      ratio?: AspectRatio;
    }) => Promise<{base64: string; bytes: number; totalMs: number; scenes: unknown}>;
    /** The render props without rendering, so a report can quote real numbers. */
    __exampleSnapshot: (input: {locale?: Locale; ratio?: AspectRatio}) => unknown;
  }
}

window.__exampleSnapshot = ({locale = 'ko', ratio = '9:16'}) =>
  buildEditorSnapshot(exampleProject(locale, ratio), resolveUrl);

window.__renderExample = async ({locale = 'ko', ratio = '9:16'}) => {
  await document.fonts.load('900 100px "Noto Sans KR"');
  await document.fonts.ready;

  const project = exampleProject(locale, ratio);
  const snapshot = buildEditorSnapshot(project, resolveUrl);
  const request = createEditorRenderRequest(snapshot, {
    durationPreset: project.durationPreset,
    fps: project.render.fps,
    ratio,
    locale,
    template: 'three-scene',
    outputTarget: 'arraybuffer',
    profile: 'high',
  });

  // The one substitution: VP9/WebM in place of H.264/AAC, because this container
  // can encode neither H.264 nor AAC.
  const webRequest = {
    ...request,
    container: 'webm',
    videoCodec: 'vp9',
    audioCodec: null,
    muted: true,
  };

  const startedAt = performance.now();
  const result = (await (
    renderMediaOnWeb as unknown as (r: unknown) => Promise<{getBlob: () => Promise<Blob>}>
  )(webRequest)) as {getBlob: () => Promise<Blob>};
  const blob = await result.getBlob();
  const totalMs = performance.now() - startedAt;

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] as number);
  }

  return {
    base64: btoa(binary),
    bytes: bytes.length,
    totalMs: Math.round(totalMs),
    // Echoed so the report can quote the frame layout the domain computed.
    scenes: (snapshot.props as {scenes: unknown}).scenes,
  };
};

document.getElementById('status')!.textContent = 'ready';
