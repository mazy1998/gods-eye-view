import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { container } from '../testSupport/componentDom.mjs';
import { LayerLifecycle } from '../data/lifecycle.js';
import { ContextControls } from './contextControls.js';
import { sceneRequiresContextModeExit } from '../scenes/scenePolicy.js';
import { contextLayerEnableBlockReason } from '../contextModePolicy.js';

const turn = () => new Promise((resolve) => setImmediate(resolve));
const hold = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
function fixture(t) {
  container.innerHTML = readFileSync(
    new URL('./templates/context.html', import.meta.url),
    'utf8',
  );
  const manager = new LayerLifecycle({});
  const log = [],
    notices = [],
    hooks = {};
  for (const id of [
    'flights',
    'weather',
    'other',
    'rocket-launches',
    'satellites',
    'military-awareness',
  ]) {
    manager.register({
      id,
      name: id,
      updateInterval: -1,
      async init() {
        await hooks[id + ':init']?.();
      },
      async enable() {
        log.push(id + ':enable:start');
        const result = await hooks[id + ':enable']?.();
        log.push(id + ':enable:end');
        return result;
      },
      async disable() {
        log.push(id + ':disable:start');
        const result = await hooks[id + ':disable']?.();
        log.push(id + ':disable:end');
        return result;
      },
      async update() {},
      getStats: () => ({ count: 0 }),
    });
  }
  const ids = {
    _globalContextPanel: 'global-context-panel',
    _globalContextFlightsBtn: 'global-context-flights-btn',
    _globalContextMissionsBtn: 'global-context-missions-btn',
    _globalContextCamerasBtn: 'global-context-cameras-btn',
    _contextModeStandby: 'context-mode-standby',
    _contextFlightsView: 'context-flights-view',
    _contextMissionsView: 'context-missions-view',
    _contextCamerasView: 'context-cameras-view',
    _exitSpaceMissionsBtn: 'space-missions-exit-btn',
  };
  const controls = new ContextControls({
    elements: Object.fromEntries(
      Object.entries(ids).map(([key, id]) => [
        key,
        document.getElementById(id),
      ]),
    ),
    installations: {},
    actions: {
      getCockpit: () => null,
      claimVisualAuthority() {},
      showToast: (n) => notices.push(n),
      setClearBusy() {},
      syncDetection() {},
      scheduleLayout() {},
      refreshRadio() {},
      setPanelCollapsed() {},
    },
  });
  controls.connect(manager);
  t.after(async () => {
    for (const key of Object.keys(hooks)) delete hooks[key];
    controls.stop();
    controls.disconnect();
    await manager.destroyAll();
  });
  return { manager, controls, log, notices, hooks };
}
async function enter(f) {
  await f.manager.setEnabled('weather', true);
  assert.equal((await f.controls.setContextMode('space-missions')).ok, true);
  assert.equal(f.manager.isEnabled('weather'), false);
  f.log.length = 0;
}

test(
  'an explicit enable awaits mission shutdown and the exact restore before starting the requested layer',
  { timeout: 3000 },
  async (t) => {
    const f = fixture(t);
    await enter(f);
    const gate = hold();
    t.after(() => gate.resolve());
    f.hooks['weather:enable'] = () => gate.promise;
    const request = f.manager.setEnabled('flights', true, { origin: 'user' });
    await turn();
    assert.ok(f.log.includes('weather:enable:start'));
    assert.equal(f.manager.isEnabled('rocket-launches'), false);
    assert.equal(f.log.includes('flights:enable:start'), false);
    gate.resolve();
    assert.equal(await request, true);
    assert.ok(
      f.log.indexOf('rocket-launches:disable:end') <
        f.log.indexOf('weather:enable:start'),
    );
    assert.ok(
      f.log.indexOf('weather:enable:end') <
        f.log.indexOf('flights:enable:start'),
    );
    assert.equal(f.manager.isEnabled('weather'), true);
    assert.equal(f.controls.getContextModeState().mode, null);
    assert.equal(f.controls.getContextModeState().snapshotCaptured, false);
    assert.equal(f.notices.length, 1);
    assert.match(f.notices[0], /Left Space Missions to show/);
  },
);

