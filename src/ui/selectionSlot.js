import { createStateChannel } from '../app/stateChannel.js';

/**
 * The right-hand selection slot: one item at a time, shown over the globe on
 * desktop. An item mounts its own content into the slot's body (and header
 * buttons into its actions) and takes it back when unmounted; the slot
 * changes no state of its own, so ids, storage and share state stay with
 * their owners. A newer item replaces the current one. Close (× or Escape)
 * runs the item's own close path and then drops it, so it always closes.
 * The slot rests where the drawer does, on phones and in Cockpit: resting
 * unmounts the current item but keeps it, and coming back mounts it again.
 * @param {object} options
 * @param {Document} options.document
 * @param {boolean} [options.active] Whether the slot can show an item now.
 */
export function createSelectionSlot({ document: doc, active = true }) {
  const body = doc.createElement('div');
  body.className = 'gev-slot-body';
  const actions = doc.createElement('span');
  actions.className = 'gev-slot-actions';
  let item = null;
  let unmount = null;
  let returnFocus = null;
  let destroyed = false;
  const channel = createStateChannel(() => ({
    active,
    item: item
      ? { id: item.id, title: item.title ?? '', icon: item.icon ?? '' }
      : null,
  }));

  // The view's frame around the body, with its close button, once mounted.
  const frame = () => body.closest('.gev-slot');
  const contains = (node) =>
    Boolean(node) &&
    (body.contains(node) ||
      actions.contains(node) ||
      Boolean(frame()?.contains(node)));
  const FOCUSABLE =
    'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
  const focusable = (node) =>
    Boolean(node?.isConnected) &&
    node.matches?.(FOCUSABLE) &&
    !node.closest('[hidden]') &&
    (typeof node.checkVisibility !== 'function' || node.checkVisibility());

  /**
   * Keep keyboard focus with what the user was using. Moving content blurs a
   * focused node in it, and a header the slot hides (a borrowed panel's
   * disclosure) cannot hold focus. When showing an item took focus from the
   * user or out of the slot, it comes back to the node that had it, if that
   * is now usable in the slot, or else to the slot's first control (its
   * close button, or the item's own header control).
   */
  function keepFocus(focused, wasInSlot) {
    if (!active || !focused || focused === doc.body) return;
    const now = doc.activeElement;
    const lost = !now || now === doc.body || !focusable(now);
    if (!lost && !(wasInSlot && !contains(now))) return;
    if (contains(focused) && focusable(focused)) {
      focused.focus({ preventScroll: true });
      return;
    }
    const root = frame();
    (root ? [root] : [actions, body])
      .flatMap((root) => [...root.querySelectorAll(FOCUSABLE)])
      .find(focusable)
      ?.focus({ preventScroll: true });
  }

  function mount() {
    if (!item || unmount || !active || destroyed) return;
    unmount = item.mount?.({ body, actions }) ?? (() => {});
  }
  function release() {
    const take = unmount;
    unmount = null;
    take?.();
  }

  /**
   * Show an item, replacing the current one. Showing the current id again
   * refreshes its title and icon without remounting.
   * @param {{id: string, title?: string, icon?: string,
   *   mount?: (slot: {body: Element, actions: Element}) => (() => void),
   *   close?: () => void, replaced?: () => void}} next
   */
  function show(next) {
    if (destroyed || !next?.id) return false;
    if (item?.id === next.id) {
      item = { ...item, title: next.title, icon: next.icon };
      channel.publish({ type: 'updated', id: next.id });
      return true;
    }
    const previous = item;
    // Read focus before the current item goes: its release blurs a field in
    // it. An opener outside the slot is where closing returns focus; a
    // replacement made from inside the slot keeps the first opener.
    const focused = doc.activeElement;
    const wasInSlot = contains(focused);
    if (!wasInSlot)
      returnFocus = focused && focused !== doc.body ? focused : null;
    release();
    item = next;
    mount();
    channel.publish({ type: 'shown', id: next.id });
    keepFocus(focused, wasInSlot);
    previous?.replaced?.();
    return true;
  }

  function drop(type) {
    const previous = item;
    const hadFocus = contains(doc.activeElement);
    release();
    item = null;
    channel.publish({ type, id: previous.id });
    return hadFocus;
  }

  /** The owner withdraws its item; another item keeps the slot. */
  function hide(id) {
    if (destroyed || !item || item.id !== id) return;
    const hadFocus = drop('hidden');
    if (hadFocus) restoreFocus();
  }

  function restoreFocus() {
    const target = returnFocus?.isConnected ? returnFocus : null;
    returnFocus = null;
    target?.focus?.({ preventScroll: true });
  }

  /** × and Escape: the item's own close path, then the slot closes. */
  function close({ focus = false } = {}) {
    if (destroyed || !item) return;
    const closing = item;
    const hadFocus = contains(doc.activeElement);
    closing.close?.();
    if (item === closing) drop('closed');
    if (focus || hadFocus) restoreFocus();
    else returnFocus = null;
  }

  return {
    body,
    actions,
    channel,
    show,
    hide,
    close,
    current: () => item?.id ?? null,
    /** Follow the drawer: rest on phones and in Cockpit. */
    setActive(next) {
      next = Boolean(next);
      if (destroyed || next === active) return;
      active = next;
      if (active) mount();
      else release();
      channel.publish({ type: 'active-changed' });
    },
    destroy() {
      if (destroyed) return;
      release();
      item = null;
      destroyed = true;
      body.remove();
      actions.remove();
      channel.destroy();
    },
  };
}
