import { test } from 'node:test';
import assert from 'node:assert/strict';
import { container as fixtureRoot } from '../testSupport/componentDom.mjs';
const { DataLayerManager } = await import('./manager.js');
function makeControlElement() {
  const element = document.createElement('div');
  fixtureRoot.append(element);
  return element;
}
async function clickToggle(button, mgr, id) {
  button.click();
  await mgr.layers.get(button.closest('[data-layer-id]').dataset.layerId)
    .toggleChain;
  await Promise.resolve();
  await Promise.resolve();
}
function makeSlowLayer(id, { updateInterval = 1000 } = {}) {
  const calls = { enable: 0, disable: 0, update: 0, init: 0, presentation: [] };
  return {
    calls,
    module: {
      id,
      name: id,
      icon: '',
      source: 'test',
      updateInterval,
      async init() {
        calls.init++;
        await Promise.resolve();
      },
      enable() {
        calls.enable++;
      },
      disable() {
        calls.disable++;
      },
      async update() {
        calls.update++;
        await Promise.resolve();
      },
      setLifecyclePresentation(state) {
        calls.presentation.push({ ...state });
      },
      getStats() {
        return { count: 0, lastUpdate: null };
      },
    },
  };
}

test('renders ordinary layer rows without recreating a panel-hidden coordinator', async () => {
  const originalDocument = globalThis.document;

  const mgr = new DataLayerManager({});
  const ordinary = makeSlowLayer('flights', { updateInterval: -1 });
  const coordinator = makeSlowLayer('military-awareness', {
    updateInterval: -1,
  });
  coordinator.module.showInTogglePanel = false;
  mgr.register(ordinary.module);
  mgr.register(coordinator.module);
  const container = makeControlElement();

  try {
    mgr.buildTogglePanel(container);
    assert.ok(container.querySelector('[data-layer-id="flights"]'));
    assert.equal(
      container.querySelector('[data-layer-id="military-awareness"]'),
      null,
    );
    assert.equal(await mgr.setEnabled('military-awareness', true), true);
    mgr._refreshTogglePanel();
    assert.equal(
      container.querySelector('[data-layer-id="military-awareness"]'),
      null,
    );
    assert.equal(
      mgr.getAll().find(({ id }) => id === 'military-awareness').enabled,
      true,
    );
  } finally {
    await mgr.destroyAll();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
test('keyboard focus survives Data Layer enabling and disabling transitions', async () => {
  const originalDocument = globalThis.document;
  const mgr = new DataLayerManager({});
  let releaseEnable;
  let releaseDisable;
  const calls = { enable: 0, disable: 0 };
  mgr.register({
    id: 'focus-layer',
    name: 'Focus layer',
    icon: '',
    source: 'Local focus fixture',
    updateInterval: -1,
    init() {},
    enable() {
      calls.enable += 1;
      return new Promise((resolve) => {
        releaseEnable = resolve;
      });
    },
    disable() {
      calls.disable += 1;
      return new Promise((resolve) => {
        releaseDisable = resolve;
      });
    },
    update() {},
    destroy() {},
    getStats() {
      return { count: 1, lastUpdate: Date.now() };
    },
  });
  const container = makeControlElement();

  const waitFor = async (predicate, label) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (predicate()) return;
      await Promise.resolve();
    }
    assert.fail(`timed out waiting for ${label}`);
  };

  try {
    mgr.buildTogglePanel(container);
    const row = container.querySelector('[data-layer-id="focus-layer"]');
    const button = row.querySelector('.data-toggle-btn');
    button.focus();

    const enablingClick = clickToggle(button, mgr, 'wind');
    await waitFor(
      () => typeof releaseEnable === 'function',
      'enable transition',
    );
    assert.equal(globalThis.document.activeElement, button);
    assert.equal(button.disabled, false, 'ENABLING never uses native disabled');
    assert.equal(button.getAttribute('aria-disabled'), 'true');
    assert.equal(button.getAttribute('aria-busy'), 'true');
    assert.match(
      row.querySelector('.data-toggle-meta').textContent,
      /ENABLING/,
    );
    button.click();
    assert.equal(calls.enable, 1, 'repeat activation is inert while enabling');
    assert.equal(mgr.layers.get('focus-layer').visibilityIntentEpoch, 1);

    releaseEnable();
    await enablingClick;
    assert.equal(globalThis.document.activeElement, button);
    assert.equal(button.disabled, false);
    assert.equal(button.getAttribute('aria-disabled'), 'false');
    assert.equal(button.getAttribute('aria-busy'), 'false');
    assert.equal(mgr.isEnabled('focus-layer'), true);

    const disablingClick = clickToggle(button, mgr, 'wind');
    await waitFor(
      () => typeof releaseDisable === 'function',
      'disable transition',
    );
    assert.equal(globalThis.document.activeElement, button);
    assert.equal(
      button.disabled,
      false,
      'DISABLING never uses native disabled',
    );
    assert.equal(button.getAttribute('aria-disabled'), 'true');
    assert.equal(button.getAttribute('aria-busy'), 'true');
    assert.match(
      row.querySelector('.data-toggle-meta').textContent,
      /DISABLING/,
    );
    button.click();
    assert.equal(
      calls.disable,
      1,
      'repeat activation is inert while disabling',
    );
    assert.equal(mgr.layers.get('focus-layer').visibilityIntentEpoch, 2);

    releaseDisable();
    await disablingClick;
    assert.equal(globalThis.document.activeElement, button);
    assert.equal(button.disabled, false);
    assert.equal(button.getAttribute('aria-disabled'), 'false');
    assert.equal(button.getAttribute('aria-busy'), 'false');
    assert.equal(mgr.isEnabled('focus-layer'), false);
  } finally {
    releaseEnable?.();
    releaseDisable?.();
    await mgr.destroyAll();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('a failed Data Layer transition clears busy state without losing keyboard focus', async () => {
  const originalDocument = globalThis.document;
  const originalWarn = console.warn;
  console.warn = () => {};
  const mgr = new DataLayerManager({});
  let rejectEnable;
  let enableCalls = 0;
  mgr.register({
    id: 'focus-failure-layer',
    name: 'Focus failure layer',
    icon: '',
    source: 'Local focus fixture',
    updateInterval: -1,
    init() {},
    enable() {
      enableCalls += 1;
      if (enableCalls > 1) return true;
      return new Promise((resolve, reject) => {
        rejectEnable = reject;
      });
    },
    disable() {
      return true;
    },
    update() {},
    destroy() {},
    getStats() {
      return { count: 0, lastUpdate: null };
    },
  });
  const container = makeControlElement();

  try {
    mgr.buildTogglePanel(container);
    const button = container
      .querySelector('[data-layer-id="focus-failure-layer"]')
      .querySelector('.data-toggle-btn');
    button.focus();

    const failedClick = clickToggle(button, mgr, 'wind');
    for (
      let attempt = 0;
      attempt < 20 && typeof rejectEnable !== 'function';
      attempt += 1
    ) {
      await Promise.resolve();
    }
    assert.equal(typeof rejectEnable, 'function');
    assert.equal(globalThis.document.activeElement, button);
    assert.equal(button.getAttribute('aria-disabled'), 'true');
    assert.equal(button.getAttribute('aria-busy'), 'true');

    rejectEnable(new Error('QA enable rejected'));
    await failedClick;
    assert.equal(
      globalThis.document.activeElement,
      button,
      'failure settlement preserves focus',
    );
    assert.equal(button.disabled, false);
    assert.equal(button.getAttribute('aria-disabled'), 'false');
    assert.equal(button.getAttribute('aria-busy'), 'false');
    assert.match(button.getAttribute('aria-label'), /OFF/);
    assert.deepEqual(mgr.getLayerLifecycleState('focus-failure-layer'), {
      enabled: false,
      lifecycleState: 'disabled',
      uncertain: false,
    });

    await clickToggle(button, mgr);
    assert.equal(enableCalls, 2, 'the settled control accepts a later retry');
    assert.equal(globalThis.document.activeElement, button);
    assert.equal(mgr.isEnabled('focus-failure-layer'), true);
  } finally {
    rejectEnable?.(new Error('test cleanup'));
    console.warn = originalWarn;
    await mgr.destroyAll();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

/** Collect every node in a rendered subtree carrying `className`. */
function collectByClass(node, className) {
  const found = [];
  const visit = (current) => {
    if (String(current.className).split(/\s+/).includes(className))
      found.push(current);
    for (const child of current.children || []) visit(child);
  };
  visit(node);
  return found;
}

/** A layer that declares a two-state chip plus a legend, like satellites. */
function makeRowControlLayer() {
  let mode = 'core';
  return {
    get mode() {
      return mode;
    },
    module: {
      id: 'satellites',
      name: 'Satellites',
      icon: '',
      source: 'CelesTrak',
      updateInterval: -1,
      async init() {},
      enable() {},
      disable() {},
      async update() {},
      getStats() {
        return { count: 3, lastUpdate: Date.now() };
      },
      setParams(params) {
        if (params.catalog) mode = params.catalog;
      },
      getParams() {
        return { catalog: mode };
      },
      getRowControls() {
        const dense = mode === 'dense';
        return {
          chips: [
            {
              id: 'catalog',
              label: 'DENSE',
              active: dense,
              title: 'toggle the dense catalog',
              params: { catalog: dense ? 'core' : 'dense' },
            },
          ],
          legend: [
            {
              klass: 'nav',
              label: 'NAV',
              color: '#4fd8ff',
              blurb: 'GNSS',
              count: 2,
            },
            {
              klass: 'geo',
              label: 'GEO',
              color: '#c89bff',
              blurb: 'belt',
              count: 5,
            },
          ],
        };
      },
    },
  };
}

test('a layer that declares row controls renders its chips and color legend', async () => {
  const originalDocument = globalThis.document;
  const mgr = new DataLayerManager({});
  const layer = makeRowControlLayer();
  mgr.register(layer.module);
  const container = makeControlElement();

  try {
    mgr.buildTogglePanel(container);
    const row = container.querySelector('[data-layer-id="satellites"]');
    const controls = row.querySelector('.data-toggle-controls');
    assert.ok(controls, 'the row gained a controls block');
    // Disabled layers stay quiet — no chip, no legend.
    assert.equal(controls.hidden, true);

    assert.equal(await mgr.setEnabled('satellites', true), true);
    mgr._refreshTogglePanel();
    assert.equal(controls.hidden, false);

    const chips = collectByClass(controls, 'data-toggle-chip');
    assert.equal(chips.length, 1);
    assert.equal(chips[0].textContent, 'DENSE');
    assert.equal(chips[0].dataset.chipId, 'catalog');
    assert.equal(chips[0].getAttribute('aria-pressed'), 'false');
    assert.equal(chips[0].title, 'toggle the dense catalog');

    const swatches = collectByClass(controls, 'data-toggle-legend-swatch');
    assert.deepEqual(
      swatches.map((s) => s.style.background),
      ['rgb(79, 216, 255)', 'rgb(200, 155, 255)'],
      'each legend swatch is painted the exact class color',
    );
    const items = collectByClass(controls, 'data-toggle-legend-item');
    assert.deepEqual(
      items.map((i) => i.title),
      ['GNSS', 'belt'],
    );
    assert.equal(items.length, 2);
  } finally {
    await mgr.destroyAll();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('clicking a row chip applies the params it declared and re-renders', async () => {
  const originalDocument = globalThis.document;
  const mgr = new DataLayerManager({});
  const layer = makeRowControlLayer();
  mgr.register(layer.module);
  const container = makeControlElement();

  try {
    mgr.buildTogglePanel(container);
    assert.equal(await mgr.setEnabled('satellites', true), true);
    const row = container.querySelector('[data-layer-id="satellites"]');
    const controls = row.querySelector('.data-toggle-controls');
    const chip = collectByClass(controls, 'data-toggle-chip')[0];

    chip.click();
    assert.equal(layer.mode, 'dense', 'the chip wrote the params it declared');
    // setLayerParams refreshes the panel, so the chip already reflects the flip.
    const afterOn = collectByClass(controls, 'data-toggle-chip')[0];
    assert.equal(afterOn.getAttribute('aria-pressed'), 'true');
    assert.equal(afterOn.className.includes('active'), true);

    afterOn.click();
    assert.equal(
      layer.mode,
      'core',
      'the chip toggles back rather than latching',
    );
    assert.equal(
      collectByClass(controls, 'data-toggle-chip')[0].getAttribute(
        'aria-pressed',
      ),
      'false',
    );
  } finally {
    await mgr.destroyAll();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('a click outside a chip is inert, and a throwing layer cannot blank the panel', async () => {
  const originalDocument = globalThis.document;
  const warn = console.warn;
  console.warn = () => {};
  const mgr = new DataLayerManager({});
  const layer = makeRowControlLayer();
  mgr.register(layer.module);
  const container = makeControlElement();

  try {
    mgr.buildTogglePanel(container);
    assert.equal(await mgr.setEnabled('satellites', true), true);
    const row = container.querySelector('[data-layer-id="satellites"]');
    const controls = row.querySelector('.data-toggle-controls');

    const legendItem = collectByClass(controls, 'data-toggle-legend-item')[0];
    legendItem.click();
    assert.equal(layer.mode, 'core', 'the legend is not a control');
    controls.click();
    assert.equal(layer.mode, 'core');

    layer.module.getRowControls = () => {
      throw new Error('boom');
    };
    mgr._refreshTogglePanel();
    assert.equal(
      controls.hidden,
      true,
      'a throwing layer collapses to an empty block',
    );
    assert.ok(
      container.querySelector('[data-layer-id="satellites"]'),
      'the row itself survives',
    );
  } finally {
    console.warn = warn;
    await mgr.destroyAll();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('keyboard focus on a chip survives the refresh its own click triggers', async () => {
  // _syncRowControls runs on EVERY panel refresh, including the one the chip's
  // own click triggers. Rebuilding the button would blur it every time, so a
  // keyboard user loses their place on activation.
  const originalDocument = globalThis.document;
  const mgr = new DataLayerManager({});
  const layer = makeRowControlLayer();
  mgr.register(layer.module);
  const container = makeControlElement();

  try {
    mgr.buildTogglePanel(container);
    assert.equal(await mgr.setEnabled('satellites', true), true);
    const controls = container
      .querySelector('[data-layer-id="satellites"]')
      .querySelector('.data-toggle-controls');
    const chip = collectByClass(controls, 'data-toggle-chip')[0];

    chip.focus();
    assert.equal(
      globalThis.document.activeElement,
      chip,
      'the chip starts focused',
    );

    chip.click();
    assert.equal(
      globalThis.document.activeElement,
      chip,
      'activating the chip does not blur it',
    );
    assert.equal(
      collectByClass(controls, 'data-toggle-chip')[0],
      chip,
      'the SAME button node is reused across the click-driven refresh',
    );

    mgr._refreshTogglePanel();
    mgr._refreshTogglePanel();
    assert.equal(
      globalThis.document.activeElement,
      chip,
      'repeated refreshes never steal focus',
    );
    // Legend entries hold no focus, so they may be replaced — never duplicated.
    assert.equal(collectByClass(controls, 'data-toggle-legend-item').length, 2);

    // ...and a chip that genuinely goes away still releases focus.
    layer.module.getRowControls = () => ({ chips: [], legend: [] });
    mgr._refreshTogglePanel();
    assert.equal(globalThis.document.activeElement, document.body);
  } finally {
    await mgr.destroyAll();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('an async layer pushes its own row refresh, and a busy chip refuses clicks', async () => {
  const originalDocument = globalThis.document;
  const mgr = new DataLayerManager({});

  let settled = false;
  let writes = 0;
  const module = {
    id: 'satellites',
    name: 'Satellites',
    icon: '',
    source: 'CelesTrak',
    updateInterval: -1,
    async init() {},
    enable() {},
    disable() {},
    async update() {},
    getStats() {
      return { count: 1, lastUpdate: Date.now() };
    },
    setParams() {
      writes += 1;
    },
    getRowControls() {
      return {
        chips: [
          {
            id: 'catalog',
            label: settled ? 'DENSE' : 'DENSE ···',
            active: settled,
            busy: !settled,
            disabled: !settled,
            state: settled ? 'active' : 'loading',
            title: 'x',
            params: { catalog: 'core' },
          },
        ],
        legend: [],
      };
    },
    setRowControlsListener(fn) {
      module._listener = fn;
    },
  };
  mgr.register(module);
  const container = makeControlElement();

  try {
    mgr.buildTogglePanel(container);
    assert.equal(await mgr.setEnabled('satellites', true), true);
    assert.equal(
      typeof module._listener,
      'function',
      'the manager installed its listener',
    );

    const controls = container
      .querySelector('[data-layer-id="satellites"]')
      .querySelector('.data-toggle-controls');
    const chip = collectByClass(controls, 'data-toggle-chip')[0];
    assert.equal(chip.textContent, 'DENSE ···');
    assert.equal(chip.disabled, true);
    assert.equal(chip.getAttribute('aria-busy'), 'true');
    assert.equal(
      chip.getAttribute('aria-pressed'),
      'false',
      'busy is never reported as active',
    );
    assert.equal(chip.className.includes('chip-loading'), true);

    chip.click();
    assert.equal(writes, 0, 'a disabled chip is inert');

    // The layer settles and pushes its own refresh — no panel poll involved.
    settled = true;
    module._listener();
    mgr._layerPanel._flushRowControlsRefresh();
    assert.equal(chip.textContent, 'DENSE');
    assert.equal(chip.disabled, false);
    assert.equal(chip.getAttribute('aria-pressed'), 'true');
    assert.equal(chip.getAttribute('aria-busy'), 'false');

    chip.click();
    assert.equal(writes, 1, 'the settled chip writes again');
  } finally {
    await mgr.destroyAll();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('a layer that surrenders its row controls hides the block entirely', async () => {
  // Space Missions borrows the satellite layer with showPoints:false; the row
  // must not advertise a legend for an empty sky or offer a chip whose write
  // the dependency owner will silently revert.
  const originalDocument = globalThis.document;
  const mgr = new DataLayerManager({});
  let surrendered = false;
  const layer = makeRowControlLayer();
  const inner = layer.module.getRowControls;
  layer.module.getRowControls = () =>
    surrendered ? { chips: [], legend: [] } : inner();
  mgr.register(layer.module);
  const container = makeControlElement();

  try {
    mgr.buildTogglePanel(container);
    assert.equal(await mgr.setEnabled('satellites', true), true);
    const controls = container
      .querySelector('[data-layer-id="satellites"]')
      .querySelector('.data-toggle-controls');
    assert.equal(controls.hidden, false);
    assert.equal(collectByClass(controls, 'data-toggle-chip').length, 1);

    surrendered = true;
    mgr._refreshTogglePanel();
    assert.equal(controls.hidden, true);
    assert.equal(
      collectByClass(controls, 'data-toggle-chip').length,
      0,
      'the chip is removed, not merely hidden behind a style',
    );
    assert.equal(collectByClass(controls, 'data-toggle-legend-item').length, 0);

    surrendered = false;
    mgr._refreshTogglePanel();
    assert.equal(
      controls.hidden,
      false,
      'the row returns when the owner releases it',
    );
    assert.equal(collectByClass(controls, 'data-toggle-chip').length, 1);
  } finally {
    await mgr.destroyAll();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('layer metadata shows a guidance prompt without reporting it as a fault', () => {
  const mgr = new DataLayerManager({});
  const text = mgr._buildMetaText({
    enabled: true,
    source: 'OpenStreetMap',
    stats: {
      status: 'zoom-in',
      error: null,
      count: 0,
      statusMessage: 'Zoom in to search mapped installations',
    },
  });
  assert.match(text, /Zoom in to search mapped installations$/);
  assert.doesNotMatch(text, /UNAVAILABLE|DEGRADED/);
});

test('panel remount releases old listeners and destruction revokes retained controls', async () => {
  const originalDocument = globalThis.document;
  const manager = new DataLayerManager({});
  const layer = makeSlowLayer('lifecycle-panel', { updateInterval: -1 });
  let rowListener;
  layer.module.getRowControls = () => ({ chips: [] });
  layer.module.setRowControlsListener = (listener) => {
    rowListener = listener;
  };
  manager.register(layer.module);
  try {
    const first = makeControlElement();
    manager.buildTogglePanel(first);
    const oldButton = first.querySelector('.data-toggle-btn');
    const retainedClick = () => oldButton.click();
    const second = makeControlElement();
    manager.buildTogglePanel(second);
    assert.equal(oldButton.isConnected, false);
    await retainedClick();
    assert.equal(
      layer.calls.enable,
      0,
      'a revoked generation cannot issue actions',
    );
    const currentButton = second.querySelector('.data-toggle-btn');
    assert.equal(currentButton.isConnected, true);
    assert.equal(typeof rowListener, 'function');
    await manager.destroyAll();
    assert.equal(currentButton.isConnected, false);
    assert.equal(rowListener, null);
  } finally {
    await manager.destroyAll();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('row action chips use live disabled state and descriptive counts without writing parameters', async () => {
  const originalDocument = globalThis.document;
  const mgr = new DataLayerManager({});
  const layer = makeRowControlLayer();
  let calls = 0,
    blocked = false;
  layer.module.getStats = () => ({ count: 3, countLabel: '3 nearby' });
  layer.module.getRowControls = () => ({
    chips: [
      {
        id: 'find',
        label: 'SHOW NEAREST',
        disabled: blocked,
        onClick: () => calls++,
      },
    ],
  });
  layer.module.setParams = () => {
    throw new Error('navigation must not write persistent params');
  };
  mgr.register(layer.module);
  const container = makeControlElement();
  try {
    mgr.buildTogglePanel(container);
    await mgr.setEnabled('satellites', true);
    const row = container.querySelector('[data-layer-id="satellites"]');
    assert.equal(row.querySelector('.data-count').textContent, '3 nearby');
    const controls = row.querySelector('.data-toggle-controls');
    const chip = collectByClass(controls, 'data-toggle-chip')[0];
    chip.click();
    assert.equal(calls, 1);
    blocked = true;
    chip.click();
    assert.equal(calls, 1, 'live disabled descriptor wins before row repaint');
    blocked = false;
    await mgr.setEnabled('satellites', false);
    chip.click();
    assert.equal(calls, 1, 'disabled layer cannot navigate');
  } finally {
    await mgr.destroyAll();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

for (const scheduler of ['animation frame', 'timeout']) {
  test(`row notifications coalesce with ${scheduler} and stop after destroy`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const frames = new Map();
    let nextFrame = 0;
    const originalRaf = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame =
      scheduler === 'animation frame'
        ? (callback) => {
            frames.set(++nextFrame, callback);
            return nextFrame;
          }
        : undefined;
    globalThis.cancelAnimationFrame = (id) => frames.delete(id);
    const originalDocument = globalThis.document;
    const manager = new DataLayerManager({});
    const layer = makeSlowLayer('wind', { updateInterval: -1 });
    let notify;
    layer.module.getRowControls = () => ({ chips: [] });
    layer.module.setRowControlsListener = (listener) => {
      if (listener) notify = listener;
    };
    manager.register(layer.module);
    try {
      manager.buildTogglePanel(makeControlElement());
      const panel = manager._layerPanel;
      let refreshes = 0;
      const refresh = panel._refreshTogglePanel.bind(panel);
      panel._refreshTogglePanel = () => {
        refreshes++;
        refresh();
      };
      for (let i = 0; i < 10; i++) notify();
      assert.equal(refreshes, 0, 'notifications defer refresh');
      if (scheduler === 'animation frame') assert.equal(frames.size, 1);
      panel._flushRowControlsRefresh();
      assert.equal(refreshes, 1);
      panel._flushRowControlsRefresh();
      t.mock.timers.tick(0);
      assert.equal(frames.size, 0, 'flush cancels the pending frame');
      assert.equal(refreshes, 1, 'flush does not leave duplicate work');
      notify();
      notify();
      if (scheduler === 'animation frame') {
        const [id, callback] = frames.entries().next().value;
        frames.delete(id);
        callback();
      } else t.mock.timers.tick(0);
      assert.equal(refreshes, 2, 'scheduled callback refreshes once');
      notify();
      panel.destroy();
      assert.equal(frames.size, 0, 'destroy cancels pending work');
      notify();
      panel._flushRowControlsRefresh();
      t.mock.timers.tick(0);
      assert.equal(
        refreshes,
        2,
        'retained notifications after destroy are inert',
      );
    } finally {
      await manager.destroyAll();
      if (originalDocument === undefined) delete globalThis.document;
      else globalThis.document = originalDocument;
      if (originalRaf === undefined) delete globalThis.requestAnimationFrame;
      else globalThis.requestAnimationFrame = originalRaf;
      if (originalCancel === undefined) delete globalThis.cancelAnimationFrame;
      else globalThis.cancelAnimationFrame = originalCancel;
    }
  });
}

test('row info and legends reconcile in place while chips retain focus and order', async () => {
  const originalDocument = globalThis.document;
  const manager = new DataLayerManager({});
  const layer = makeSlowLayer('wind', { updateInterval: -1 });
  let controls = {
    chips: [{ id: 'one', label: 'One' }],
    legend: [{ label: 'Low', color: '#0000ff', count: 1, blurb: 'Low values' }],
    info: 'Forecast',
    infoTitle: 'Source time',
  };
  layer.module.getRowControls = () => controls;
  manager.register(layer.module);
  try {
    const container = makeControlElement();
    manager.buildTogglePanel(container);
    await manager.setEnabled('wind', true);
    const row = container.querySelector('.data-toggle-controls');
    const chip = row.children[0];
    let legend = row.children[1];
    const info = row.children[2];
    chip.focus();
    let writes = 0;
    for (const key of ['textContent', 'title']) {
      let value = info[key];
      Object.defineProperty(info, key, {
        get: () => value,
        set: (next) => {
          writes++;
          value = next;
        },
      });
    }
    controls = structuredClone(controls);
    manager._refreshTogglePanel();
    assert.equal(row.children[1], legend);
    assert.equal(row.children[2], info);
    assert.equal(writes, 0);
    for (const change of [
      { label: 'High' },
      { color: '#ff0000' },
      { count: 2 },
      { blurb: 'High values' },
    ]) {
      Object.assign(controls.legend[0], change);
      manager._refreshTogglePanel();
      assert.notEqual(row.children[1], legend);
      legend = row.children[1];
      assert.equal(row.children[2], info);
      assert.equal(globalThis.document.activeElement, chip);
    }
    controls.info = '<img onerror=alert(1)>';
    controls.infoTitle = '';
    controls.chips.push({ id: 'two', label: 'Two' });
    manager._refreshTogglePanel();
    assert.deepEqual(
      Array.from(row.children, (node) => node.className),
      [
        'data-toggle-chip chip-idle',
        'data-toggle-chip chip-idle',
        'data-toggle-legend-item',
        'data-toggle-controls-info',
      ],
    );
    assert.equal(row.children[2], legend);
    assert.equal(row.children[3], info);
    assert.equal(info.textContent, controls.info);
    assert.equal(info.title, '');
    assert.equal(info.children.length, 0, 'info remains plain text');
    controls = { chips: [], legend: [] };
    manager._refreshTogglePanel();
    assert.equal(row.hidden, true);
    assert.equal(info.hidden, true);
    assert.deepEqual([...row.children], [info]);
    controls = {
      info: 'Restored',
      legend: [{ label: 'New', color: '#ffffff' }],
    };
    manager._refreshTogglePanel();
    assert.equal([...row.children].at(-1), info);
    assert.equal(info.hidden, false);
    assert.equal(info.textContent, 'Restored');
  } finally {
    await manager.destroyAll();
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
