/**
 * Phone shell for narrow viewports (≤720px). The globe stays full screen and a
 * bottom tab bar opens one sheet at a time; each sheet shows existing panels,
 * which move from their desktop homes into one sheet and return on close.
 * Desktop never sees the class or the sheet state.
 *
 * Sheets borrow panels: the panels a sheet expands are put back exactly as
 * they were when the sheets close, and nothing a sheet does is persisted or
 * treated as the user's own panel choice.
 *
 * Adapted from the phone tab-shell proposed in public PR #203 by blearymoth.
 */

import { EXCLUSIVE_SURFACE_CLASSES } from '../exclusiveSurfaces.js';
import { createStateChannel } from '../app/stateChannel.js';
import { createPhoneChrome } from './phoneChrome.js';
import {
  MOBILE_SHEET_PANELS,
  MOBILE_SHEET_ELEMENTS,
  MOBILE_TABS,
  MOBILE_MORE_DESTINATIONS,
} from './phoneDestinations.js';
export { MOBILE_SHEET_PANELS, MOBILE_TABS } from './phoneDestinations.js';

export const MOBILE_SHELL_MEDIA_QUERY = '(max-width: 720px)';
export const MOBILE_SHELL_CLASS = 'mobile-shell';
export const MOBILE_SHEET_ATTR = 'data-mobile-sheet';

/**
 * Surfaces that own the screen close the open sheet and keep sheets closed.
 * Scene playback is the exception: its STOP control lives in the Stories panel
 * (More sheet), and a phone has no Escape key to stop it otherwise.
 */
const SHEET_BLOCKING_CLASSES = Object.freeze([
  ...EXCLUSIVE_SURFACE_CLASSES.filter((name) => name !== 'scene-playback-mode'),
  'ui-embed',
]);

/** Every panel any sheet borrows; the dock trays close each other. */
const BORROWED_PANELS = Object.freeze([
  ...new Set([
    ...Object.values(MOBILE_SHEET_PANELS).flat(),
    ...Object.values(MOBILE_SHEET_ELEMENTS).flat(),
  ]),
]);

const BORROW_OPTIONS = Object.freeze({ persist: false, syncShare: false });

/**
 * @param {string} panelId
 * @returns {string|null} The sheet that presents `panelId`.
 */
export function sheetForPanelId(panelId) {
  for (const [sheet, ids] of Object.entries(MOBILE_SHEET_PANELS)) {
    if (ids.includes(panelId)) return sheet;
  }
  for (const [sheet, ids] of Object.entries(MOBILE_SHEET_ELEMENTS))
    if (ids.includes(panelId)) return sheet;
  if (MOBILE_MORE_DESTINATIONS.some((item) => item.elements.includes(panelId)))
    return 'more';
  return null;
}

/**
 * The sheet after a tab press: the same tab closes its sheet, another opens.
 * @param {string|null} current
 * @param {string|null} pressed
 * @returns {string|null}
 */
export function nextSheet(current, pressed) {
  if (!pressed || !Object.hasOwn(MOBILE_SHEET_PANELS, pressed)) return null;
  return current === pressed ? null : pressed;
}

function sheetBlocked(body) {
  return SHEET_BLOCKING_CLASSES.some(
    (name) =>
      body.classList.contains(name) &&
      !(
        name === 'recording-mode' &&
        body.classList.contains('scene-playback-mode')
      ),
  );
}

/**
 * Wires the phone shell: the media gate, tab bar, backdrop, Escape, focus,
 * and closing for full-screen modes.
 * @param {object} input
 * @param {(panelId: string, collapsed: boolean, options?: object) => void} input.setPanelCollapsed
 * @param {Document} [input.documentRef]
 * @param {(query: string) => MediaQueryList} [input.matchMedia]
 * @param {typeof MutationObserver} [input.MutationObserverImpl]
 * @param {typeof ResizeObserver} [input.ResizeObserverImpl]
 * @param {(callback: () => void) => number} [input.requestFrame]
 * @param {() => void} [input.onSheetsClosed] Runs after the last sheet closes
 *   and its panels are put back (e.g. to refresh the share link).
 * @param {(sheet: string) => void} [input.onTabOpened] Runs only when the user
 *   opens a sheet from its tab, never on close or programmatic presentation.
 * @returns {{ destroy: () => void, setSheet: (sheet: string|null) => void, getSheet: () => string|null, sharedCollapsed: (panelId: string) => boolean|undefined }}
 */
