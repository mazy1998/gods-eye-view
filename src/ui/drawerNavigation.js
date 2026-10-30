import { createStateChannel } from '../app/stateChannel.js';
import { msg } from '../i18n/marker.js';
import { flushViews } from './ownerState.js';

/**
 * Rail destinations and the legacy surfaces each one hosts until its port.
 * `panels` are PanelChrome panels the drawer borrows and moves in; `elements`
 * are moved without a collapse state, into the hosted node `homes` names for
 * them when there is one; `rows` names the Layers row whose group shows one.
 * `opens` lists nested panels whose expansion opens the destination of the
 * panel that contains them.
 */
export const DRAWER_DESTINATIONS = Object.freeze(
  [
    {
      id: 'layers',
      icon: 'layers',
      label: msg('Layers'),
      subtitle: msg('Choose what appears on the globe'),
      panels: ['data-panel', 'weather-panel', 'recent-imagery-panel'],
      // Radio lives under Layers → Audio: the one Radio panel moves from
      // Context into that group, after its layer row, with its own
      // disclosure, and expanding it opens Layers.
      elements: ['radio-panel'],
      homes: { 'radio-panel': '[data-layer-group="Audio"]' },
      rows: { 'radio-panel': 'radio' },
      opens: ['radio-panel'],
    },
    {
      id: 'inspect',
      icon: 'my_location',
      label: msg('Inspect'),
      subtitle: msg('Contacts, missions and cameras'),
      panels: ['global-context-panel', 'cctv-panel', 'street-level-panel'],
      homes: {
        'cctv-panel': '#context-cameras-view',
        'street-level-panel': '#context-cameras-view',
      },
      revealAnchors: {
        'cctv-panel': '#global-context-cameras-btn',
        'street-level-panel': '#sl-status',
      },
    },
    {
      id: 'map',
      icon: 'map',
      label: msg('Map'),
      title: msg('Map & Look'),
      subtitle: msg('Change the map style and image appearance'),
      // Location moves to the header (shellChrome.js).
      panels: ['pp-toggles'],
      opens: ['param-slider-panel'],
    },
    {
      id: 'stories',
      icon: 'local_movies',
      label: msg('Stories'),
      subtitle: msg('Watch a story or create your own'),
      panels: ['scene-panel'],
    },
    {
      id: 'tools',
      icon: 'design_services',
      label: msg('Tools'),
      subtitle: msg('Import, draw, and plan routes'),
      panels: [],
      // The existing views move from Display/Layers; their home hides them.
      elements: [
        'geo-import-group',
        'draw-group',
        'directions-controls-body',
        'tools-scene-import',
      ],
    },
    {
      id: 'settings',
      icon: 'settings',
      label: msg('Settings'),
      subtitle: msg('Configure data providers and preferences.'),
      panels: [],
      elements: ['corner-actions'],
    },
  ].map((destination) => Object.freeze(destination)),
);

/** Expanded for the drawer only: not persisted and not shared. */
const BORROW = Object.freeze({ persist: false, syncShare: false });
// Hosted panels whose collapse control the drawer header carries: each
// destination's own panel. Sections inside one (Inspect's cameras and Radio)
// keep their disclosures.
const HEADER_COLLAPSE_PANELS = Object.freeze([
  'data-panel',
  'scene-panel',
  'global-context-panel',
]);

/**
 * Own which drawer destination is open, and host its legacy panels while it
 * is. Opening borrows the panels (expanded without persisting or syncing
 * share), moves them into the drawer behind a placeholder and keeps their
 * ids; closing moves them back and restores what the drawer changed, unless
 * the user changed it since. Panel state stays with PanelChrome: a panel
 * expanded elsewhere (voice, share restore, harnesses) opens its destination
 * through PanelChrome's channel. The drawer rests on phones, where the sheets
 * borrow the same panels, and while Cockpit owns the screen.
 * @param {object} options
 * @param {Document} options.document
 * @param {{subscribe: Function}} options.panelChannel PanelChrome.channel
 * @param {(id: string, collapsed: boolean, options: object) => void} options.setPanelCollapsed
 * @param {string[]} options.restoreOrder Panel ids in share-restore order.
 * @param {MediaQueryList|null} [options.phone] The phone-shell media query.
 * @param {(panelId: string) => void} [options.onRevealPanel] Select a hosted view before scrolling to its panel.
 */
