/**
 * Own Map Source selection without constructing map providers. The supplied
 * controller remains authoritative for availability and active state; the Map
 * tab's picker is a view of the map-stack channel and calls `select`.
 * `refresh` re-renders the picker's tiles through `onRefresh`, so tiles a
 * caller still holds are inert.
 */
export function createMapSourceControls({
  controller,
  subscribe,
  claimSelection = () => {},
  onStateChanged = () => {},
  onError = () => {},
  onRefresh = () => {},
  onPending = () => {},
}) {
  let destroyed = false;
  let generation = 0;
  async function select(stackId, { syncShare = true } = {}) {
    if (destroyed) return null;
    const current = ++generation;
    if (syncShare) claimSelection();
    const before = controller.getActiveId();
    onPending(true);
    let state;
    try {
      state = await controller.setStack(stackId);
    } catch (error) {
      if (!destroyed && current === generation) {
        onPending(false);
        onError(error?.message || String(error));
      }
      throw error;
    }
    if (!destroyed && current === generation) onPending(false);
    if (destroyed || current !== generation) return state;
    if (state?.activeId === before && stackId !== before && state?.lastError)
      onError(state.lastError);
    if (syncShare) onStateChanged();
    return state;
  }
  function refresh() {
    if (!destroyed) onRefresh();
  }
  const unsubscribe = subscribe(() => {
    if (destroyed) return;
    onStateChanged();
  });
  return {
    select,
    refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      generation++;
      unsubscribe?.();
    },
  };
}
