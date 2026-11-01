import { msg } from '../i18n/marker.js';

/**
 * The camera viewers the selection slot shows on desktop, with the header
 * controls that move into the slot's header beside its close button.
 */
export const SLOT_CAMERA_PANELS = Object.freeze({
  'cctv-panel': Object.freeze({
    title: msg('CCTV'),
    icon: 'camera_alt',
    actions: Object.freeze([]),
  }),
  'street-level-panel': Object.freeze({
    title: msg('Street Level'),
    icon: 'streetview',
    actions: Object.freeze(['sl-status']),
  }),
});

const CLOSE = Object.freeze({ explicit: true });

/**
 * Show an expanded camera panel in the selection slot. The panel moves into
 * the slot behind a placeholder and keeps its id, bindings and collapse
 * state, as the drawer borrows panels; the same expansions that opened
 * Inspect → Cameras (a camera pick, a switch-on, voice, a shortcut, a share
 * restore) now show it there, and collapsing it from anywhere puts it back.
 * Close collapses it, as its own collapse control does, and so does a newer
 * item taking the slot. Collapsed, a viewer stays in Inspect → Cameras,
 * whose header expands it into the slot.
 * @param {object} options
 * @param {Document} options.document
 * @param {ReturnType<import('./selectionSlot.js').createSelectionSlot>} options.slot
 * @param {{subscribe: Function}} options.panelChannel PanelChrome.channel
 * @param {(id: string, collapsed: boolean, options: object) => void} options.setPanelCollapsed
 * @param {string[]} options.restoreOrder Panel ids in share-restore order.
 * @param {(key: string) => string} options.translate
 * @returns {() => void} Disconnect.
 */
export function connectCameraSlot({
  document: doc,
  slot,
  panelChannel,
  setPanelCollapsed,
  restoreOrder,
  translate,
}) {
  const ids = Object.keys(SLOT_CAMERA_PANELS);
  const isCamera = (id) => ids.includes(id);
  const expanded = (id) => {
    const panel = doc.getElementById(id);
    return Boolean(panel && !panel.classList.contains('collapsed'));
  };
  // A restore sets each panel's own state: the one it leads with shows, and
  // a camera it leaves expanded is not collapsed for being replaced.
  let restoring = false;
  let panels = {};

  function mount(id, { body, actions }) {
    const panel = doc.getElementById(id);
    if (!panel?.parentNode) return () => {};
    const moved = [];
    const take = (node, target) => {
      const home = doc.createComment(`gev-slot-home:${node.id}`);
      node.before(home);
      target.append(node);
      moved.push({ node, home });
    };
    take(panel, body);
    for (const actionId of SLOT_CAMERA_PANELS[id].actions) {
      const control = doc.getElementById(actionId);
      if (control?.parentNode && panel.contains(control))
        take(control, actions);
    }
    return () => {
      for (const { node, home } of moved.reverse()) {
        const focused = node.contains(doc.activeElement);
        if (home.parentNode) home.replaceWith(node);
        if (focused) node.focus?.({ preventScroll: true });
      }
    };
  }

  function show(id) {
    const { title, icon } = SLOT_CAMERA_PANELS[id];
    slot.show({
      id,
      title: translate(title),
      icon,
      mount: (place) => mount(id, place),
      close: () => setPanelCollapsed(id, true, CLOSE),
      replaced: () => {
        if (!restoring && expanded(id)) setPanelCollapsed(id, true, CLOSE);
      },
    });
  }

  // The camera a restore or startup shows: its lead when that is an expanded
  // camera, else the first expanded one in share-restore order.
  function follow(lead = null) {
    const first =
      isCamera(lead) && expanded(lead)
        ? lead
        : restoreOrder.find((id) => isCamera(id) && expanded(id));
    if (!first) return;
    restoring = true;
    try {
      show(first);
    } finally {
      restoring = false;
    }
  }

  const unsubscribe = panelChannel.subscribe(({ state, change, initial }) => {
    const previous = panels;
    panels = state.panels ?? {};
    // A collapse from anywhere (its own control, Escape, Cockpit's entry, a
    // restore) takes the viewer out of the slot.
    const current = slot.current();
    if (isCamera(current) && !expanded(current)) slot.hide(current);
    if (initial) return follow();
    if (state.restoring || change?.presentation || change?.revealing) return;
    if (change?.type === 'panels-restored') return follow(change.lead);
    if (change?.type === 'panel-revealed') {
      if (isCamera(change.panelId) && expanded(change.panelId))
        show(change.panelId);
      return;
    }
    for (const id of ids) {
      const was = previous[id];
      const next = panels[id];
      if (was?.collapsed && !was.autoCollapsed && next && !next.collapsed)
        show(id);
    }
  });

  return () => {
    unsubscribe();
    const current = slot.current();
    if (isCamera(current)) slot.hide(current);
  };
}