export function createDrawerNavigation({
  document: doc,
  panelChannel,
  setPanelCollapsed,
  restoreOrder,
  phone = null,
  isPhonePresenting = () => false,
  onRevealPanel = () => {},
}) {
  const host = doc.createElement('div');
  host.id = 'gev-legacy-host';
  host.className = 'gev-legacy-host';
  // The drawer header's place for a hosted panel's own collapse control.
  const headerActions = doc.createElement('span');
  headerActions.className = 'gev-drawer-panel-actions';
  const byId = new Map(DRAWER_DESTINATIONS.map((item) => [item.id, item]));
  const hostOf = new Map(
    DRAWER_DESTINATIONS.flatMap((item) =>
      item.panels.map((id) => [id, item.id]),
    ),
  );
  // Nested panels open the destination of the panel that contains them.
  const destinationOf = new Map([
    ...hostOf,
    ...DRAWER_DESTINATIONS.flatMap((item) =>
      (item.opens ?? []).map((id) => [id, item.id]),
    ),
  ]);
  // What shows a destination at startup and after a restore: its hosted
  // panels, and the nested panels it moves in as elements (Radio).
  const followed = new Map([
    ...hostOf,
    ...DRAWER_DESTINATIONS.flatMap((item) =>
      (item.opens ?? [])
        .filter((id) => item.elements?.includes(id))
        .map((id) => [id, item.id]),
    ),
  ]);
  let current = null;
  let resumeAfterCockpit = null;
  let resumeAfterPhone = null;
  // The lead panel of a restore made at phone width, kept for desktop width.
  let leadAfterPhone = null;
  let cockpit = doc.body?.classList.contains('cockpit-mode') ?? false;
  let destroyed = false;
  // What the open destination changed: the state found and the state set.
  let borrowed = null;
  let returnFocus = null;
  let panels = {};
  // The drawer's own borrowing publishes too; it is not a request to move.
  let moving = false;
  const removers = [];
  const channel = createStateChannel(() => ({
    destination: current,
    active: isActive(),
  }));

  function isActive() {
    return !destroyed && !cockpit && !phone?.matches;
  }
  const isCollapsed = (id) =>
    doc.getElementById(id)?.classList.contains('collapsed') ?? true;
  const shown = (id) => {
    const panel = doc.getElementById(id);
    return Boolean(panel && !panel.hidden && !isCollapsed(id));
  };

  // Outside Cyber, a hosted panel's own collapse control sits in the drawer
  // header beside Close, whether the panel is open or collapsed, so it can
  // always be expanded again there. It is the same button, with its binding
  // and state; it goes back to its panel header when the panel leaves the
  // drawer or Cyber takes over, whose panels keep their own header row.
  const collapseHomes = new Map();
  function placeCollapseControls() {
    const cyber = doc.documentElement?.dataset.uiTheme === 'cyber';
    for (const id of HEADER_COLLAPSE_PANELS) {
      const panel = doc.getElementById(id);
      let entry = collapseHomes.get(id);
      if (!entry) {
        const button = panel?.querySelector(
          `.panel-header > .panel-collapse-btn[data-collapse-target="${id}"]`,
        );
        if (!button) continue;
        const home = doc.createComment(`gev-collapse-home:${id}`);
        button.before(home);
        entry = { button, home };
        collapseHomes.set(id, entry);
      }
      const { button, home } = entry;
      const inHeader = !destroyed && !cyber && host.contains(panel);
      const focused = doc.activeElement === button;
      if (inHeader && button.parentNode !== headerActions)
        headerActions.append(button);
      else if (!inHeader && button.parentNode === headerActions)
        home.after(button);
      else continue;
      if (focused) button.focus({ preventScroll: true });
    }
  }

  function borrow(destination) {
    borrowed = { before: new Map(), applied: new Map(), moved: [] };
    for (const id of [...destination.panels, ...(destination.elements ?? [])]) {
      const node = doc.getElementById(id);
      if (!node?.parentNode) continue;
      const placeholder = doc.createComment(`gev-drawer-home:${id}`);
      node.before(placeholder);
      const home = destination.homes?.[id];
      (home ? (host.querySelector(home) ?? host) : host).append(node);
      borrowed.moved.push({ node, placeholder });
    }
    for (const id of destination.panels) {
      if (!doc.getElementById(id)) continue;
      borrowed.before.set(id, isCollapsed(id));
      if (isCollapsed(id)) setPanelCollapsed(id, false, BORROW);
    }
    for (const id of borrowed.before.keys())
      borrowed.applied.set(id, isCollapsed(id));
    placeCollapseControls();
  }

  function giveBack() {
    const previous = borrowed;
    borrowed = null;
    if (!previous) return;
    for (const { node, placeholder } of previous.moved)
      if (placeholder.parentNode) {
        // A mounted view may already have removed its root during teardown.
        if (node.parentNode) placeholder.replaceWith(node);
        else placeholder.remove();
      }
    placeCollapseControls();
    for (const [id, before] of previous.before)
      if (
        isCollapsed(id) === previous.applied.get(id) &&
        before !== isCollapsed(id)
      )
        setPanelCollapsed(id, before, BORROW);
  }

  /** Open a destination; the one already open stays as it is. */
  function open(id, { focusReturn = null } = {}) {
    const destination = byId.get(id);
    if (!isActive() || !destination) return false;
    if (current === id) return true;
    moving = true;
    try {
      giveBack();
      current = id;
      returnFocus = focusReturn;
      borrow(destination);
    } finally {
      moving = false;
    }
    channel.publish({ type: 'opened', destination: id });
    return true;
  }

  /**
   * Close the drawer; `focus` returns focus to whatever opened it, or to the
   * destination's rail button when it opened another way (a panel expanded
   * by voice, a shortcut or a share).
   */
  function close({ focus = false } = {}) {
    if (!current) return;
    const previous = current;
    current = null;
    moving = true;
    try {
      giveBack();
    } finally {
      moving = false;
    }
    channel.publish({ type: 'closed', destination: previous });
    const target = returnFocus?.isConnected
      ? returnFocus
      : doc.querySelector(`.gev-rail-item[data-destination="${previous}"]`);
    returnFocus = null;
    if (focus) target?.focus();
  }

  // A nested panel (Radio) sits deep in its destination; showing it scrolls
  // to it there, as it showed inside its container before. A Layers filter or
  // tab may hide its row's group: the list's own reveal shows the group first,
  // and the scroll waits for that paint.
  async function revealNested(id) {
    const destination = byId.get(destinationOf.get(id));
    const home = destination?.homes?.[id];
    const node = hostOf.has(id) && !home ? null : doc.getElementById(id);
    if (!node || !host.contains(node)) return;
    // A restored child can be expanded while its borrowed host is collapsed.
    // Re-borrow the ancestors without changing their restored/share preference.
    for (
      let parent = node.parentElement?.closest('[data-panel-id]');
      parent && host.contains(parent);
      parent = parent.parentElement?.closest('[data-panel-id]')
    ) {
      if (!borrowed?.before.has(parent.id) || !isCollapsed(parent.id)) continue;
      if (isCollapsed(parent.id) !== borrowed.applied.get(parent.id))
        borrowed.before.set(parent.id, isCollapsed(parent.id));
      moving = true;
      try {
        setPanelCollapsed(parent.id, false, BORROW);
        borrowed.applied.set(parent.id, isCollapsed(parent.id));
      } finally {
        moving = false;
      }
    }
    const row = destination?.rows?.[id];
    if (row) {
      node.dispatchEvent(
        new doc.defaultView.CustomEvent('gev:focus-layer-row', {
          bubbles: true,
          detail: row,
        }),
      );
      await flushViews();
      if (!host.contains(node)) return;
    }
    const anchor = destination?.revealAnchors?.[id];
    if (anchor) {
      await flushViews();
      const target = host.querySelector(anchor);
      target?.scrollIntoView?.({ block: 'start' });
    } else node.scrollIntoView?.({ block: 'nearest' });
  }

  /**
   * The first shown followed panel, in share-restore order, picks the
   * destination: an expanded Radio opens Layers, where it lives, before the
   * Context that contains it at home. A restore may name the panel it leads
   * with, standing in for one that no longer exists (a retired dock tray).
   */
  function followPanels(lead = null) {
    const first =
      lead && followed.has(lead) && shown(lead)
        ? lead
        : restoreOrder.find((id) => followed.has(id) && shown(id));
    if (!first) return close();
    open(followed.get(first));
    onRevealPanel(first);
    void revealNested(first);
  }

  // A panel expanded outside the drawer opens its destination, and so does an
  // explicit request to show one that is already expanded: in one drawer,
  // expanded is not visible. Presentation changes (a rail's automatic
  // restore) and a share restore in progress do not; a restore picks its
  // destination once it ends.
  removers.push(
    panelChannel.subscribe(({ state, change }) => {
      const previous = panels;
      panels = state.panels ?? {};
      if (moving || state.restoring) return;
      if (!isActive()) {
        // Borrowing a sheet is presentation, not a new panel preference.
        if (isPhonePresenting()) return;
        if (change?.type === 'panel-revealed') onRevealPanel(change.panelId);
        else if (change?.type === 'panels-restored') {
          const first = restoreOrder.find(
            (id) => followed.has(id) && shown(id),
          );
          if (first) onRevealPanel(first);
        }
        // A panel the user expands on the phone, or a share or history
        // restore there, picks the destination back at desktop width, over
        // the one open when the phone layout began. A restore keeps its lead
        // until a later change supersedes it.
        if (change?.type === 'panels-restored') {
          resumeAfterPhone = null;
          leadAfterPhone = change.lead ?? null;
        } else if (
          change?.type === 'panel-revealed' ||
          Object.entries(panels).some(
            ([id, next]) =>
              destinationOf.has(id) &&
              previous[id]?.collapsed &&
              !previous[id].autoCollapsed &&
              !next.collapsed,
          )
        ) {
          resumeAfterPhone = null;
          leadAfterPhone = null;
        }
        return;
      }
      if (change?.type === 'panels-restored') {
        // A restore sets the panels' own state: a borrowed panel now is what
        // it shows, not what the drawer found when it borrowed it.
        for (const id of change.panelIds ?? [])
          if (borrowed?.before.has(id)) {
            borrowed.before.set(id, isCollapsed(id));
            borrowed.applied.set(id, isCollapsed(id));
          }
        return followPanels(change.lead);
      }
      if (change?.type === 'panel-revealed') {
        const destination = destinationOf.get(change.panelId);
        if (!destination) return;
        open(destination);
        onRevealPanel(change.panelId);
        return void revealNested(change.panelId);
      }
      for (const [id, next] of Object.entries(panels)) {
        const was = previous[id];
        const destination = destinationOf.get(id);
        if (
          !destination ||
          !was?.collapsed ||
          was.autoCollapsed ||
          next.collapsed
        )
          continue;
        if (destination !== current) {
          open(destination);
          onRevealPanel(id);
          void revealNested(id);
          return;
        }
        onRevealPanel(id);
        void revealNested(id);
      }
    }),
  );

  // Weather and imagery panels appear when their layers do. With the drawer
  // closed, that appearance opens their destination; in the open destination
  // it scrolls the panel into view, as it shows on the rail today.
  const Observer = doc.defaultView?.MutationObserver;
  if (Observer) {
    const observer = new Observer((records) => {
      if (!isActive()) return;
      for (const { target } of records) {
        if (!hostOf.has(target.id) || !shown(target.id)) continue;
        if (!current) open(hostOf.get(target.id));
        if (current === hostOf.get(target.id))
          target.scrollIntoView?.({ block: 'nearest' });
        return;
      }
    });
    for (const id of hostOf.keys()) {
      const panel = doc.getElementById(id);
      if (panel)
        observer.observe(panel, {
          attributes: true,
          attributeFilter: ['hidden'],
        });
    }
    removers.push(() => observer.disconnect());
  }

  // Back at desktop width the drawer reopens the destination it showed when
  // the phone layout took over, as Cockpit's exit does; with none open then,
  // it shows what the panels show, as at startup. The phone shell's query was
  // created first, so its sheet has already given its panels back. Back at
  // desktop width in Cockpit, Cockpit's exit restores its own state, and the
  // destination from before the phone layout is forgotten.
  // A resize through the phone width and back can deliver both changes after
  // it ends, each reading the width it ended at: only an actual change of
  // layout moves the drawer.
  let phoneLayout = phone?.matches ?? false;
  const onPhone = () => {
    if (phone.matches === phoneLayout) return;
    phoneLayout = phone.matches;
    if (phoneLayout) {
      resumeAfterPhone = current;
      leadAfterPhone = null;
      close();
    }
    channel.publish({ type: 'active-changed' });
    if (!isActive()) {
      if (!phoneLayout) resumeAfterPhone = leadAfterPhone = null;
      return;
    }
    const resumed = resumeAfterPhone;
    const lead = leadAfterPhone;
    resumeAfterPhone = leadAfterPhone = null;
    if (resumed) open(resumed);
    else followPanels(lead);
  };
  if (phone?.addEventListener) {
    phone.addEventListener('change', onPhone);
    removers.push(() => phone.removeEventListener('change', onPhone));
  }
  // Cockpit owns the screen. Its panel hooks suspend the drawer before its
  // entry snapshot and resume it after its exit restoration, so the snapshot
  // holds the panels' own state. The body class, the signal the phone shell
  // and first run yield to as well, settles a Cockpit without those hooks:
  // its event at once, the class alone before the next frame.
  function suspend() {
    if (destroyed || cockpit) return;
    resumeAfterCockpit = current;
    close();
    cockpit = true;
    channel.publish({ type: 'active-changed' });
  }
  function resume() {
    if (destroyed || !cockpit) return;
    cockpit = false;
    channel.publish({ type: 'active-changed' });
    if (resumeAfterCockpit) open(resumeAfterCockpit);
    resumeAfterCockpit = null;
  }
  const syncCockpit = () => {
    if (doc.body?.classList.contains('cockpit-mode')) suspend();
    else resume();
  };
  const win = doc.defaultView;
  win?.addEventListener('gev:cockpit-mode-changed', syncCockpit);
  removers.push(() =>
    win?.removeEventListener('gev:cockpit-mode-changed', syncCockpit),
  );
  if (Observer && doc.body) {
    const bodyObserver = new Observer(syncCockpit);
    bodyObserver.observe(doc.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
    removers.push(() => bodyObserver.disconnect());
  }

  if (doc.documentElement && doc.defaultView?.MutationObserver) {
    const themeObserver = new doc.defaultView.MutationObserver(
      placeCollapseControls,
    );
    themeObserver.observe(doc.documentElement, {
      attributes: true,
      attributeFilter: ['data-ui-theme'],
    });
    removers.push(() => themeObserver.disconnect());
  }

  return {
    host,
    headerActions,
    channel,
    open,
    close,
    /** Open a closed or different destination, or close the open one. */
    toggle(id, options) {
      if (current !== id) return open(id, options);
      close(options);
      return true;
    },
    /** Open the destination the panels already show, as a share restore does. */
    followPanels,
    /** Give every borrowed panel back and rest, as Cockpit entry needs. */
    suspend,
    /** Reopen the destination open at suspend, after Cockpit exit. */
    resume,
    /**
     * The collapsed state to share for a panel the drawer borrowed: its state
     * before the drawer, or the user's own change since. Undefined otherwise.
     */
    sharedCollapsed(id) {
      if (!borrowed?.before.has(id)) return undefined;
      const now = isCollapsed(id);
      return now !== borrowed.applied.get(id) ? now : borrowed.before.get(id);
    },
    destroy() {
      if (destroyed) return;
      close();
      destroyed = true;
      placeCollapseControls();
      for (const remove of removers.splice(0)) remove();
      host.remove();
      channel.destroy();
    },
  };
}
