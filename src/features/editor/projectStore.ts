// Design Ref: §9.3 State Ownership — the project is the one long-lived store and
// every mutation goes through a pure domain command. Session-only media URLs and
// transient render state stay out of it so the store is always persistable.
import {create} from 'zustand';

import {
  setBgm,
  setDucking,
  setNarration,
  setNarrationVolume,
  setOriginalVolume,
  updateBgm,
} from '../../domain/audio/mix';
import {
  applyDurationPreset,
  applySourceToAllScenes,
  createProject,
  moveKvImage,
  moveTimelineBoundary,
  relinkDay1PanelSource,
  relinkSource,
  renameProject,
  resetDay1Transform,
  resetKvSlotTransform,
  resetSceneTransform,
  setCopyField,
  setDay1LabelText,
  setDay1PanelSource,
  setDay1PanelSourceStatus,
  setDay1RatioOverride,
  setDay1EndCardTrimInMs,
  setDay1EndCardTrimLengthMs,
  setDay1EndCardVideo,
  setDay1TrimInMs,
  setKvCount,
  setKvImage,
  setKvImageStatus,
  setKvDefaultMotion,
  setKvMotion,
  setKvLoopCount,
  setKvTitleImage,
  setRatioOverride,
  setSceneSubtitleText,
  setSceneTransition,
  setSceneTrimInMs,
  setSceneTrimOutMs,
  setRenderFilePrefix,
  setRenderFps,
  setRenderProfile,
  setSelectedLocale,
  setSelectedRatio,
  switchTemplate,
  toggleRenderLocale,
  toggleRenderRatio,
  setSourceStatus,
  threeSceneOf,
  updateCtaSettings,
  updateDay1EndCard,
  updateDay1LabelStyle,
  updateDay1Split,
  updateDay1Transform,
  updateHookSettings,
  updateKvDisclaimerStyle,
  updateKvLoopSettings,
  updateKvSlotTransform,
  updateKvTitleTransform,
  updateSceneTransform,
  updateSubtitleStyle,
  type Day1EndCardPatch,
  type Day1PanelKey,
  type KvLoopPatch,
} from '../../domain/editor/project';
import type {
  ActivePanel,
  AspectRatio,
  AudioMix,
  AudioTrack,
  CtaSceneSettings,
  Day1Settings,
  DurationPreset,
  KvLoopSettings,
  KvMotion,
  EditorProject,
  HookSceneSettings,
  Locale,
  MediaReference,
  MediaStatus,
  MediaTransform,
  NarrationTrack,
  SceneKind,
  SceneTransition,
  SubtitleStyle,
  TemplateKind,
} from '../../domain/editor/types';
import type {FrameRate, RenderProfile} from '../../domain/render/profile';
import type {BoundaryIndex} from '../../domain/timeline/timeline';
import type {CtaAssetSlot} from './SceneInspector';

export type CopyTextField =
  | 'hook'
  | 'hookSubcopy'
  | 'ctaText'
  | 'ctaSubcopy'
  /** key-visual-looping FR-L11 — the looping bottom line. */
  | 'kvLoopDisclaimer';

