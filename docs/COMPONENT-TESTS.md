# Component tests

Place component suites beside the component as `*.test.mjs`. `npm test` discovers
them with the ordinary Node tests; its existing module hooks compile `.vue`
imports. There is no browser download, server, or Vite build step.

## How to write a component test

Import the DOM helper first, then **dynamically** import components and any Vue
APIs. Vue captures `document` when its runtime loads: a static component/Vue
import elsewhere in the test's dependency graph can load it too early.
Importing the helper after Vue has loaded cannot repair Vue's cached document.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mount, container } from '../testSupport/componentDom.mjs';

const { default: StatusBadge } = await import('./StatusBadge.vue');

test('an owner can synchronously update the label', () => {
  const view = mount(StatusBadge, { props: { label: 'Waiting' } });
  assert.equal(container.textContent, 'Waiting');
  view.update({ label: 'Ready' });
  assert.equal(container.textContent, 'Ready');
  view.dispose(); // Optional: automatic cleanup also runs after every case.
  assert.equal(container.childNodes.length, 0);
});
```

The helper exports only `mount` and the attached `container`. `mount(Component,
{ props, before })` uses the real `mountView` and returns `update`, `dispose`,
and a live `element` getter (the current single-root element, or `null` after
disposal or for a non-element root). The getter follows keyed remounts.
Append sibling nodes to `container` and pass one as `before` to test placement.
Query the DOM directly; send native events with `element.click()` or
`element.dispatchEvent(new Event('input', { bubbles: true }))`. Capture emitted
actions through props such as `onChange: value => calls.push(value)`.

Owner-driven `update` is synchronous. For component-internal reactive changes
or DOM events, dynamically import `nextTick` from Vue and await it before reading
the updated DOM. Assert observable labels, attributes, focus, actions and cleanup,
not compiler output or internal component state.

Tests in a component suite must be sequential: do not enable `concurrency`.
There is one jsdom window per test process because Vue caches its document.
After every case the helper unmounts views, clears fixture nodes/attributes and
storage, and reattaches the empty container. It snapshots the document element's
attributes and the head before each case and restores them afterward, so theme
attributes and injected styles do not leak between cases. The installed `Event`,
`EventTarget`, `AbortController` and `AbortSignal` all come from the same jsdom
window, including for abort-scoped DOM listeners. At the end of the file it closes
the window and restores the globals it replaced. Component unmount hooks must
release their own subscriptions, timers and global listeners. Use the test
context's mocks for other globals so Node restores them after the case.

Visual mode supplies `requestAnimationFrame` and `cancelAnimationFrame` for Vue
transitions; it does not add a layout engine or real CSS animation rendering.

Run one suite with:

```sh
mise exec node@24.14.0 -- node --import ./scripts/vue-sfc-hooks.mjs --test src/ui/mountView.test.mjs
```

jsdom does not implement layout, WebGL, or real browser permissions. Keep browser
QA for those contracts: `scripts/qa-mount-view.mjs` additionally proves nonzero
width during `onMounted`. Do not replace geometry checks with jsdom's zero sizes.
The two serialized allocation probes remain isolated and never load this helper.
