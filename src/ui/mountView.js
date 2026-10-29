import { createCommentVNode, h, render } from 'vue';

/**
 * Mount a Vue view where an owner would have built DOM: the component's own
 * nodes go under `parent` before `before` (appended when null), with no
 * wrapper element and no attributes added to `parent`. The view holds no
 * application state; its owner passes presentation inputs as props.
 *
 * The view is created in place, so its mounted hooks see connected nodes, and
 * a changed `key` remounts it in place. `update(props)` merges into the current
 * props and patches synchronously, as the DOM adapters it replaces do; an
 * update made while one is painting is painted before the outer call returns,
 * so the latest props win. `dispose()` unmounts and removes the nodes; it is
 * idempotent, and later updates are ignored.
 * @param {object} component
 * @param {object} options
 * @param {Node} options.parent
 * @param {Node|null} [options.before]
 * @param {object} [options.props]
 * @returns {{readonly element: Element|null, update(props: object): void, dispose(): void}}
 *   `element` is the current root element of a single-root view, otherwise null.
 */
export function mountView(component, { parent, before = null, props = {} }) {
  // The fragment is only the render root. A placeholder rendered there moves
  // to its place; the host then replaces it with the view, and patches inside
  // a component follow its nodes' real parent.
  const Host = {
    props: { view: Object },
    setup: (host) => () =>
      host.view ? h(component, host.view) : createCommentVNode(),
  };
  const root = parent.ownerDocument.createDocumentFragment();
  let current = null;
  let painted = null;
  let painting = false;
  let pending = false;
  let disposed = false;
  const paint = () => {
    if (painting) {
      pending = true;
      return;
    }
    painting = true;
    try {
      do {
        pending = false;
        painted = h(Host, { view: current });
        render(painted, root);
      } while (pending && !disposed);
    } finally {
      painting = false;
      if (disposed) render(null, root);
    }
  };
  paint();
  parent.insertBefore(root, before);
  current = { ...props };
  paint();
  return {
    get element() {
      const node = disposed ? null : painted?.el;
      return node?.nodeType === 1 ? node : null;
    },
    update(next) {
      if (disposed) return;
      current = { ...current, ...next };
      paint();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (!painting) render(null, root);
    },
  };
}
