/** Keep Radio in Context in every theme, reusing the same playback controls. */
export function syncRadioPanelPlacement(
  doc,
  panel = doc?.getElementById?.('radio-panel'),
) {
  if (!doc?.getElementById) return;
  const context = doc.getElementById('global-context-panel');
  const parent =
    context?.querySelector('.cyber-panel-body') ||
    context?.querySelector('.global-context-panel-inner');
  if (!panel || !parent) return;
  // The active desktop or phone destination, or the selection slot, borrows
  // Radio and returns it to Context when it closes.
  if (
    panel.parentElement !== parent &&
    !panel.closest?.('.gev-legacy-host') &&
    !panel.closest?.('.gev-slot-body') &&
    !panel.closest?.('#mobile-sheet-panels')
  )
    parent.append(panel);
}
