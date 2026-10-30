// Map Source selection and its picker: the map-source controls own the switch,
// its share claim and its errors; the Map tab's tiles follow the map-stack
// channel, never the click, so a pending, failed or superseded switch leaves
// the source actually shown lit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '../testSupport/componentDom.mjs';

const { default: MapLookView } = await import('./mapLook/MapLookView.vue');
const { createMapSourceControls } = await import('./mapSourceControls.js');
const { createMapStackChannel } = await import('./mapStackChannel.js');

function fixture() {
  const sources = [
    { id: 'osm', label: 'OSM' },
    { id: 'esri-imagery', label: 'Esri' },
    {
      id: 'bing-aerial',
      label: 'Bing',
      available: false,
      unavailableReason: 'Unavailable for this test',
    },
  ];
  let state = { activeId: 'osm', status: 'ready', lastError: null };
  const settled = new Set();
  const feed = new EventTarget();
  const statusFeed = () =>
    feed.dispatchEvent(new Event('gev:map-stack-changed'));
  const requests = [];
  const calls = [];
  const controller = {
    getStacks: () => sources,
    getActiveId: () => state.activeId,
    getState: (status) => ({
      ...state,
      activeStack: sources.find((source) => source.id === state.activeId),
      status: status || state.status,
    }),
    subscribe: (listener) => {
      settled.add(listener);
      return () => settled.delete(listener);
    },
    setStack: (id) => {
      calls.push(['select', id]);
      state = { ...state, status: 'switching' };
      statusFeed();
      return new Promise((resolve, reject) =>
        requests.push({ id, resolve, reject }),
      );
    },
  };
  const stack = createMapStackChannel({ controller, eventTarget: feed });
  const view = mount(MapLookView, { props: { tab: 'map' } });
  let pickerKey = 0;
  const listeners = new Set();
  const controls = createMapSourceControls({
    controller,
    subscribe: (listener) => {
      listeners.add(listener);
      feed.addEventListener('gev:map-stack-changed', listener);
      return () => {
        listeners.delete(listener);
        feed.removeEventListener('gev:map-stack-changed', listener);
      };
    },
    claimSelection: () => calls.push(['claim']),
    onStateChanged: () => calls.push(['state']),
    onError: (message) => calls.push(['error', message]),
    onRefresh: () => view.update({ pickerKey: ++pickerKey }),
    onPending: (value) => stack.setPending(value),
  });
  view.update({
    mapActions: {
      selectStack: (id) => void controls.select(id).catch(() => {}),
    },
  });
  stack.channel.subscribe(({ state: mapStack }) => view.update({ mapStack }));
  const chip = (id) =>
    view.element.querySelector(`.map-stack-chip[data-stack-id="${id}"]`);
  const status = () => view.element.querySelector('#map-stack-status');
  // The controller settles a switch: state first, then its subscribers.
  function change(id, lastError = null) {
    state = { activeId: id, status: 'ready', lastError };
    for (const listener of settled) listener();
    return controller.getState();
  }
  // A change the controller made on its own, on the status feed.
  function emit(id, lastError = null) {
    state = { activeId: id, status: 'ready', lastError };
    statusFeed();
  }
  const done = () => {
    controls.destroy();
    stack.destroy();
    view.dispose();
  };
  return {
    controller,
    controls,
    requests,
    calls,
    listeners,
    chip,
    status,
    change,
    emit,
    done,
  };
}

test('initial presentation uses actual state and retains unavailable chip semantics', () => {
  const f = fixture();
  assert.equal(f.chip('osm').getAttribute('aria-pressed'), 'true');
  assert.equal(f.status().textContent, 'OSM');
  const unavailable = f.chip('bing-aerial');
  assert.equal(
    unavailable.disabled,
    false,
    'unavailable chips remain focusable',
  );
  assert.equal(unavailable.getAttribute('aria-disabled'), 'true');
  assert.equal(
    unavailable.getAttribute('aria-label'),
    'Bing unavailable: Unavailable for this test',
  );
  unavailable.click();
  assert.equal(f.requests.length, 0);
  f.done();
});

test('selection claims authority before requesting and never lights a pending source optimistically', async () => {
  const f = fixture();
  const pending = f.controls.select('esri-imagery');
  assert.deepEqual(f.calls.slice(0, 2), [
    ['claim'],
    ['select', 'esri-imagery'],
  ]);
  assert.equal(f.status().textContent, '...');
  assert.equal(f.chip('osm').getAttribute('aria-pressed'), 'true');
  f.requests[0].resolve(f.change('esri-imagery'));
  await pending;
  assert.equal(f.chip('esri-imagery').getAttribute('aria-pressed'), 'true');
  assert.equal(f.status().textContent, 'Esri');
  f.done();
});