test('programmatic, restore and origin-less scene policy still refuse isolated enables', async (t) => {
  const f = fixture(t);
  await enter(f);
  for (const origin of ['programmatic', 'restore', 'share-restore'])
    assert.equal(
      await f.manager.setEnabled('flights', true, { origin }),
      false,
    );
  assert.equal(f.controls.getContextModeState().mode, 'space-missions');
  assert.equal(f.manager.isEnabled('flights'), false);
  assert.equal(sceneRequiresContextModeExit('space-missions'), true);
  assert.ok(
    contextLayerEnableBlockReason({
      contextMode: 'space-missions',
      change: { layerId: 'flights', enabled: true },
    }),
  );
  assert.equal((await f.controls.setContextMode('off')).ok, true);
  assert.equal(
    await f.manager.setEnabled('flights', true, { origin: 'programmatic' }),
    true,
  );
});

for (const direct of [false, true])
  test(
    `user enable during ${direct ? 'direct layer' : 'tab'} entry cancels entry without stranding the mode`,
    { timeout: 3000 },
    async (t) => {
      const f = fixture(t);
      await f.manager.setEnabled('weather', true);
      const gate = hold();
      t.after(() => gate.resolve());
      f.hooks['rocket-launches:init'] = () => gate.promise;
      const entry = direct
        ? f.manager.setEnabled('rocket-launches', true, { origin: 'user' })
        : f.controls.setContextMode('space-missions');
      await turn();
      const request = f.manager.setEnabled('flights', true, {
        origin: 'voice',
      });
      await turn();
      gate.resolve();
      await entry;
      assert.equal(await request, true);
      assert.equal(f.manager.isEnabled('flights'), true);
      assert.equal(f.manager.isEnabled('weather'), true);
      assert.equal(f.manager.isEnabled('rocket-launches'), false);
      assert.deepEqual(
        [
          f.controls.getContextModeState().mode,
          f.controls.getContextModeState().entering,
          f.controls.getContextModeState().changing,
        ],
        [null, null, false],
      );
    },
  );

test(
  'two enables share exit, including an enable arriving during snapshot restoration',
  { timeout: 3000 },
  async (t) => {
    const f = fixture(t);
    await enter(f);
    const gate = hold();
    t.after(() => gate.resolve());
    f.hooks['weather:enable'] = () => gate.promise;
    const first = f.manager.setEnabled('flights', true, { origin: 'user' });
    await turn();
    const second = f.manager.setEnabled('other', true, { origin: 'voice' });
    await turn();
    assert.equal(f.log.includes('flights:enable:start'), false);
    assert.equal(f.log.includes('other:enable:start'), false);
    gate.resolve();
    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.equal(f.manager.isEnabled('weather'), true);
    assert.equal(f.manager.isEnabled('other'), true);
    assert.equal(f.notices.length, 2);
  },
);

test(
  'Clear All supersedes a pending automatic exit and enable without resurrecting its snapshot',
  { timeout: 3000 },
  async (t) => {
    const f = fixture(t);
    await enter(f);
    const gate = hold();
    t.after(() => gate.resolve());
    f.hooks['weather:enable'] = () => gate.promise;
    const request = f.manager.setEnabled('flights', true, { origin: 'user' });
    await turn();
    const clear = f.controls.clearSelectedLayers();
    gate.resolve();
    await Promise.all([request, clear]);
    assert.deepEqual([...f.manager.getEnabledLayerIds()], []);
    assert.equal(f.controls.getContextModeState().snapshotCaptured, false);
    assert.equal(f.controls.getContextModeState().changing, false);
    assert.equal(
      f.notices.some((n) => n.startsWith('Left Space Missions')),
      false,
    );
  },
);

test('the visible exit remains available from Missions and Cameras, uses normal restoration, then restores focus', async (t) => {
  const f = fixture(t);
  const button = document.getElementById('space-missions-exit-btn');
  assert.equal(button.hidden, true);
  await enter(f);
  assert.equal(button.hidden, false);
  f.controls.showInspectTab('cameras');
  assert.equal(button.hidden, false);
  button.focus();
  button.click();
  await f.controls._waitForContextLayerSettlement();
  assert.equal(f.controls.getContextModeState().mode, null);
  assert.equal(f.manager.isEnabled('weather'), true);
  assert.equal(button.hidden, true);
  assert.equal(document.activeElement.id, 'global-context-cameras-btn');
});

