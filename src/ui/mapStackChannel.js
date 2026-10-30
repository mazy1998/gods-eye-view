import { createStateChannel } from '../app/stateChannel.js';

/**
 * A view's read of the map-stack controller: the active stack, whether a
 * switch is in flight, the last error, and each stack's availability. It
 * publishes on every settled activation, silent fallbacks included
 * (`controller.subscribe`), and on the status feed (`gev:map-stack-changed`),
 * switches in flight included. It never syncs share state, so share links are
 * unchanged. Operations stay with the existing map-source controls.
 * @param {{controller: object, eventTarget?: EventTarget}} options
 * @returns {{channel: object, destroy: Function}}
 */
export function createMapStackChannel({
  controller,
  eventTarget = globalThis.window,
}) {
  // A selection marks itself pending before the controller starts switching.
  let pending = false;
  const channel = createStateChannel(() => {
    const state = controller.getState();
    return {
      activeId: state.activeId ?? null,
      status: pending ? 'switching' : state.status,
      lastError: state.lastError ?? null,
      switchOrigin: state.switchOrigin ?? null,
      stacks: controller
        .getStacks()
        .map(
          ({
            id,
            label,
            shortLabel,
            kind,
            available,
            requiresIon,
            unavailableReason,
          }) => ({
            id,
            label,
            shortLabel: shortLabel ?? null,
            kind: kind ?? null,
            available,
            requiresIon: requiresIon === true,
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
    /** Show a selection in flight until it settles, whatever the controller says. */
    setPending(value) {
      if (destroyed || pending === !!value) return;
      pending = !!value;
      channel.publish({ type: 'stack-pending' });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      eventTarget?.removeEventListener('gev:map-stack-changed', changed);
      channel.destroy();
    },
  };
}
