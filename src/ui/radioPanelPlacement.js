/** Keep Radio in Context in every theme, reusing the same playback controls. */
export function syncRadioPanelPlacement(doc) {
  if (!doc?.getElementById) return;
  const panel = doc.getElementById('radio-panel');
  const context = doc.getElementById('global-context-panel');
  const dock = doc.getElementById('context-radio-dock');
  const mini = doc.getElementById('context-radio-mini');
  const parent =
    context?.querySelector('.cyber-panel-body') ||
    context?.querySelector('.global-context-panel-inner');
  const header = context?.querySelector('.panel-header');
  if (!panel || !parent || !header || !dock || !mini) return;
  // The active desktop or phone destination borrows Radio and returns it
  // to Context when it closes.
  if (
    panel.parentElement !== parent &&
    !panel.closest?.('.gev-legacy-host') &&
    !panel.closest?.('#mobile-sheet-panels')
  )
    parent.append(panel);
  // Its launcher may stand in the destination's header beside Close, where
  // the drawer or phone sheet puts it back itself.
  if (
    dock.parentElement !== header &&
    !dock.closest?.('.gev-drawer-panel-actions, #mobile-sheet-panel-actions')
  )
    header.insertBefore(dock, header.querySelector('.panel-collapse-btn'));
  if (mini.parentElement !== dock) dock.append(mini);
}
