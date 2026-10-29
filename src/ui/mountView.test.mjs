import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { container, mount } from '../testSupport/componentDom.mjs';

const { default: Probe } = await import('../testSupport/MountProbe.vue');
const { h, onMounted, onUnmounted, Transition } = await import('vue');

beforeEach((t) => {
  assert.equal(container.childNodes.length, 0);
  assert.equal(container.attributes.length, 0);
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
});
afterEach(() => {
  assert.deepEqual(
    console.warn.mock.calls.map((call) => call.arguments),
    [],
  );
  assert.deepEqual(
    console.error.mock.calls.map((call) => call.arguments),
    [],
  );
});

function siblings() {
  const first = container.appendChild(document.createElement('em'));
  const last = container.appendChild(document.createElement('strong'));
  return { first, last };
}
const order = () => [...container.children].map((node) => node.tagName);

test('a Transition can mount and dispose with animation frames pending', async () => {
  const view = mount({
    setup: () => () =>
      h(Transition, { appear: true }, { default: () => h(Probe) }),
  });
  const element = view.element;
  assert.equal(element.isConnected, true);
  assert.equal(element.classList.contains('v-enter-active'), true);
  let cancelledFrameRan = false;
  const frame = requestAnimationFrame(() => (cancelledFrameRan = true));
  cancelAnimationFrame(frame);
  view.dispose();
  assert.equal(element.isConnected, false);
  assert.equal(view.element, null);
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  );
  assert.equal(cancelledFrameRan, false);
  assert.equal(container.childNodes.length, 0);
});

test('mounted hooks see the connected parent and can focus', () => {
  container.id = 'mount-view-host';
  let report;
  mount(Probe, {
    props: { label: 'Mounted', onReport: (value) => (report = value) },
  });
  assert.equal(report.connected, true);
  assert.equal(report.focused, true);
  assert.equal(report.parentId, 'mount-view-host');
  assert.equal(document.activeElement, container.querySelector('input'));
  // Width is deliberately left to qa-mount-view: jsdom has no layout engine.
});

test('mount inserts before the given sibling without changing parent attributes', () => {
  const { first, last } = siblings();
  container.id = 'owner';
  mount(Probe, { before: last });
  assert.deepEqual(order(), ['EM', 'INPUT', 'STRONG']);
  assert.equal(container.firstChild, first);
  assert.equal(container.lastChild, last);
  assert.deepEqual(container.getAttributeNames(), ['id']);
});

test('update patches synchronously while keeping the node and other props', () => {
  const view = mount(Probe, { props: { label: 'Mounted', id: 'field' } });
  const original = container.firstChild;
  view.update({ label: 'Changed' });
  assert.equal(container.firstChild, original);
  assert.equal(original.getAttribute('aria-label'), 'Changed');
  assert.equal(original.id, 'field');
});

test('a changed key remounts attached at the same position', () => {
  const { last } = siblings();
  const reports = [];
  const view = mount(Probe, {
    before: last,
    props: { onReport: (r) => reports.push(r) },
  });
  const original = container.querySelector('input');
  assert.equal(view.element, original);
  view.update({ key: 'remount', label: 'Remount' });
  assert.deepEqual(order(), ['EM', 'INPUT', 'STRONG']);
  assert.notEqual(container.querySelector('input'), original);
  assert.equal(view.element, container.querySelector('input'));
  assert.equal(original.isConnected, false);
  assert.equal(reports.length, 2);
  assert.equal(reports[1].label, 'Remount');
  assert.equal(reports[1].connected, true);
  assert.equal(reports[1].focused, true);
});

test('an update made during paint wins before the outer update returns', () => {
  const { last } = siblings();
  const view = mount(Probe, { before: last });
  view.update({
    key: 'again',
    label: 'Again',
    onReport: () => view.update({ label: 'Latest' }),
  });
  assert.equal(
    container.querySelector('input').getAttribute('aria-label'),
    'Latest',
  );
  assert.deepEqual(order(), ['EM', 'INPUT', 'STRONG']);
});

test('dispose is idempotent and later updates do nothing', () => {
  const { first, last } = siblings();
  const view = mount(Probe, { before: last });
  const input = container.querySelector('input');
  view.dispose();
  view.dispose();
  view.update({ label: 'Late' });
  assert.equal(view.element, null);
  assert.equal(input.isConnected, false);
  assert.deepEqual([...container.children], [first, last]);
});

test('the global EventTarget accepts the installed Event', () => {
  const target = new EventTarget();
  const event = new Event('probe');
  let received;
  target.addEventListener('probe', (value) => (received = value));
  assert.equal(target.dispatchEvent(event), true);
  assert.equal(received, event);
});

test('abort-scoped DOM listeners stop receiving events after abort', () => {
  const controller = new AbortController();
  assert.ok(controller.signal instanceof AbortSignal);
  let calls = 0;
  container.addEventListener('probe', () => calls++, {
    signal: controller.signal,
  });
  container.dispatchEvent(new Event('probe'));
  assert.equal(calls, 1);
  controller.abort();
  container.dispatchEvent(new Event('probe'));
  assert.equal(calls, 1);
});

test('document appearance and head return to their pre-case state', async (t) => {
  document.documentElement.lang = 'en';
  document.documentElement.dataset.uiTheme = 'dark';
  document.head.setAttribute('data-fixture', 'baseline');
  const meta = document.head.appendChild(document.createElement('meta'));
  meta.name = 'fixture';
  meta.content = 'baseline';
  const head = document.head.outerHTML;

  await t.test('a case changes appearance and replaces head content', () => {
    document.documentElement.removeAttribute('lang');
    document.documentElement.dataset.uiTheme = 'light';
    document.documentElement.dataset.gevAppearance = 'transparent';
    document.head.removeAttribute('data-fixture');
    document.head.replaceChildren(document.createElement('style'));
  });
  await t.test('the next case sees the saved document state', () => {
    assert.deepEqual(document.documentElement.getAttributeNames(), [
      'lang',
      'data-ui-theme',
    ]);
    assert.equal(document.documentElement.lang, 'en');
    assert.equal(document.documentElement.dataset.uiTheme, 'dark');
    assert.equal(document.head.outerHTML, head);
  });
});

test('mount appends without an anchor and disposal during paint removes it', () => {
  const { first, last } = siblings();
  const view = mount(Probe);
  assert.deepEqual(order(), ['EM', 'STRONG', 'INPUT']);
  view.update({ key: 'gone', onReport: () => view.dispose() });
  assert.deepEqual([...container.children], [first, last]);
});

test('each case cleans up mounted lifecycles and stray fixture DOM', async (t) => {
  let unmounted = 0;
  let events = 0;
  let input;
  await t.test('leave a mounted view for automatic cleanup', () => {
    const listener = () => events++;
    mount({
      setup() {
        onMounted(() => window.addEventListener('probe', listener));
        onUnmounted(() => {
          unmounted++;
          window.removeEventListener('probe', listener);
        });
        return () => h('input');
      },
    });
    input = container.firstChild;
    document.body.appendChild(document.createElement('aside'));
    window.dispatchEvent(new Event('probe'));
    assert.equal(events, 1);
  });
  await t.test('the next case starts empty with listeners released', () => {
    assert.equal(unmounted, 1);
    assert.equal(input.isConnected, false);
    assert.deepEqual([...document.body.children], [container]);
    window.dispatchEvent(new Event('probe'));
    assert.equal(events, 1);
  });
});
