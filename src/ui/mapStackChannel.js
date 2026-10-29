import { createStateChannel } from '../app/stateChannel.js';

/**
 * A view's read of the map-stack controller: the active stack, whether a
 * switch is in flight, the last error, and each stack's availability. It
 * publishes on every settled activation, silent fallbacks included
 * (`controller.subscribe`), and on the status feed the legacy chips follow
 * (`gev:map-stack-changed`). It never syncs share state, so share links are
 * unchanged (K11). Operations stay with the existing map-source controls.
 * @param {{controller: object, eventTarget?: EventTarget}} options
 * @returns {{channel: object, destroy: Function}}
 */
export function createMapStackChannel({
  controller,
  eventTarget = globalThis.window,
}) {
  const channel = createStateChannel(() => {
    const state = controller.getState();
    return {
      activeId: state.activeId ?? null,
      status: state.status,
      lastError: state.lastError ?? null,
      switchOrigin: state.switchOrigin ?? null,
      stacks: controller
        .getStacks()
        .map(
          ({ id, label, shortLabel, kind, available, unavailableReason }) => ({
            id,
            label,
            shortLabel: shortLabel ?? null,
            kind: kind ?? null,
            available,
            unavailableReason: unavailableReason ?? null,
          }),
        ),
    };
  });
  const settled = () => channel.publish({ type: 'stack-settled' });
  const changed = () => channel.publish({ type: 'stack-changed' });
  const unsubscribe = controller.subscribe(settled);
  eventTarget?.addEventListener('gev:map-stack-changed', changed);
  let destroyed = false;
  return {
    channel,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      eventTarget?.removeEventListener('gev:map-stack-changed', changed);
      channel.destroy();
    },
  };
}
