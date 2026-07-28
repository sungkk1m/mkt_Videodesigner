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
  moveTimelineBoundary,
  relinkSource,
  renameProject,
  resetSceneTransform,
  setCopyField,
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
  toggleRenderLocale,
  toggleRenderRatio,
  setSourceStatus,
  updateCtaSettings,
  updateHookSettings,
  updateSceneTransform,
  updateSubtitleStyle,
} from '../../domain/editor/project';
import type {
  AspectRatio,
  AudioMix,
  AudioTrack,
  CtaSceneSettings,
  DurationPreset,
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
} from '../../domain/editor/types';
import type {FrameRate, RenderProfile} from '../../domain/render/profile';
import type {BoundaryIndex} from '../../domain/timeline/timeline';
import type {CtaAssetSlot} from './SceneInspector';

export type CopyTextField = 'hook' | 'hookSubcopy' | 'ctaText' | 'ctaSubcopy';

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
    set((state) => ({
      project: state.project.source
        ? applySourceToAllScenes(state.project, state.project.source)
        : state.project,
    })),
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
}));
