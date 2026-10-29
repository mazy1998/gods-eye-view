import { createStateChannel } from '../app/stateChannel.js';
import { msg } from '../i18n/marker.js';

/** The one browser-local key; never in share links, scenes or visual settings. */
export const APPEARANCE_STORAGE_KEY = 'godsEyeView.appearance';

/** The token appearances tokens.css defines; the first is the default. */
export const APPEARANCES = Object.freeze(
  [
    { value: 'original', label: msg('Original') },
    { value: 'transparent-dark', label: msg('Transparent dark') },
    { value: 'light', label: msg('Light') },
  ].map((item) => Object.freeze(item)),
);

const known = (value) => APPEARANCES.some((item) => item.value === value);

/**
 * Own the viewer's appearance: read its one stored value, apply it to the
 * root's `data-gev-appearance` before the shell renders, and publish it. The
 * Cyber HUD layout keeps its own palette (tokens.css guards every alternate
 * appearance), so the snapshot says when Cyber is on for pickers to explain.
 * @param {object} [options]
 * @param {Storage|null} [options.storage] Defaults to localStorage.
 * @param {HTMLElement} [options.root] Defaults to the document element.
 */
export function createAppearance({
  storage,
  root = globalThis.document?.documentElement,
} = {}) {
  const target = () =>
    storage === undefined ? globalThis.localStorage : storage;
  let stored;
  try {
    stored = target()?.getItem?.(APPEARANCE_STORAGE_KEY);
  } catch {
    stored = null;
  }
  let appearance = known(stored) ? stored : APPEARANCES[0].value;
  const isCyber = () => root?.dataset.uiTheme === 'cyber';
  let cyber = isCyber();
  const channel = createStateChannel(() => ({ appearance, cyber }));

  // Original is the default with no attribute, as before an owner existed.
  function apply() {
    if (!root) return;
    if (appearance === APPEARANCES[0].value) delete root.dataset.gevAppearance;
    else root.dataset.gevAppearance = appearance;
  }
  apply();

  const Observer = root?.ownerDocument?.defaultView?.MutationObserver;
  const observer = Observer
    ? new Observer(() => {
        if (cyber === isCyber()) return;
        cyber = isCyber();
        channel.publish({ type: 'cyber-changed' });
      })
    : null;
  observer?.observe(root, {
    attributes: true,
    attributeFilter: ['data-ui-theme'],
  });

  return {
    channel,
    get: () => appearance,
    /** Apply and store a known appearance; storage failures keep it applied. */
    set(value) {
      if (!known(value)) return false;
      if (value === appearance) return true;
      appearance = value;
      apply();
      try {
        target()?.setItem?.(APPEARANCE_STORAGE_KEY, value);
      } catch {
        /* The applied value stays for this page. */
      }
      channel.publish({ type: 'appearance-changed' });
      return true;
    },
    destroy() {
      observer?.disconnect();
      channel.destroy();
    },
  };
}
