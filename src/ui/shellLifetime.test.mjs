import assert from 'node:assert/strict';
import test from 'node:test';
import { LocationNavigation } from './locationNavigation.js';
import { LayerBindings } from './layerBindings.js';
import { LayerLifecycle } from '../data/lifecycle.js';

function replaceWindow(t, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  });
}

function location(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  replaceWindow(t, { setTimeout });
  const calls = [];
  let hooks;
  const owner = new LocationNavigation({
    viewer: { camera: {
      cancelFlight() {}, lookAtTransform() {},
      positionCartographic: { latitude: 0, longitude: 0, height: 20000000 },
    } },
    services: {
      OrbitController: class { stop() { calls.push('orbit-stop'); } },
      GLOBE_VIEW: { heightM: 20000000 },
      flyToGlobeView(_viewer, callbacks) { hooks = callbacks; return {}; },
      interruptCameraMotion() {},
      militaryAwarenessLayer: {}, satellitesLayer: {}, rocketLaunchesLayer: {},
      trafficLayer: {
        beginWorldJump() { calls.push('begin'); },
        endWorldJump() { calls.push('end'); },
      },
      suspendDetection() { calls.push('suspend'); },
      resumeDetection() { calls.push('resume'); },
    },
    elements: {}, navigation: {}, readCockpit: () => null,
    operations: {
      _stampNavigation() {}, _updateTrafficSyncChip() {},
      _runExplicitNavigation(_noun, run) { return run(); },
    },
  });
  return { owner, calls, readHooks: () => hooks };
}

test('shell disposal settles a pending globe reset once and revokes its timeout', async (t) => {
  const { owner, calls, readHooks } = location(t);
  const pending = owner.resetToGlobeView();
  assert.equal(owner.resetToGlobeView(), pending);
  owner.destroy();
  assert.equal((await pending).cancelled, true);
  const after = [...calls];
  readHooks().onComplete();
  t.mock.timers.tick(10000);
  owner.destroy();
  assert.deepEqual(calls, after);
  assert.equal(calls.filter(c => c === 'resume').length, 1);
  assert.equal((await owner.resetToGlobeView()).cancelled, true);
});

test('world jump completion cannot revive navigation after shell disposal', (t) => {
  const { owner, calls } = location(t);
  let complete;
  owner._flyWithTransition(true, ({ onStart, onComplete }) => {
    onStart(); complete = onComplete;
  });
  owner.destroy();
  const after = [...calls];
  complete();
  t.mock.timers.tick(10000);
  assert.deepEqual(calls, after);
  assert.equal(calls.filter(c => c === 'resume').length, 1);
});

function bindings(t) {
  replaceWindow(t, new EventTarget());
  const events = [];
  const controls = {
    hud: { attachDataManager() {} },
    _contextControls: { connect() {} },
    _cctvControls: { connect() {} }, _radioControls: { connect() {} },
    _streetLevelControls: { connects: 0, connect() { this.connects += 1; } },
  };
  const owner = new LayerBindings({
    viewer: {}, services: {}, readControls: () => controls,
    feedback: {}, shareRestoration: { connect() {} },
    operations: {
      _updateTrafficSyncChip() {}, _updateGlobalLoadingFeedback() {},
      _syncContextModeButtons() {},
    },
  });
  function manager(id, directions = true) {
    return {
      layers: new Map(directions ? [['directions', { module: {
        attachShellServices(value) { events.push([id, value ? 'attach' : 'detach']); },
      } }]] : []),
      subscribe() { events.push([id, 'subscribe']); return () => events.push([id, 'unsubscribe']); },
    };
  }
  return { owner, manager, events, controls };
}

test('manager replacement releases Directions even when the new manager has no route layer', (t) => {
  const { owner, manager, events } = bindings(t);
  owner.attachDataManager(manager('old'));
  owner.attachDataManager(manager('new', false));
  assert.deepEqual(events, [
    ['old', 'subscribe'], ['old', 'attach'], ['old', 'unsubscribe'],
    ['new', 'subscribe'], ['old', 'detach'],
  ]);
  owner.stop(); owner.disconnect();
  assert.deepEqual(events.at(-1), ['new', 'unsubscribe']);
  const count = events.length;
  owner.attachDataManager(manager('late'));
  owner.stop(); owner.disconnect();
  assert.equal(events.length, count);
});

function layerManager(id, count) {
  const streams = { changes: new Set(), activity: new Set() };
  const rowListeners = [];
  const layer = { id, enabled: false, stats: { count } };
  return {
    layer, streams, rowListeners,
    layers: new Map([[id, { module: {
      setRowControlsListener(listener) { rowListeners.push(listener); },
    } }]]),
    getAll: () => [{ ...layer, stats: { ...layer.stats } }],
    subscribe(listener) {
      streams.changes.add(listener);
      return () => streams.changes.delete(listener);
    },
    subscribeActivity(listener) {
      streams.activity.add(listener);
      return () => streams.activity.delete(listener);
    },
    emit(stream, change) { for (const listener of streams[stream]) listener(change); },
  };
}

