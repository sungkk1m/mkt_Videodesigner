// A render that fails with `A delayRender() "Extracting frame at time X from
// blob:..." was called but not cleared after 28000ms` says nothing about which
// stage stalled: the message is identical whether the decode was merely slow or
// the decoder never answered at all. @remotion/media's own logging does say,
// but only at 'verbose', which is far too noisy to ship on by default.
//
// `?debug=1` on the deployed URL turns it on for one session.
//
// 'trace', not 'verbose': the two ways a frame extraction can stall - the video
// decoder never answering, and the audio fetch never answering - produce the
// same silence at 'verbose', because Promise.all in extractFrameAndAudio makes
// either one hold the same delayRender. Only 'trace' logs "Added frame at Xsec
// to bank", so only 'trace' says whether the video side got that far.

export type RenderLogLevel = 'info' | 'trace';

export const renderLogLevelFor = (search: string): RenderLogLevel =>
  new URLSearchParams(search).has('debug') ? 'trace' : 'info';

export const renderLogLevel = (): RenderLogLevel =>
  typeof window === 'undefined'
    ? 'info'
    : renderLogLevelFor(window.location.search);
