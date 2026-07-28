// Design Ref: §1.3 Output — "Fast, Standard, High; Standard is 1080p60" and
// §5.5 Batch Dialog — "Select: 30 or 60fps, constrained by profile".
export const RENDER_PROFILES = ['fast', 'standard', 'high'] as const;
export const FRAME_RATES = [30, 60] as const;

export type RenderProfile = (typeof RENDER_PROFILES)[number];
export type FrameRate = (typeof FRAME_RATES)[number];

export interface ProfileSpec {
  label: string;
  /** Frame rates this profile allows, in preference order. */
  allowedFps: readonly FrameRate[];
  videoBitrate: 'medium' | 'high' | 'highest';
  audioBitrate: 'medium' | 'high';
  /** Korean summary shown next to the option. */
  hint: string;
}

export const PROFILE_SPECS: Record<RenderProfile, ProfileSpec> = {
  fast: {
    label: 'Fast',
    allowedFps: [30],
    videoBitrate: 'medium',
    audioBitrate: 'medium',
    hint: '30fps · 가장 빠름 · 검수용',
  },
  standard: {
    label: 'Standard',
    allowedFps: [60, 30],
    videoBitrate: 'high',
    audioBitrate: 'medium',
    hint: '1080p60 · 기본 배포 품질',
  },
  high: {
    label: 'High',
    allowedFps: [60, 30],
    videoBitrate: 'highest',
    audioBitrate: 'high',
    hint: '최고 비트레이트 · 가장 느림',
  },
};

export const DEFAULT_PROFILE: RenderProfile = 'standard';

/**
 * Constrains a requested frame rate to the profile. Fast is 30fps only, so
 * choosing it never silently produces a 60fps file.
 */
export const fpsForProfile = (
  profile: RenderProfile,
  requestedFps: FrameRate,
): FrameRate => {
  const {allowedFps} = PROFILE_SPECS[profile];

  return allowedFps.includes(requestedFps)
    ? requestedFps
    : (allowedFps[0] as FrameRate);
};
