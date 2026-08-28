// failure-video Design §7.3 — the failure template's asset slots, addressed by
// one string so `useDay1Assets` can hold all six.
//
// The hook keys its restore sweep, its permission grants, and its relink state
// on a slot id. A failure slot is `(orientation, key)`, so it is encoded into
// one string on the way in and decoded on the way out. Handing the hook all six
// rather than the visible three is deliberate: the inactive orientation's
// sources render the other ratio, and a batch that renders both needs them
// restored too, not only once the operator happens to toggle the preview.
import type {FailurePanelKey} from '../../domain/editor/project';
import {
  FAILURE_ORIENTATIONS,
  FAILURE_PANEL_KEYS,
  type FailureOrientation,
} from '../../domain/editor/types';

export type FailureSlotKey = `${FailureOrientation}:${FailurePanelKey}`;

export const failureSlotKey = (
  orientation: FailureOrientation,
  key: FailurePanelKey,
): FailureSlotKey => `${orientation}:${key}`;

export const decodeFailureSlot = (
  slot: FailureSlotKey,
): {orientation: FailureOrientation; key: FailurePanelKey} => {
  const [orientation, key] = slot.split(':') as [
    FailureOrientation,
    FailurePanelKey,
  ];

  return {orientation, key};
};

/** All six, in a stable order. Empty for every other template's hook instance. */
export const FAILURE_SLOT_KEYS: readonly FailureSlotKey[] =
  FAILURE_ORIENTATIONS.flatMap((orientation) =>
    FAILURE_PANEL_KEYS.map((key) => failureSlotKey(orientation, key)),
  );
