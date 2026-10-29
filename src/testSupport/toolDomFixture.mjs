import { container } from './componentDom.mjs';
const nativeDocument = document;

/** Native nodes with listener accounting for owner teardown assertions. */
export function instrument(node) {
  if (!node || node.listeners) return node;
  node.listeners = [];
  node.clicks = 0;
  const add = node.addEventListener.bind(node);
  const remove = node.removeEventListener.bind(node);
  node.addEventListener = (type, listener, options) => {
    node.listeners.push({ type, listener, options });
    add(type, listener, options);
  };
  node.removeEventListener = (type, listener, options) => {
    const at = node.listeners.findIndex(
      (e) => e.type === type && e.listener === listener,
    );
    if (at >= 0) node.listeners.splice(at, 1);
    remove(type, listener, options);
  };
  node.emit = (type, values = {}) => {
    const event =
      type === 'keydown'
        ? new KeyboardEvent(type, {
            bubbles: true,
            cancelable: true,
            ...values,
          })
        : new Event(type, { bubbles: true, cancelable: true });
    for (const [key, value] of Object.entries(values)) {
      if (!['target', 'key'].includes(key))
        Object.defineProperty(event, key, { value });
    }
    (values.target || node).dispatchEvent(event);
    return event;
  };
  if (node.click) {
    const click = node.click.bind(node);
    node.click = () => {
      node.clicks++;
      click();
    };
  }
  return node;
}

export function toolDocument(id) {
  const body = instrument(nativeDocument.createElement('div'));
  const host = nativeDocument.createElement('div');
  host.id = id;
  body.append(host);
  container.append(body);
  const nodes = new Map();
  const doc = {
    body,
    getElementById(name) {
      const node = body.querySelector(`[id="${name}"]`);
      if (node) nodes.set(name, instrument(node));
      return node || nodes.get(name) || null;
    },
    get activeElement() {
      return nativeDocument.activeElement;
    },
    addEventListener: (...args) => body.addEventListener(...args),
    removeEventListener: (...args) => body.removeEventListener(...args),
    emit: (...args) => body.emit(...args),
    get listeners() {
      return body.listeners;
    },
  };
  return { document: doc, nodes, body, host };
}