test(
  'a newer OFF supersedes an automatic-exit enable without a success notice',
  { timeout: 3000 },
  async (t) => {
    const f = fixture(t);
    await enter(f);
    const gate = hold();
    t.after(() => gate.resolve());
    f.hooks['weather:enable'] = () => gate.promise;
    const on = f.manager.setEnabled('flights', true, { origin: 'user' });
    await turn();
    const off = f.manager.setEnabled('flights', false, { origin: 'voice' });
    gate.resolve();
    assert.deepEqual(await Promise.all([on, off]), [false, true]);
    assert.equal(f.manager.isEnabled('flights'), false);
    assert.equal(
      f.notices.some((n) => n.startsWith('Left Space Missions')),
      false,
    );
  },
);

test('a failed exit retains its restore target and refuses the requested layer with one failure notice', async (t) => {
  const f = fixture(t);
  await enter(f);
  f.hooks['weather:enable'] = () => false;
  assert.equal(
    await f.manager.setEnabled('flights', true, { origin: 'user' }),
    false,
  );
  assert.equal(f.manager.isEnabled('flights'), false);
  assert.equal(f.controls.getContextModeState().snapshotCaptured, true);
  assert.equal(f.notices.length, 1);
  assert.equal(
    f.notices.some((n) => n.startsWith('Left Space Missions')),
    false,
  );
  delete f.hooks['weather:enable'];
  assert.equal(await f.controls._selectContextMode(null), true);
  assert.equal(f.manager.isEnabled('weather'), true);
});

test(
  'a blocked enable after a deferred mission entry during Clear does not strand the mode',
  { timeout: 3000 },
  async (t) => {
    const f = fixture(t);
    await f.manager.setEnabled('weather', true);
    const gate = hold();
    t.after(() => gate.resolve());
    f.hooks['weather:disable'] = () => gate.promise;
    const clear = f.controls.clearSelectedLayers();
    await turn();
    const mission = f.manager.setEnabled('rocket-launches', true, {
      origin: 'user',
    });
    const flight = f.manager.setEnabled('flights', true, { origin: 'user' });
    gate.resolve();
    await Promise.all([clear, mission, flight]);
    assert.equal(f.controls.getContextModeState().changing, false);
    assert.equal(f.controls.getContextModeState().entering, null);
    assert.equal(f.manager.isEnabled('flights'), true);
    assert.equal(f.controls.getContextModeState().mode, null);
  },
);

test(
  'a newer Context entry supersedes the automatic exit without stale mode flags or mixed replay data',
  { timeout: 3000 },
  async (t) => {
    const f = fixture(t);
    await enter(f);
    const gate = hold();
    t.after(() => gate.resolve());
    f.hooks['weather:enable'] = () => gate.promise;
    const flight = f.manager.setEnabled('flights', true, { origin: 'user' });
    await turn();
    const mission = f.controls.setContextMode('space-missions');
    gate.resolve();
    assert.equal((await mission).ok, true);
    await flight;
    assert.equal(f.controls.getContextModeState().mode, 'space-missions');
    assert.equal(f.controls.getContextModeState().changing, false);
    assert.equal(f.manager.isEnabled('flights'), false);
    assert.equal(f.manager.isEnabled('weather'), false);
    assert.equal(f.manager.isEnabled('rocket-launches'), true);
  },
);

test(
  'Clear during a Layers-off exit is a silent supersession, not a restore failure',
  { timeout: 3000 },
  async (t) => {
    const f = fixture(t);
    await enter(f);
    const gate = hold();
    t.after(() => gate.resolve());
    f.hooks['weather:enable'] = () => gate.promise;
    assert.equal(
      await f.manager.setEnabled('rocket-launches', false, { origin: 'user' }),
      true,
    );
    await turn();
    assert.ok(f.log.includes('weather:enable:start'));
    const clear = f.controls.clearSelectedLayers();
    gate.resolve();
    await clear;
    await f.controls._waitForContextLayerSettlement();
    assert.deepEqual([...f.manager.getEnabledLayerIds()], []);
    assert.equal(f.controls.getContextModeState().changing, false);
    assert.equal(f.notices.length, 1, 'only Clear reports an outcome');
    assert.match(f.notices[0], /^Cleared /);
  },
);
