/**
 * Place today's chrome in the shell's header, map controls and status bar
 * while the shell is in use, and put every node back where it was while it
 * rests: on phones, whose dock and sheets keep it, and in Cockpit, whose
 * layout reads it there. Nodes move with their ids, listeners and owners;
 * nothing is cloned or re-mounted.
 * @param {object} options
 * @param {{subscribe: Function}} options.channel The drawer's channel; its
 *   `active` says whether the shell is in use.
 * @param {Array<[() => Element|null, () => Element|null]>} options.placements
 *   [node, slot] readers, in order; a node placed later may sit inside one
 *   placed earlier, and returns before it.
 */
export function createShellChrome({ channel, placements }) {
  let placed = [];
  let destroyed = false;

  function place() {
    for (const [readNode, readSlot] of placements) {
      const node = readNode();
      const slot = readSlot();
      if (!node?.parentNode || !slot || slot.contains(node)) continue;
      const placeholder = node.ownerDocument.createComment(
        `gev-shell-home:${node.id || node.className}`,
      );
      node.before(placeholder);
      slot.append(node);
      placed.push({ node, placeholder });
    }
  }

  // A node its owner removed (a disposed view) stays gone; only its
  // placeholder goes. A node whose slot left the document still returns.
  function restore() {
    for (const { node, placeholder } of placed.reverse())
      if (!node.parentNode) placeholder.remove();
      else if (placeholder.parentNode) placeholder.replaceWith(node);
    placed = [];
  }

  // The drawer publishes `active` synchronously, so Cockpit's entry and the
  // phone shell find every node home before they read it.
  const unsubscribe = channel.subscribe(({ state }) => {
    if (destroyed) return;
    if (state?.active) place();
    else restore();
  });

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      restore();
    },
  };
}
