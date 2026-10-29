// Test support for the voice panel: a controlled clock, and jsdom visibility.
export function controlledClock() {
  let now = 0,
    next = 0;
  const tasks = new Map();
  return {
    now: () => now,
    setTimer(fn, ms) {
      const id = ++next;
      tasks.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimer: (id) => tasks.delete(id),
    advance(ms) {
      now += ms;
      for (const [id, task] of [...tasks])
        if (task.at <= now && tasks.delete(id)) task.fn();
    },
  };
}

/**
 * jsdom has no Element.checkVisibility. Give it the rule the voice panel's
 * former minimal DOM fixture used (connected, and neither it nor an ancestor
 * hidden), so focus and visibility checks against the real view are as
 * strict as they were.
 */
export function installAncestorVisibility(window) {
  const proto = window.Element.prototype;
  if (proto.checkVisibility) return;
  proto.checkVisibility = function checkVisibility() {
    if (!this.isConnected) return false;
    for (let node = this; node; node = node.parentElement)
      if (node.hidden) return false;
    return true;
  };
}