export function initMobileShell({
  setPanelCollapsed,
  documentRef = globalThis.document,
  matchMedia = globalThis.matchMedia?.bind(globalThis),
  MutationObserverImpl = globalThis.MutationObserver,
  ResizeObserverImpl = globalThis.ResizeObserver,
  requestFrame = globalThis.requestAnimationFrame?.bind(globalThis),
  onSheetsClosed = () => {},
  onTabOpened = () => {},
  appearance = null,
  settingsSurface = null,
  panelChannel = null,
  restoreOrder = [],
  mountChrome = createPhoneChrome,
} = {}) {
  const body = documentRef.body;
  let chrome, backdrop, tabBar;
  let active = false;
  let destination = MOBILE_MORE_DESTINATIONS[0].id;
  let destroyed = false;
  let placed = [];
  let presenting = false;
  const presentPanel = (...args) => {
    const previous = presenting;
    presenting = true;
    try {
      return setPanelCollapsed(...args);
    } finally {
      presenting = previous;
    }
  };
  const viewport = documentRef.querySelector('meta[name="viewport"]');
  const viewportContent = viewport?.getAttribute('content') ?? null;
  const removers = [];
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  };
  const element = (id) => documentRef.getElementById(id);
  const rails = ['left-panel-stack', 'right-context-rail']
    .map(element)
    .filter(Boolean);
  const dock = element('command-dock');
  const shown = (node) =>
    node && globalThis.getComputedStyle?.(node).display !== 'none';

  let currentSheet = null;
  const snapshot = () => ({
    active: active && !sheetBlocked(body),
    sheet: currentSheet,
    destination,
    playback: body.classList.contains('scene-playback-mode'),
  });
  const channel = createStateChannel(snapshot);
  let painted = '';
  const paint = () => {
    const state = snapshot(),
      signature = JSON.stringify(state);
    if (signature === painted) return;
    painted = signature;
    chrome?.update(state);
    channel.publish({
      type: 'sheet-changed',
      sheet: currentSheet,
      destination,
    });
  };
  const destinationOf = () =>
    MOBILE_MORE_DESTINATIONS.find((item) => item.id === destination);
  const panelsFor = (sheet) =>
    sheet === 'more'
      ? destinationOf().panels
      : (MOBILE_SHEET_PANELS[sheet] ?? []);
  const restoreNodes = () => {
    for (const { node, home } of placed.reverse()) {
      if (node.isConnected) home.replaceWith(node);
      else home.remove();
    }
    placed = [];
  };
  const placeNodes = (sheet) => {
    if (!chrome.host || !sheet) return;
    const ids = [
      ...panelsFor(sheet),
      ...(sheet === 'more'
        ? destinationOf().elements
        : (MOBILE_SHEET_ELEMENTS[sheet] ?? [])),
    ];
    for (const id of ids) {
      const node = element(id);
      if (!node?.parentNode) continue;
      const home = documentRef.createComment('phone panel home');
      node.before(home);
      placed.push({ node, home });
      chrome.host.append(node);
    }
  };
  /**
   * Panel states from before the first sheet opened (`before`) and right after
   * the open sheet was set up (`applied`); null when closed.
   */
  let borrowed = null;
  let returnFocus = null;
  let swipe = null;
  const written = new Map();

  const writeVar = (name, value) => {
    if (written.get(name) === value) return;
    written.set(name, value);
    body.style.setProperty(name, value);
  };

  // The dock (Presets, Search) sits on top of whichever rail is the sheet,
  // and the required map attribution sits above everything the sheet covers.
  const measureSheet = () => {
    if (!body.classList.contains(MOBILE_SHELL_CLASS)) return;
    const height = Math.max(
      0,
      ...[
        ...rails,
        ...(currentSheet && chrome.surface ? [chrome.surface] : []),
      ].map((rail) => (shown(rail) ? rail.getBoundingClientRect().height : 0)),
    );
    writeVar('--mobile-sheet-height', `${Math.round(height)}px`);
    const viewportHeight = globalThis.innerHeight || 0;
    const cover = Math.max(
      0,
      ...[
        ...rails,
        currentSheet ? dock : null,
        currentSheet ? chrome.surface : null,
      ]
        .filter(shown)
        .map((node) => viewportHeight - node.getBoundingClientRect().top),
    );
    writeVar('--mobile-sheet-cover', `${Math.round(cover)}px`);
  };

  const resize =
    typeof ResizeObserverImpl === 'function'
      ? new ResizeObserverImpl(measureSheet)
      : null;
  removers.push(() => resize?.disconnect());

  const isCollapsed = (panelId) =>
    element(panelId)?.classList.contains('collapsed') ?? true;
  // The user's preference, as share links record it: a collapse that layout
  // applies only for space (Tactical, Cyber) still counts as expanded.
  const prefersCollapsed = (panelId) => {
    const classes = element(panelId)?.classList;
    if (!classes) return true;
    return (
      classes.contains('collapsed') &&
      !classes.contains('layout-auto-collapsed') &&
      !classes.contains('cyber-accordion-collapsed')
    );
  };

  const panelStates = () =>
    new Map(
      BORROWED_PANELS.map((panelId) => [panelId, prefersCollapsed(panelId)]),
    );

  // Undo only what opening the sheet did (including side effects, such as dock
  // trays closing each other). A panel the user changed since stays as they
  // left it, and becomes the state later sheets put back.
  const restoreBorrowed = () => {
    if (!borrowed) return;
    for (const [panelId, before] of borrowed.before) {
      const now = prefersCollapsed(panelId);
      if (now !== borrowed.applied.get(panelId))
        borrowed.before.set(panelId, now);
      else if (now !== before) presentPanel(panelId, before, BORROW_OPTIONS);
    }
  };

  const present = (sheet) => {
    currentSheet = sheet;
    if (sheet) body.setAttribute(MOBILE_SHEET_ATTR, sheet);
    else body.removeAttribute(MOBILE_SHEET_ATTR);
    paint();
    measureSheet();
  };

  /** The first visible control of the sheet's first panel, for focus on open. */
  const sheetFocusTarget = (sheet) => {
    if (sheet === 'search') return element('location-search');
    const panel = element(
      panelsFor(sheet)[0] ??
        (sheet === 'more'
          ? destinationOf().elements[0]
          : MOBILE_SHEET_ELEMENTS[sheet]?.[0]),
    );
    const controls =
      panel?.querySelectorAll?.(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [];
    // Sheets hide some panel chrome (tray toggles, pins) that stays in the
    // DOM, and a panel's own collapse control is a poor first stop. A roving
    // tab set's unselected tabs are out of the tab order.
    return (
      [...controls].find(
        (control) =>
          control.getClientRects().length > 0 &&
          control.getAttribute?.('tabindex') !== '-1' &&
          !control.matches?.('.panel-collapse-btn'),
      ) ??
      chrome.surface?.querySelector('.phone-sheet-header button') ??
      null
    );
  };

  const setSheet = (requested, { force = false } = {}) => {
    swipe = null;
    if (destroyed || !active) return false;
    if (
      body.classList.contains('scene-playback-mode') &&
      Object.hasOwn(MOBILE_SHEET_PANELS, requested)
    ) {
      requested = 'more';
      force ||= destination !== 'stories';
      destination = 'stories';
    }
    const sheet =
      sheetBlocked(body) || !Object.hasOwn(MOBILE_SHEET_PANELS, requested)
        ? null
        : requested;
    const previous = currentSheet;
    if (previous === sheet && !force) return sheet !== null;
    if (!previous) {
      borrowed = { before: panelStates(), applied: panelStates() };
      returnFocus = documentRef.activeElement ?? null;
    } else {
      if (previous === 'search') element('location-search')?.blur?.();
      restoreBorrowed();
    }
    restoreNodes();
    present(sheet);
    if (!sheet) {
      borrowed = null;
      onSheetsClosed();
      const focus = returnFocus;
      returnFocus = null;
      if (focus && focus !== body && body.contains?.(focus)) focus.focus?.();
      return;
    }
    placeNodes(sheet);
    if (chrome.scrollArea) chrome.scrollArea.scrollTop = 0;
    for (const panelId of panelsFor(sheet))
      if (isCollapsed(panelId)) presentPanel(panelId, false, BORROW_OPTIONS);
    borrowed.applied = panelStates();
    // Rail layout settles on a later frame; what it does is part of opening.
    const opening = (borrowed.opening ?? 0) + 1;
    borrowed.opening = opening;
    const opened = borrowed;
    requestFrame?.(() => {
      if (borrowed === opened && opened.opening === opening)
        opened.applied = panelStates();
    });
    measureSheet();
    sheetFocusTarget(sheet)?.focus?.();
    return true;
  };

  const setDestination = (value) => {
    if (
      destroyed ||
      !active ||
      (body.classList.contains('scene-playback-mode') && value !== 'stories') ||
      !MOBILE_MORE_DESTINATIONS.some((item) => item.id === value)
    )
      return false;
    const changed = destination !== value;
    destination = value;
    return setSheet('more', { force: changed });
  };
  const reveal = (panelId) => {
    const sheet = sheetForPanelId(panelId);
    if (!sheet) return false;
    if (sheet === 'more') {
      const item = MOBILE_MORE_DESTINATIONS.find((item) =>
        [...item.panels, ...item.elements].includes(panelId),
      );
      return item ? setDestination(item.id) : false;
    }
    const shown = setSheet(sheet);
    if (shown)
      requestFrame?.(() => {
        const node = element(panelId);
        if (currentSheet === sheet && chrome.host?.contains(node))
          node.scrollIntoView?.({ block: 'nearest' });
      });
    return shown;
  };
  const pressTab = (value) => {
    const sheet = nextSheet(currentSheet, value);
    if (!sheet) returnFocus = tabFor(value);
    setSheet(sheet);
    if (sheet && currentSheet === sheet) onTabOpened(sheet);
  };
  const tabFor = (sheet) =>
    [...tabBar.querySelectorAll('[data-mobile-sheet]')].find(
      (button) => button.dataset.mobileSheet === sheet,
    );

  const onMedia = (matches) => {
    if (matches) {
      active = true;
      body.classList.add(MOBILE_SHELL_CLASS);
      // Lets the page draw under the notch and system bars; the shell's CSS
      // keeps its chrome clear of them.
      if (viewport && !/viewport-fit\s*=/.test(viewportContent || ''))
        viewport.setAttribute(
          'content',
          `${viewportContent || ''}, viewport-fit=cover`,
        );
      for (const node of [...rails, dock, chrome.surface].filter(Boolean))
        resize?.observe(node);
      measureSheet();
    } else {
      // Crossing to desktop closes the sheet, which puts its panels back.
      setSheet(null);
      active = false;
      body.classList.remove(MOBILE_SHELL_CLASS);
      present(null);
      resize?.disconnect();
      if (viewport && viewportContent !== null)
        viewport.setAttribute('content', viewportContent);
    }
    paint();
  };

  chrome = mountChrome({
    documentRef,
    state: snapshot(),
    appearance,
    settingsSurface,
    actions: {
      close: () => {
        returnFocus = tabFor(currentSheet) ?? returnFocus;
        setSheet(null);
      },
      destination: setDestination,
      tab: pressTab,
    },
  });
  ({ backdrop, tabBar } = chrome);
  const media =
    typeof matchMedia === 'function'
      ? matchMedia(MOBILE_SHELL_MEDIA_QUERY)
      : null;
  onMedia(Boolean(media?.matches));
  const onChange = (event) => onMedia(event.matches);
  if (media?.addEventListener) {
    media.addEventListener('change', onChange);
    removers.push(() => media.removeEventListener('change', onChange));
  } else if (media?.addListener) {
    // Safari before 14 only offers the legacy listener API.
    media.addListener(onChange);
    removers.push(() => media.removeListener(onChange));
  }

  // Touch events let native scrolling continue until a downward pull at the
  // top is intentional. Pointer capture/touch-action:none would also seize
  // ordinary vertical scrolling inside the borrowed panels.
  const sheetRoot = (target, sheet) => {
    if (chrome.surface?.contains(target)) return chrome.surface;
    const roots =
      sheet === 'layers'
        ? [element('left-panel-stack')]
        : sheet === 'search'
          ? [dock]
          : sheet === 'more'
            ? [element('right-context-rail'), dock]
            : [element('right-context-rail')];
    return roots.find((root) => root?.contains(target));
  };
  const scrolled = (target, root) => {
    if (chrome.scrollArea?.scrollTop > 0) return true;
    for (let node = target; node; node = node.parentElement) {
      if (node.scrollTop > 0) return true;
      if (node === root) break;
    }
    return false;
  };
  listen(
    documentRef,
    'touchstart',
    (event) => {
      swipe = null;
      const sheet = currentSheet;
      const target = event.target;
      if (
        !sheet ||
        !body.classList.contains(MOBILE_SHELL_CLASS) ||
        event.defaultPrevented ||
        event.touches.length !== 1 ||
        target?.closest?.(
          'button, a, input, select, textarea, label, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="button"]',
        )
      )
        return;
      const root = sheetRoot(target, sheet);
      if (!root || scrolled(target, root)) return;
      const touch = event.touches[0];
      swipe = {
        sheet,
        target,
        root,
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        claimed: false,
      };
    },
    { passive: true },
  );
  listen(
    documentRef,
    'touchmove',
    (event) => {
      if (!swipe) return;
      const touch = event.touches[0];
      if (
        event.defaultPrevented ||
        event.touches.length !== 1 ||
        touch.identifier !== swipe.id ||
        currentSheet !== swipe.sheet ||
        scrolled(swipe.target, swipe.root)
      ) {
        swipe = null;
        return;
      }
      const dx = touch.clientX - swipe.x;
      const dy = touch.clientY - swipe.y;
      if (!swipe.claimed) {
        // Claim direction before the browser crosses its native scroll slop.
        // Android can make the next move non-cancelable after a ~9px first move.
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 4) return;
        if (dy <= Math.abs(dx) * 1.25 || !event.cancelable) {
          swipe = null;
          return;
        }
        swipe.claimed = true;
      }
      // Cancelling only the claimed pull leaves taps, sliders and normal scroll
      // native, and suppresses the synthetic click at the end of a dismissal.
      event.preventDefault();
    },
    { passive: false },
  );
  listen(
    documentRef,
    'touchend',
    (event) => {
      const pull = swipe;
      swipe = null;
      if (!pull?.claimed || event.touches.length) return;
      const touch = [...event.changedTouches].find(
        (item) => item.identifier === pull.id,
      );
      if (!touch || currentSheet !== pull.sheet) return;
      const dx = Math.abs(touch.clientX - pull.x);
      const dy = touch.clientY - pull.y;
      if (dy < 64 || dy <= dx * 1.25) return;
      returnFocus = tabFor(pull.sheet) ?? returnFocus;
      setSheet(null);
    },
    { passive: true },
  );
  listen(
    documentRef,
    'touchcancel',
    () => {
      swipe = null;
    },
    { passive: true },
  );
  // Bubble phase, so fields cancelling an edit, lightboxes, viewers and tools
  // take Escape first; panels yield it to the sheet (PanelChrome), and an open
  // dialog keeps its own native close.
  listen(documentRef, 'keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const sheet = currentSheet;
    if (!sheet || documentRef.querySelector('dialog[open]')) return;
    event.preventDefault();
    returnFocus = tabFor(sheet) ?? returnFocus;
    setSheet(null);
  });

  if (typeof MutationObserverImpl === 'function') {
    const observer = new MutationObserverImpl(() => {
      if (currentSheet && sheetBlocked(body)) setSheet(null);
      else if (
        currentSheet &&
        body.classList.contains('scene-playback-mode') &&
        (currentSheet !== 'more' || destination !== 'stories')
      )
        setSheet('more', { force: true });
      else paint();
    });
    observer.observe(body, { attributes: true, attributeFilter: ['class'] });
    removers.push(() => observer.disconnect());
  }

  if (panelChannel)
    removers.push(
      panelChannel.subscribe(({ state, change, initial }) => {
        if (initial || state.restoring || presenting) return;
        if (change?.type === 'panels-restored') {
          // A history restore becomes the preference that sheet borrowing
          // returns, even when it restores an already expanded panel.
          for (const id of change.panelIds ?? [])
            if (borrowed?.before.has(id)) {
              const collapsed = prefersCollapsed(id);
              borrowed.before.set(id, collapsed);
              borrowed.applied.set(id, collapsed);
            }
          if (!active) return;
          const visible = (id) =>
            sheetForPanelId(id) &&
            element(id) &&
            !element(id).hidden &&
            !prefersCollapsed(id);
          const first = visible(change.lead)
            ? change.lead
            : restoreOrder.find(visible);
          if (first) reveal(first);
          else setSheet(null);
          return;
        }
        if (change?.type === 'panel-revealed') reveal(change.panelId);
      }),
    );

  return {
    channel,
    isPresenting: () => presenting,
    reveal,
    setDestination,
    toggle: (sheet) => setSheet(nextSheet(currentSheet, sheet)),
    setSheet,
    getSheet: () => currentSheet,
    /**
     * The collapsed state to share for a panel a sheet borrowed: its state
     * before the sheets, or the user's own change since. Undefined otherwise.
     */
    sharedCollapsed(panelId) {
      if (!borrowed?.before.has(panelId)) return undefined;
      const now = prefersCollapsed(panelId);
      return now !== borrowed.applied.get(panelId)
        ? now
        : borrowed.before.get(panelId);
    },
    destroy() {
      if (destroyed) return;
      setSheet(null);
      restoreNodes();
      destroyed = true;
      for (const remove of removers.splice(0)) remove();
      body.classList.remove(MOBILE_SHELL_CLASS);
      body.removeAttribute(MOBILE_SHEET_ATTR);
      body.style.removeProperty('--mobile-sheet-height');
      body.style.removeProperty('--mobile-sheet-cover');
      if (viewport && viewportContent !== null)
        viewport.setAttribute('content', viewportContent);
      chrome.destroy();
      channel.destroy();
    },
  };
}
