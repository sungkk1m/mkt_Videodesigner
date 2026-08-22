// key-visual-looping Design Ref: §5.3 — the bottom disclaimer line, the slot the
// reference video's "확률형 아이템 포함" sits in (FR-L11).
//
// Never wraps: the bannerdesigner disclaimer policy is that a line too long to
// fit is a copy problem the editor flags (module-4 hint), not something the
// render silently reflows.
import type {KvDisclaimerRenderProps} from '../../domain/editor/types';

/** Fractions of the frame height: how far off the bottom the line sits. */
const BOTTOM_INSET_RATIO = 0.04;

export const DisclaimerBar = ({
  disclaimer,
}: {
  disclaimer: KvDisclaimerRenderProps;
}) => {
  if (disclaimer.text === '') {
    return null;
  }

  return (
    <div
      data-testid="kv-disclaimer"
      style={{
        bottom: `${BOTTOM_INSET_RATIO * 100}%`,
        color: disclaimer.textColor,
        fontFamily: 'Arial, sans-serif',
        fontSize: disclaimer.fontSize,
        fontWeight: 600,
        left: 0,
        position: 'absolute',
        right: 0,
        textAlign: 'center',
        // Key visuals are busy, so the line needs its own separation from them.
        textShadow: '0 2px 8px rgba(0, 0, 0, 0.65)',
        whiteSpace: 'nowrap',
      }}
    >
      {disclaimer.text}
    </div>
  );
};
