import { renderMapStackChips, syncMapStackChips } from '../mapStackChips.js';
import { t } from '../i18n/index.js';

/**
 * Own Map Source selection without constructing map providers. The supplied
 * controller remains authoritative for availability and active state; the Map
 * tab's picker is a view of the map-stack channel and calls `select`.
 * `refresh` re-renders the picker's tiles through `onRefresh`, so tiles a
 * caller still holds are inert.
 */
export function createMapSourceControls({
  container,
  statusElement,
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
  const removers = [];
  function render(state) {
    if (destroyed || !container || !state) return;
    syncMapStackChips(container, state.activeId);
    if (statusElement) {
      const stack = state.activeStack;
      statusElement.textContent =
        state.status === 'switching'
          ? '...'
          : stack?.shortLabel || stack?.label || t('MAP');
      statusElement.classList.toggle('warn', !!state.lastError);
    }
  }
  async function select(stackId, { syncShare = true } = {}) {
    if (destroyed) return null;
    const current = ++generation;
    if (syncShare) claimSelection();
    const before = controller.getActiveId();
    onPending(true);
    if (container) render(controller.getState('switching'));
    let state;
    try {
      state = await controller.setStack(stackId);
    } catch (error) {
      if (!destroyed && current === generation) {
        onPending(false);
        if (container) render(controller.getState());
        onError(error?.message || String(error));
      }
      throw error;
    }
    if (!destroyed && current === generation) onPending(false);
    if (destroyed || current !== generation) return state;
    if (container) render(controller.getState());
    if (state?.activeId === before && stackId !== before && state?.lastError)
      onError(state.lastError);
    if (syncShare) onStateChanged();
    return state;
  }
  function refresh() {
    if (destroyed) return;
    for (const remove of removers.splice(0)) remove();
    if (container) {
      renderMapStackChips(container, controller.getStacks(), {
        activeId: controller.getActiveId(),
        onSelect: (id) => {
          void select(id).catch(() => {});
        },
        bind(element, type, listener) {
          element.addEventListener(type, listener);
          removers.push(() => element.removeEventListener(type, listener));
        },
      });
      render(controller.getState());
    }
    onRefresh();
  }
  const unsubscribe = subscribe(() => {
    if (destroyed) return;
    if (container) render(controller.getState());
    onStateChanged();
  });
  if (container) refresh();
  return {
    render,
    select,
    refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      generation++;
      unsubscribe?.();
      for (const remove of removers.splice(0)) remove();
    },
  };
}
