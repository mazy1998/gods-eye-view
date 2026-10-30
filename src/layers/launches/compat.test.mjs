import test from 'node:test';
import assert from 'node:assert/strict';
import * as Cesium from 'cesium';
import { container } from '../../testSupport/componentDom.mjs';
const { createRocketLaunchesLayer } =
  await import('gods-eye-view/layers/launches');

test('published launches factory renders standalone roster and owns its teardown without a shell', async (t) => {
  container.innerHTML =
    '<div id="space-mission-panel-host"><div id="space-mission-roster"></div></div>';
  const canvas = document.createElement('canvas');
  canvas.disableRootEvents = true;
  const event = () => new Cesium.Event();
  const viewer = {
    dataSources: new Cesium.DataSourceCollection(),
    scene: { canvas, preRender: event(), drillPick: () => [] },
    camera: {
      moveStart: event(),
      moveEnd: event(),
      lookAtTransform() {},
      cancelFlight() {},
    },
  };
  const noop = () => {};
  const layer = createRocketLaunchesLayer({
    services: {
      satellites: {},
      geometry: {},
      overlays: {
        setOverlayEntries: noop,
        setOverlaySourceVisible: noop,
        clearOverlaySource: noop,
      },
      render: { holdContinuousRender: noop, releaseContinuousRender: noop },
    },
    source: {
      getLaunches: async () => ({ results: [] }),
      getActiveTle: async () => '',
    },
  });
  layer.init(viewer);
  t.after(() => layer.destroy(viewer));
  const roster = document.getElementById('space-mission-roster');
  assert.match(roster.textContent, /Loading/i);
  assert.ok(document.getElementById('space-mission-panel'));
  await layer.enable();
  await layer.update();
  assert.equal(layer.getStats().error, null);
  assert.match(roster.textContent, /No missions/i);
  await layer.destroy(viewer);
  assert.equal(roster.children.length, 0);
  assert.equal(document.getElementById('space-mission-panel'), null);
});

test('native mission presentation preserves telemetry control identity and routes selection/replay intent', async () => {
  const { createNativeMissionPanels } = await import('./nativePanel.js');
  container.innerHTML = '<div id="host"><div id="roster"></div></div>';
  const host = container.querySelector('#host'),
    roster = container.querySelector('#roster');
  const calls = [];
  const actions = Object.fromEntries(
    [
      'select',
      'pointerEnter',
      'pointerLeave',
      'focus',
      'blur',
      'deselect',
      'focusSite',
      'replay',
      'togglePause',
      'cancelReplay',
      'previous',
      'next',
      'setReplaySpeed',
    ].map((name) => [name, (...args) => calls.push([name, ...args])]),
  );
  const view = createNativeMissionPanels({ host, roster, actions });
  const state = {
    roster: {
      revision: 1,
      loaded: true,
      count: 1,
      items: [
        {
          id: 'a',
          index: 0,
          label: '<Mission>',
          provider: '<Operator>',
          date: '2026-10-30',
        },
      ],
    },
    detail: {
      id: 'a',
      title: '<Mission>',
      provider: '<Operator>',
      status: 'Ready',
      site: 'Site',
      time: 'Now',
      orbit: 'LEO',
      ascent: 'Estimated',
      distance: '1 km',
      speed: '2 km/s',
      position: '1 / 1',
      canPrevious: false,
      canNext: false,
      payloads: [],
      stages: [],
    },
    replay: {
      available: true,
      active: false,
      paused: false,
      speed: 1,
      speedText: '1×',
      progress: '20%',
    },
  };
  view.update(state);
  const select = roster.querySelector('button');
  select.click();
  assert.deepEqual(calls.pop(), ['select', 0]);
  assert.equal(host.querySelector('mission'), null);
  const replay = host.querySelector('[data-mission-replay]');
  replay.click();
  assert.deepEqual(calls.pop(), ['replay']);
  state.detail = { ...state.detail, distance: '20 km' };
  view.update(state);
  assert.equal(host.querySelector('[data-mission-replay]'), replay);
  assert.equal(
    host.querySelector('[data-mission-distance]').textContent,
    '20 km',
  );
  const speed = host.querySelector('[data-mission-replay-speed]');
  speed.value = '2';
  speed.dispatchEvent(new Event('input', { bubbles: true }));
  assert.deepEqual(calls.pop(), ['setReplaySpeed', '2']);
  view.dispose();
  view.dispose();
  replay.click();
  select.click();
  assert.deepEqual(calls, []);
  view.update(state);
  assert.equal(roster.children.length, 0);
  assert.equal(host.querySelector('#space-mission-panel'), null);
});

test('native Missions adopts a populated embedding host instead of appending a second roster', async () => {
  const { createNativeMissionPanels } = await import('./nativePanel.js');
  container.innerHTML = `<div id="space-mission-panel-host"><div id="space-mission-roster" class="space-mission-roster">
    <div class="space-mission-roster-header"><div><strong>AVAILABLE MISSIONS</strong><span>SELECT A MISSION TO INSPECT</span></div><output data-mission-roster-count>—</output></div>
    <div class="space-mission-roster-list" data-mission-roster-list><div class="space-mission-roster-empty">LOADING 30-DAY MISSION INDEX</div></div>
    <p tabindex="-1" data-mission-roster-focus-continuation>TAB PREVIEWS · ENTER / SPACE SELECTS</p>
  </div></div>`;
  const roster = container.querySelector('#space-mission-roster');
  const count = roster.querySelector('[data-mission-roster-count]');
  const list = roster.querySelector('[data-mission-roster-list]');
  const view = createNativeMissionPanels({
    roster,
    host: roster.parentElement,
    actions: {},
  });
  view.update({
    roster: { revision: 1, loaded: true, count: 0, items: [] },
    detail: null,
    replay: {},
  });
  assert.equal(
    roster.querySelectorAll('.space-mission-roster-header').length,
    1,
  );
  assert.equal(
    roster.querySelectorAll('[data-mission-roster-count]').length,
    1,
  );
  assert.equal(roster.querySelectorAll('[data-mission-roster-list]').length, 1);
  assert.equal(roster.querySelector('[data-mission-roster-count]'), count);
  assert.equal(roster.querySelector('[data-mission-roster-list]'), list);
  assert.equal(count.textContent, '0 in 30 days');
  assert.equal(
    roster.textContent.includes('LOADING 30-DAY MISSION INDEX'),
    false,
  );
  assert.match(list.textContent, /No missions/);
  view.dispose();
  assert.equal(roster.querySelector('[data-mission-roster-count]'), count);
  assert.equal(roster.querySelector('[data-mission-roster-list]'), list);
  assert.equal(list.children.length, 0);
});