test('the status shows the switch before the controller starts it', async () => {
  const f = fixture();
  // Something delays the controller's own switch (a slow provider handoff).
  const setStack = f.controller.setStack;
  let start;
  f.controller.setStack = (id) =>
    new Promise((resolve) => {
      start = () => resolve(setStack(id));
    });
  const pending = f.controls.select('esri-imagery');
  assert.equal(f.status().textContent, '...');
  assert.equal(f.chip('osm').getAttribute('aria-pressed'), 'true');
  start();
  await Promise.resolve();
  f.requests[0].resolve(f.change('esri-imagery'));
  await pending;
  assert.equal(f.status().textContent, 'Esri');
  f.done();
});

test('a tile click selects that source once', async () => {
  const f = fixture();
  f.chip('esri-imagery').click();
  assert.deepEqual(f.calls.slice(0, 2), [
    ['claim'],
    ['select', 'esri-imagery'],
  ]);
  f.requests[0].resolve(f.change('esri-imagery'));
  await Promise.resolve();
  assert.equal(f.requests.length, 1);
  f.done();
});

test('provider-driven fallback updates the active chip and durable state notification', () => {
  const f = fixture();
  f.emit('esri-imagery');
  f.emit('osm', 'Source unavailable; using OSM');
  assert.equal(f.chip('osm').getAttribute('aria-pressed'), 'true');
  assert.equal(f.status().textContent, 'OSM');
  assert.equal(f.status().classList.contains('warn'), true);
  assert.deepEqual(f.calls, [['state'], ['state']]);
  f.done();
});

test('a late superseded response cannot overwrite the latest displayed selection', async () => {
  const f = fixture();
  const first = f.controls.select('esri-imagery');
  const second = f.controls.select('osm');
  f.requests[1].resolve(f.change('osm'));
  await second;
  const count = f.calls.length;
  f.requests[0].resolve({
    activeId: 'esri-imagery',
    activeStack: { label: 'old' },
    lastError: 'obsolete failure',
  });
  await first;
  assert.equal(f.status().textContent, 'OSM');
  assert.equal(f.calls.length, count);
  f.done();
});

test('failed selection keeps the real source lit and reports its error', async () => {
  const f = fixture();
  const pending = f.controls.select('esri-imagery');
  f.requests[0].resolve(f.change('osm', 'Unavailable'));
  await pending;
  assert.equal(f.chip('osm').getAttribute('aria-pressed'), 'true');
  assert.equal(f.status().classList.contains('warn'), true);
  assert.ok(
    f.calls.some((call) => call[0] === 'error' && call[1] === 'Unavailable'),
  );
  f.done();
});

test('rejected selection leaves switching presentation and propagates a useful error', async () => {
  const f = fixture();
  const pending = f.controls.select('esri-imagery');
  f.change('osm');
  f.requests[0].reject(new Error('Request failed'));
  await assert.rejects(pending, /Request failed/);
  assert.equal(f.status().textContent, 'OSM');
  assert.ok(
    f.calls.some((call) => call[0] === 'error' && call[1] === 'Request failed'),
  );
  f.done();
});

test('restoration may select without claiming or publishing a user gesture', async () => {
  const f = fixture();
  const pending = f.controls.select('esri-imagery', { syncShare: false });
  f.requests[0].resolve(f.change('esri-imagery'));
  await pending;
  assert.deepEqual(
    f.calls.filter(([name]) => name !== 'state'),
    [['select', 'esri-imagery']],
  );
  f.done();
});

test('refresh removes detached chip listeners and destruction removes all subscriptions', () => {
  const f = fixture();
  const old = f.chip('esri-imagery');
  f.controls.refresh();
  assert.notEqual(f.chip('esri-imagery'), old);
  old.click();
  assert.equal(f.requests.length, 0);
  const current = f.chip('esri-imagery');
  f.controls.destroy();
  f.controls.destroy();
  current.click();
  assert.equal(f.requests.length, 0);
  assert.equal(f.listeners.size, 0);
  f.done();
});

test('completion after destruction cannot notify', async () => {
  const f = fixture();
  const pending = f.controls.select('esri-imagery');
  f.controls.destroy();
  const count = f.calls.length;
  f.requests[0].resolve(f.change('esri-imagery'));
  await pending;
  assert.equal(f.calls.length, count);
  assert.equal(await f.controls.select('osm'), null);
  f.done();
});
