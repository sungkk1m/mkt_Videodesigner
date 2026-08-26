// day1-label-effects Plan §7 Q5 — one hex-to-rgba conversion for every overlay
// that paints a translucent plate. Moved out of `SubtitleOverlay.tsx` verbatim
// when the Day1 panel label needed the same conversion; nothing about the maths
// changed in the move.
export const hexToRgba = (hex: string, alpha: number) => {
  const value = Number.parseInt(hex.slice(1), 16);

  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};
