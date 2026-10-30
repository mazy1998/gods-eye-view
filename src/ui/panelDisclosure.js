/** Track listeners so a discarded controller leaves no active DOM callbacks. */
function listenerScope() {
  const removers = [];
  return {
    listen(target, type, callback, options) {
      if (!target) return;
      target.addEventListener(type, callback, options);
      removers.push(() => target.removeEventListener(type, callback, options));
    },
    destroy() {
      for (const remove of removers.splice(0)) remove();
    },
  };
}

/** Bind collapse buttons and bubbling Escape to an existing panel. */
export function bindPanelDisclosure({
  panel,
  buttons = [],
  onChange,
  onEscape,
}) {
  if (
    !panel ||
    typeof onChange !== 'function' ||
    typeof onEscape !== 'function'
  ) {
    throw new TypeError(
      'Panel disclosure requires a panel, onChange and onEscape',
    );
  }
  const scope = listenerScope();
  for (const button of new Set(buttons)) {
    scope.listen(button, 'click', () => {
      onChange(!panel.classList.contains('collapsed'), { explicit: true });
    });
  }
  scope.listen(panel, 'keydown', onEscape);
  return { destroy: () => scope.destroy() };
}

/** Close the nearest expanded panel and return focus to its disclosure. */
export function collapsePanelOnEscape(
  event,
  { panel, onChange, beforeCollapse },
) {
  if (event.key !== 'Escape' || event.defaultPrevented) return false;
  if (
    !panel ||
    panel.classList.contains('collapsed') ||
    !panel.contains(event.target)
  )
    return false;
  const focusedPanel = event.target?.closest?.(
    '.panel-collapsible:not(.collapsed), #param-slider-panel:not(.collapsed)',
  );
  if (focusedPanel && focusedPanel !== panel) return false;
  event.preventDefault();
  event.stopPropagation();
  beforeCollapse?.();
  onChange(true, { explicit: true });
  const disclosure =
    panel.querySelector(`[data-dock-toggle-target="${panel.id}"]`) ||
    panel.querySelector(`[data-collapse-target="${panel.id}"]`);
  const escapedFromDisclosure =
    event.target === disclosure || disclosure?.contains?.(event.target);
  if (escapedFromDisclosure) disclosure?.blur?.();
  else disclosure?.focus?.({ preventScroll: true });
  return true;
}
