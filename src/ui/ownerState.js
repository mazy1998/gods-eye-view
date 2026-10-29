import { customRef, getCurrentScope, nextTick, onScopeDispose } from 'vue';

/**
 * Read an owner's state channel (src/app/stateChannel.js) in a view. Returns a
 * read-only ref of the owner's frozen snapshot: it changes synchronously with
 * each publication and is released with the calling scope (a component's
 * setup, or an effectScope). Writing the ref throws, and the snapshot is
 * frozen; changes go through the owner's own operations. The channel is read
 * once, at setup: a view whose owner can be replaced remounts with the new
 * channel (or the owner keeps one channel across replacement, as
 * LayerBindings does).
 * @param {{subscribe: Function}} channel
 * @returns {import('vue').Ref<object|null>}
 */
export function useOwnerState(channel) {
  if (!getCurrentScope())
    throw new Error('useOwnerState needs a component or effect scope');
  let snapshot = null;
  let changed = () => {};
  const state = customRef((track, trigger) => {
    changed = trigger;
    return {
      get() {
        track();
        return snapshot;
      },
      set() {
        throw new TypeError('Owner state is read-only; call the owner');
      },
    };
  });
  onScopeDispose(
    channel.subscribe(({ state: next }) => {
      snapshot = next;
      changed();
    }),
  );
  return state;
}

/**
 * Wait until views have painted the latest owner state. Publications update
 * refs at once, but Vue patches the DOM on the next microtask, so code that
 * reads painted DOM right after an owner operation (focus moves,
 * measurement, roving tabindex) awaits this first.
 */
export const flushViews = nextTick;