export interface ProjectStore {
  project: EditorProject;
  /** Replaces the whole document on restore, import, or new project. */
  replaceProject: (project: EditorProject) => void;
  rename: (name: string) => void;
  setDurationPreset: (preset: DurationPreset) => void;
  applySource: (source: MediaReference) => void;
  reapplySource: () => void;
  /** Restores a missing source without resetting the current edit. */
  relink: (source: MediaReference) => void;
  setSourceStatus: (status: MediaStatus) => void;
  moveBoundary: (boundary: BoundaryIndex, positionMs: number) => void;
  setTrimIn: (kind: SceneKind, ms: number) => void;
  setTrimOut: (kind: SceneKind, ms: number) => void;
  setLocale: (locale: Locale) => void;
  setRatio: (ratio: AspectRatio) => void;
  /** Framing commands act on the ratio currently selected in the header. */
  setTransform: (
    kind: SceneKind,
    patch: Partial<Omit<MediaTransform, 'fit'>>,
  ) => void;
  resetTransform: (kind: SceneKind) => void;
  toggleRatioOverride: (kind: SceneKind, enabled: boolean) => void;
  setSubtitleStyle: (kind: SceneKind, patch: Partial<SubtitleStyle>) => void;
  setTransition: (kind: SceneKind, patch: Partial<SceneTransition>) => void;
  setHook: (patch: Partial<HookSceneSettings>) => void;
  setCta: (patch: Partial<CtaSceneSettings>) => void;
  setCtaAsset: (slot: CtaAssetSlot, reference: MediaReference | null) => void;
  /** Copy commands act on the locale currently selected in the header. */
  setCopy: (field: CopyTextField, value: string) => void;
  setSubtitleText: (kind: SceneKind, value: string) => void;
  /** Audio commands. Design Ref: §3.3. */
  setOriginalVolume: (volume: number) => void;
  setBgm: (track: AudioTrack | null) => void;
  updateBgm: (patch: Partial<Omit<AudioTrack, 'source'>>) => void;
  setDucking: (patch: Partial<AudioMix['ducking']>) => void;
  /** Narration commands act on the locale currently selected in the header. */
  setNarration: (kind: SceneKind, track: NarrationTrack | null) => void;
  setNarrationVolume: (kind: SceneKind, volume: number) => void;
  /** Render settings. Design Ref: §3.4. */
  setRenderProfile: (profile: RenderProfile) => void;
  setRenderFps: (fps: FrameRate) => void;
  setRenderFilePrefix: (prefix: string) => void;
  toggleRenderLocale: (locale: Locale) => void;
  toggleRenderRatio: (ratio: AspectRatio) => void;
  /** Day1 commands. Day1 Design Ref: §6.1, §6.3. */
  switchTemplate: (template: TemplateKind) => void;
  setDay1PanelSource: (
    panel: Day1PanelKey,
    source: MediaReference | null,
  ) => void;
  relinkDay1Panel: (panel: Day1PanelKey, source: MediaReference) => void;
  setDay1PanelStatus: (panel: Day1PanelKey, status: MediaStatus) => void;
  setDay1TrimIn: (panel: Day1PanelKey, ms: number) => void;
  /** day1-video — a panel also chooses its `fit`, unlike a scene. */
  setDay1Transform: (
    panel: Day1PanelKey,
    patch: Partial<MediaTransform>,
  ) => void;
  resetDay1Transform: (panel: Day1PanelKey) => void;
  toggleDay1RatioOverride: (panel: Day1PanelKey, enabled: boolean) => void;
  setDay1Split: (patch: Partial<Day1Settings['split']>) => void;
  setDay1LabelStyle: (patch: Partial<Day1Settings['labelStyle']>) => void;
  setDay1EndCard: (patch: Day1EndCardPatch) => void;
  setDay1EndCardVideo: (reference: MediaReference | null) => void;
  setDay1EndCardTrimIn: (ms: number) => void;
  /** day1-trim-preview FR-05 — adjustable end-card window length. */
  setDay1EndCardTrimLength: (ms: number) => void;
  /**
   * Label wording takes an explicit locale: the Day1 inspector edits all four at
   * once rather than following the header. Day1 Design Ref: §6.3.
   */
  setDay1LabelAt: (locale: Locale, panel: ActivePanel, value: string) => void;
  /** key-visual-looping commands. Design Ref: §6.2, §6.3. */
  setKvImage: (index: number, reference: MediaReference | null) => void;
  setKvImageAt: (
    locale: Locale,
    index: number,
    reference: MediaReference | null,
  ) => void;
  setKvImageStatus: (index: number, status: MediaStatus) => void;
  moveKvImage: (from: number, to: number) => void;
  setKvCount: (count: number) => void;
  setKvLoopCount: (loopCount: number) => void;
  setKvTransform: (index: number, patch: Partial<MediaTransform>) => void;
  resetKvTransform: (index: number) => void;
  setKvMotion: (index: number, motion: KvMotion | null) => void;
  setKvDefaultMotion: (motion: KvMotion) => void;
  setKvLoop: (patch: KvLoopPatch) => void;
  setKvTitle: (locale: Locale, reference: MediaReference | null) => void;
  setKvTitleTransform: (patch: Partial<MediaTransform>) => void;
  setKvDisclaimerStyle: (
    patch: Partial<KvLoopSettings['disclaimer']>,
  ) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  project: createProject(15),
  replaceProject: (project) => set({project}),
  rename: (name) =>
    set((state) => ({project: renameProject(state.project, name)})),
  setDurationPreset: (preset) =>
    set((state) => ({project: applyDurationPreset(state.project, preset)})),
  applySource: (source) =>
    set((state) => ({project: applySourceToAllScenes(state.project, source)})),
  reapplySource: () =>
    set((state) => {
      const source = threeSceneOf(state.project)?.source;

      return {
        project: source
          ? applySourceToAllScenes(state.project, source)
          : state.project,
      };
    }),
  relink: (source) =>
    set((state) => ({project: relinkSource(state.project, source)})),
  setSourceStatus: (status) =>
    set((state) => ({project: setSourceStatus(state.project, status)})),
  moveBoundary: (boundary, positionMs) =>
    set((state) => ({
      project: moveTimelineBoundary(state.project, boundary, positionMs),
    })),
  setTrimIn: (kind, ms) =>
    set((state) => ({project: setSceneTrimInMs(state.project, kind, ms)})),
  setTrimOut: (kind, ms) =>
    set((state) => ({project: setSceneTrimOutMs(state.project, kind, ms)})),
  setLocale: (locale) =>
    set((state) => ({project: setSelectedLocale(state.project, locale)})),
  setRatio: (ratio) =>
    set((state) => ({project: setSelectedRatio(state.project, ratio)})),
  setTransform: (kind, patch) =>
    set((state) => ({
      project: updateSceneTransform(
        state.project,
        kind,
        state.project.selectedRatio,
        patch,
      ),
    })),
  resetTransform: (kind) =>
    set((state) => ({
      project: resetSceneTransform(
        state.project,
        kind,
        state.project.selectedRatio,
      ),
    })),
  toggleRatioOverride: (kind, enabled) =>
    set((state) => ({
      project: setRatioOverride(
        state.project,
        kind,
        state.project.selectedRatio,
        enabled,
      ),
    })),
  setSubtitleStyle: (kind, patch) =>
    set((state) => ({
      project: updateSubtitleStyle(state.project, kind, patch),
    })),
  setTransition: (kind, patch) =>
    set((state) => ({project: setSceneTransition(state.project, kind, patch)})),
  setHook: (patch) =>
    set((state) => ({project: updateHookSettings(state.project, patch)})),
  setCta: (patch) =>
    set((state) => ({project: updateCtaSettings(state.project, patch)})),
  setCtaAsset: (slot, reference) =>
    set((state) => ({
      project: updateCtaSettings(state.project, {[slot]: reference}),
    })),
  setCopy: (field, value) =>
    set((state) => ({
      project: setCopyField(
        state.project,
        state.project.selectedLocale,
        field,
        value,
      ),
    })),
  setSubtitleText: (kind, value) =>
    set((state) => ({
      project: setSceneSubtitleText(
        state.project,
        state.project.selectedLocale,
        kind,
        value,
      ),
    })),
  setOriginalVolume: (volume) =>
    set((state) => ({project: setOriginalVolume(state.project, volume)})),
  setBgm: (track) => set((state) => ({project: setBgm(state.project, track)})),
  updateBgm: (patch) =>
    set((state) => ({project: updateBgm(state.project, patch)})),
  setDucking: (patch) =>
    set((state) => ({project: setDucking(state.project, patch)})),
  setNarration: (kind, track) =>
    set((state) => ({
      project: setNarration(
        state.project,
        state.project.selectedLocale,
        kind,
        track,
      ),
    })),
  setNarrationVolume: (kind, volume) =>
    set((state) => ({
      project: setNarrationVolume(
        state.project,
        state.project.selectedLocale,
        kind,
        volume,
      ),
    })),
  setRenderProfile: (profile) =>
    set((state) => ({project: setRenderProfile(state.project, profile)})),
  setRenderFps: (fps) =>
    set((state) => ({project: setRenderFps(state.project, fps)})),
  setRenderFilePrefix: (prefix) =>
    set((state) => ({project: setRenderFilePrefix(state.project, prefix)})),
  toggleRenderLocale: (locale) =>
    set((state) => ({project: toggleRenderLocale(state.project, locale)})),
  toggleRenderRatio: (ratio) =>
    set((state) => ({project: toggleRenderRatio(state.project, ratio)})),
  switchTemplate: (template) =>
    set((state) => ({project: switchTemplate(state.project, template)})),
  setDay1PanelSource: (panel, source) =>
    set((state) => ({
      project: setDay1PanelSource(state.project, panel, source),
    })),
  relinkDay1Panel: (panel, source) =>
    set((state) => ({
      project: relinkDay1PanelSource(state.project, panel, source),
    })),
  setDay1PanelStatus: (panel, status) =>
    set((state) => ({
      project: setDay1PanelSourceStatus(state.project, panel, status),
    })),
  setDay1TrimIn: (panel, ms) =>
    set((state) => ({project: setDay1TrimInMs(state.project, panel, ms)})),
  setDay1Transform: (panel, patch) =>
    set((state) => ({
      project: updateDay1Transform(
        state.project,
        panel,
        state.project.selectedRatio,
        patch,
      ),
    })),
  resetDay1Transform: (panel) =>
    set((state) => ({
      project: resetDay1Transform(
        state.project,
        panel,
        state.project.selectedRatio,
      ),
    })),
  toggleDay1RatioOverride: (panel, enabled) =>
    set((state) => ({
      project: setDay1RatioOverride(
        state.project,
        panel,
        state.project.selectedRatio,
        enabled,
      ),
    })),
  setDay1Split: (patch) =>
    set((state) => ({project: updateDay1Split(state.project, patch)})),
  setDay1LabelStyle: (patch) =>
    set((state) => ({project: updateDay1LabelStyle(state.project, patch)})),
  setDay1EndCard: (patch) =>
    set((state) => ({project: updateDay1EndCard(state.project, patch)})),
  setDay1EndCardVideo: (reference) =>
    set((state) => ({project: setDay1EndCardVideo(state.project, reference)})),
  setDay1EndCardTrimIn: (ms) =>
    set((state) => ({project: setDay1EndCardTrimInMs(state.project, ms)})),
  setDay1EndCardTrimLength: (ms) =>
    set((state) => ({project: setDay1EndCardTrimLengthMs(state.project, ms)})),
  setDay1LabelAt: (locale, panel, value) =>
    set((state) => ({
      project: setDay1LabelText(state.project, locale, panel, value),
    })),
  // The key visual commands follow the header's locale, like the copy ones do.
  setKvImage: (index, reference) =>
    set((state) => ({
      project: setKvImage(
        state.project,
        state.project.selectedLocale,
        index,
        reference,
      ),
    })),
  setKvImageAt: (locale, index, reference) =>
    set((state) => ({
      project: setKvImage(state.project, locale, index, reference),
    })),
  setKvImageStatus: (index, status) =>
    set((state) => ({
      project: setKvImageStatus(
        state.project,
        state.project.selectedLocale,
        index,
        status,
      ),
    })),
  moveKvImage: (from, to) =>
    set((state) => ({project: moveKvImage(state.project, from, to)})),
  setKvCount: (count) =>
    set((state) => ({project: setKvCount(state.project, count)})),
  setKvLoopCount: (loopCount) =>
    set((state) => ({project: setKvLoopCount(state.project, loopCount)})),
  setKvTransform: (index, patch) =>
    set((state) => ({
      project: updateKvSlotTransform(state.project, index, patch),
    })),
  resetKvTransform: (index) =>
    set((state) => ({project: resetKvSlotTransform(state.project, index)})),
  setKvMotion: (index, motion) =>
    set((state) => ({project: setKvMotion(state.project, index, motion)})),
  setKvDefaultMotion: (motion) =>
    set((state) => ({project: setKvDefaultMotion(state.project, motion)})),
  setKvLoop: (patch) =>
    set((state) => ({project: updateKvLoopSettings(state.project, patch)})),
  setKvTitle: (locale, reference) =>
    set((state) => ({
      project: setKvTitleImage(state.project, locale, reference),
    })),
  setKvTitleTransform: (patch) =>
    set((state) => ({project: updateKvTitleTransform(state.project, patch)})),
  setKvDisclaimerStyle: (patch) =>
    set((state) => ({project: updateKvDisclaimerStyle(state.project, patch)})),
}));
