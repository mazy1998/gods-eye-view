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

  const contains = (node) =>
    Boolean(node) && (body.contains(node) || actions.contains(node));

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
    release();
    item = next;
    const focused = doc.activeElement;
    if (!contains(focused)) returnFocus = focused ?? null;
    mount();
    channel.publish({ type: 'shown', id: next.id });
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