test('the layer channel follows both manager streams and the replacement manager', (t) => {
  const { owner } = bindings(t);
  const seen = [];
  owner.channel.subscribe(({ state, change }) => seen.push({ state, change }));
  assert.deepEqual(seen.at(-1).state.layers, []);
  const first = layerManager('quakes', 3);
  owner.attachDataManager(first);
  assert.equal(seen.at(-1).state.layers[0].stats.count, 3);
  first.layer.enabled = true;
  first.emit('changes', { type: 'visibility', layerId: 'quakes', error: new Error('kept out') });
  assert.equal(seen.at(-1).state.layers[0].enabled, true);
  assert.deepEqual(seen.at(-1).change, { type: 'visibility', layerId: 'quakes' });
  first.layer.stats.count = 7;
  first.emit('activity', { type: 'status' });
  assert.equal(seen.at(-1).state.layers[0].stats.count, 7);
  assert.equal(Object.isFrozen(seen.at(-1).state.layers[0].stats), true);

  const second = layerManager('vessels', 1);
  owner.attachDataManager(second);
  assert.equal(first.streams.changes.size + first.streams.activity.size, 0);
  assert.deepEqual(seen.at(-1).state.layers.map((layer) => layer.id), ['vessels']);
  const count = seen.length;
  first.emit('activity', { type: 'status' });
  assert.equal(seen.length, count, 'the replaced manager no longer publishes');
  second.emit('activity', { type: 'status' });
  assert.equal(seen.length, count + 1);
  assert.deepEqual([...first.rowListeners, ...second.rowListeners], []);

  // One layer's failure in its stats must not stall every layer's view.
  second.layer.stats = { count: 2, error: new Error('feed down'), lastUpdate: new Date(5) };
  second.emit('activity', { type: 'status' });
  assert.deepEqual(seen.at(-1).state.layers[0].stats, { count: 2, error: 'feed down', lastUpdate: 5 });
  owner.stop(); owner.disconnect();
  assert.equal(second.streams.changes.size + second.streams.activity.size, 0);
  assert.equal(owner.channel.publish(), false, 'the channel ends with the bindings');
});

test('a real manager with one failing layer keeps every layer on the channel', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const { owner } = bindings(t);
  const manager = new LayerLifecycle({ scene: { requestRender() {} } });
  let healthyCount = 4;
  const layer = (id, getStats) => ({
    id, name: id, init() {}, enable() {}, disable() {}, update() {}, destroy() {}, getStats,
  });
  manager.register(layer('healthy', () => ({ count: healthyCount, lastUpdate: 10 })));
  manager.register(layer('broken', () => { throw new Error('feed down'); }));
  for (const id of ['healthy', 'broken'])
    await manager.setEnabled(id, true, { origin: 'user' });
  const seen = [];
  owner.channel.subscribe(({ state }) => seen.push(state.layers));
  owner.attachDataManager(manager);
  const byId = () => Object.fromEntries(seen.at(-1).map((item) => [item.id, item.stats]));
  assert.equal(byId().broken.error, 'feed down');
  assert.equal(byId().healthy.count, 4);
  healthyCount = 9;
  manager.refreshLayerStats();
  assert.equal(byId().healthy.count, 9, 'the healthy layer keeps publishing');
  owner.stop(); owner.disconnect();
});

test('attaching the manager reconnects Street Level, so its switch-on requests reach the panel', (t) => {
  const { owner, manager, controls } = bindings(t);
  owner.attachDataManager(manager('first'));
  assert.equal(controls._streetLevelControls.connects, 1);
  owner.stop(); owner.disconnect();
});

test('camera-entry listeners are removed before any asynchronous layer cleanup', (t) => {
  const { owner } = bindings(t);
  let changes = 0;
  let trackedCallback;
  owner.viewer = { trackedEntityChanged: {
    addEventListener(callback) {
      trackedCallback = callback;
      return () => { changes += 1; };
    },
  } };
  owner._stampNavigation = () => { changes += 100; };
  owner.observeCamera();
  owner.stop();
  trackedCallback({});
  owner.stop();
  assert.equal(changes, 1);
});


test('weather shell supplies live imagery hosts to wind and observations and releases them', (t) => {
  const { owner } = bindings(t);
  let host = { collection: {}, kind: 'tileset' };
  owner.services.imageryHost = () => host;
  const attached = new Map();
  const ids = ['wind', 'weather-radar', 'weather-satellite', 'weather-lightning'];
  owner.attachDataManager({
    layers: new Map(ids.map(id => [id, { module: {
      attachShellServices(services) { attached.set(id, services); },
    } }])),
    subscribe: () => () => {},
  });
  for (const id of ids) assert.equal(attached.get(id).imageryHost(), host);
  host = { collection: null, kind: 'none' };
  for (const id of ids) assert.equal(attached.get(id).imageryHost(), host);
  owner.disconnect();
  for (const id of ids) assert.equal(attached.get(id), null);
});
