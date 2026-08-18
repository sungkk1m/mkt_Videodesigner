// A render that fails with `A delayRender() "Extracting frame at time X from
// blob:..." was called but not cleared after 28000ms` says nothing about which
// stage stalled: the message is identical whether the decode was merely slow or
// the decoder never answered at all. @remotion/media's own logging does say,
// but only at 'verbose', which is far too noisy to ship on by default.
//
// `?debug=1` on the deployed URL turns it on for one session.

export type RenderLogLevel = 'info' | 'verbose';

export const renderLogLevelFor = (search: string): RenderLogLevel =>
  new URLSearchParams(search).has('debug') ? 'verbose' : 'info';

export const renderLogLevel = (): RenderLogLevel =>
  typeof window === 'undefined'
    ? 'info'
    : renderLogLevelFor(window.location.search);
