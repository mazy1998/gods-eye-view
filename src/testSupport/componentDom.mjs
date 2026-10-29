// Import this helper before dynamically importing Vue or a component. Vue's
// runtime-dom captures document at import time; keep this window for the file.
import { after, afterEach, beforeEach } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
const globals = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'SVGElement',
  'Event',
  'EventTarget',
  'AbortController',
  'AbortSignal',
  'CustomEvent',
  'MouseEvent',
  'KeyboardEvent',
  'FocusEvent',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
];
const previous = new Map();
for (const name of globals) {
  previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: dom.window[name],
  });
}

const { mountView } = await import('../ui/mountView.js');

/** Connected fixture shared by sequential tests in this process. */
export const container = document.body.appendChild(
  document.createElement('div'),
);
const views = new Set();

/** Mount through production's synchronous owner-to-view adapter. */
export function mount(component, { props = {}, before = null } = {}) {
  const view = mountView(component, { parent: container, before, props });
  views.add(view);
  return {
    get element() {
      return view.element;
    },
    update: view.update,
    dispose() {
      view.dispose();
      views.delete(view);
    },
  };
}

function cleanup() {
  for (const view of views) view.dispose();
  views.clear();
  container.replaceChildren();
  for (const attribute of [...container.attributes])
    container.removeAttribute(attribute.name);
  document.body.replaceChildren(container);
  dom.window.localStorage.clear();
  dom.window.sessionStorage.clear();
}

// A stack also preserves a parent test's setup around sequential subtests.
const documents = [];
beforeEach(() => {
  documents.push({
    root: document.documentElement.cloneNode(false),
    head: document.head.cloneNode(true),
  });
});
function restoreAttributes(element, snapshot) {
  for (const attribute of [...element.attributes])
    element.removeAttribute(attribute.name);
  for (const { name, value } of snapshot.attributes)
    element.setAttribute(name, value);
}
afterEach(() => {
  try {
    cleanup();
  } finally {
    const { root, head } = documents.pop();
    restoreAttributes(document.documentElement, root);
    restoreAttributes(document.head, head);
    document.head.replaceChildren(...head.childNodes);
  }
});
after(() => {
  try {
    cleanup();
  } finally {
    dom.window.close();
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
