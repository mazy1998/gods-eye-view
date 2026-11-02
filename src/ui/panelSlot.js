import { msg } from '../i18n/marker.js';

/**
 * The panels the selection slot shows on desktop, with the header controls
 * that move into the slot's header beside its close button. A panel that
 * `returns` goes back through the shell's own placement when it leaves (Radio
 * lives in the Layers list while Layers is open, else in Context) instead of
 * to the spot it was taken from, which the drawer may have closed since.
 */
export const SLOT_PANELS = Object.freeze({
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
  'recent-imagery-panel': Object.freeze({
    title: msg('Recent imagery'),
    icon: 'satellite_alt',
    actions: Object.freeze([]),
  }),
  'radio-panel': Object.freeze({
    title: msg('Radio'),
    icon: 'radio',
    actions: Object.freeze([]),
    returns: true,
  }),
});

const CLOSE = Object.freeze({ explicit: true });

/**
 * Show an expanded panel (a camera viewer, Recent imagery, Radio) in the
 * selection slot. The panel moves into the slot behind a placeholder and
 * keeps its id, bindings and collapse state, as the drawer borrows panels;
 * the expansions that opened it in the drawer (a camera pick, a switch-on,
 * Details, voice, a shortcut, a share restore) now show it there, and
 * collapsing it from anywhere puts it back. Close collapses it, as its own
 * collapse control does, and so does a newer item taking the slot; Radio
 * keeps playing, as it does collapsed. Recent imagery also leaves while its
 * layer is off (the panel is hidden) and shows when it appears again.
 * @param {object} options
 * @param {Document} options.document
 * @param {ReturnType<import('./selectionSlot.js').createSelectionSlot>} options.slot
 * @param {{subscribe: Function}} options.panelChannel PanelChrome.channel
 * @param {(id: string, collapsed: boolean, options: object) => void} options.setPanelCollapsed
 * @param {string[]} options.restoreOrder Panel ids in share-restore order.
 * @param {(key: string) => string} options.translate
 * @param {() => boolean} [options.isPhonePresenting] Whether the phone shell
 *   is changing panels for its own layout, which it can do before the slot
 *   rests: its media query is answered first.
 * @param {(id: string, panel: Element) => void} [options.returnHome] Place a
 *   panel that `returns` where it lives now, once it has left the slot.
 * @returns {() => void} Disconnect.
 */
export function connectPanelSlot({
  document: doc,
  slot,
  panelChannel,
  setPanelCollapsed,
  restoreOrder,
  translate,
  isPhonePresenting = () => false,
  returnHome = () => {},
}) {
  const ids = Object.keys(SLOT_PANELS);
  const isSlotted = (id) => ids.includes(id);
  const expanded = (id) => {
    const panel = doc.getElementById(id);
    return Boolean(
      panel && !panel.hidden && !panel.classList.contains('collapsed'),
    );
  };
  // A restore sets each panel's own state: the one it leads with shows, and
  // a panel it leaves expanded is not collapsed for being replaced.
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
    for (const actionId of SLOT_PANELS[id].actions) {
      const control = doc.getElementById(actionId);
      if (control?.parentNode && panel.contains(control))
        take(control, actions);
    }
    // Back home, focus stays on the very control that had it (a phone sheet
    // presents the panel there); the slot moves focus on for a replacement
    // or a close.
    return () => {
      const focused = moved.some(({ node }) => node.contains(doc.activeElement))
        ? doc.activeElement
        : null;
      const { returns } = SLOT_PANELS[id];
      for (const { node, home } of moved.reverse()) {
        // A panel that returns may have been taken already (a phone sheet);
        // one still here leaves even when the spot it came from has gone.
        if (returns && !body.contains(node)) home.remove();
        else if (home.parentNode) home.replaceWith(node);
        else if (returns) node.remove();
      }
      if (returns) returnHome(id, panel);
      if (focused?.isConnected) focused.focus({ preventScroll: true });
    };
  }

  function show(id) {
    const { title, icon } = SLOT_PANELS[id];
    slot.show({
      id,
      title: translate(title),
      icon,
      mount: (place) => mount(id, place),
      close: () => setPanelCollapsed(id, true, CLOSE),
      // Resting, the slot's items change nothing on the phone sheets, which
      // show both viewers at once.
      replaced: () => {
        if (!restoring && active() && expanded(id))
          setPanelCollapsed(id, true, CLOSE);
      },
    });
  }

  // The panel a restore or startup shows: its lead when that is an expanded
  // slotted panel, else the first expanded one in share-restore order.
  function follow(lead = null) {
    const first =
      isSlotted(lead) && expanded(lead)
        ? lead
        : restoreOrder.find((id) => isSlotted(id) && expanded(id));
    if (!first) return;
    restoring = true;
    try {
      show(first);
    } finally {
      restoring = false;
    }
  }

  // A collapsed or hidden panel leaves the slot.
  function leave() {
    const current = slot.current();
    if (isSlotted(current) && !expanded(current)) slot.hide(current);
  }

  // What the panels show now: with no panel in the slot, the first expanded
  // one shows.
  function sync() {
    leave();
    if (!slot.current()) follow();
  }

  // While the slot rests (phones, Cockpit) the phone sheets and Cockpit
  // present the panels themselves, collapsing and expanding them for their
  // own layout; the slot catches up with the panels when it is back.
  const active = () => slot.channel.getSnapshot().active;
  let wasActive = active();
  const unsubscribeSlot = slot.channel.subscribe(
    ({ state }) => {
      if (state.active && !wasActive) sync();
      wasActive = state.active;
    },
    { emitCurrent: false },
  );

  const unsubscribe = panelChannel.subscribe(({ state, change, initial }) => {
    const previous = panels;
    panels = state.panels ?? {};
    if (!active() || isPhonePresenting()) return;
    if (initial) return sync();
    // A collapse from anywhere (its own control, Escape, a restore) takes the
    // panel out of the slot.
    leave();
    if (state.restoring || change?.presentation || change?.revealing) return;
    if (change?.type === 'panels-restored') return follow(change.lead);
    if (change?.type === 'panel-revealed') {
      if (isSlotted(change.panelId) && expanded(change.panelId))
        show(change.panelId);
      return;
    }
    for (const id of ids) {
      const was = previous[id];
      const next = panels[id];
      if (was?.collapsed && !was.autoCollapsed && next && expanded(id))
        show(id);
    }
  });

  // Recent imagery is hidden while its layer is off: it leaves then, and an
  // expanded one shows when the layer turns it on again.
  const Observer = doc.defaultView?.MutationObserver;
  const observer = Observer
    ? new Observer((records) => {
        if (!active() || isPhonePresenting()) return;
        leave();
        for (const { target } of records)
          if (!target.hidden && expanded(target.id)) return show(target.id);
      })
    : null;
  for (const id of ids) {
    const panel = doc.getElementById(id);
    if (panel)
      observer?.observe(panel, {
        attributes: true,
        attributeFilter: ['hidden'],
      });
  }

  return () => {
    unsubscribe();
    unsubscribeSlot();
    observer?.disconnect();
    const current = slot.current();
    if (isSlotted(current)) slot.hide(current);
  };
}
