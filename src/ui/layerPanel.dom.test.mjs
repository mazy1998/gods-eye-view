import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';

const { LayerPanel } = await import('./layerPanel.js');
const { createStateChannel } = await import('../app/stateChannel.js');

function fixture(t, overrides = {}) {
  const layers = [
    {
      id: 'flights',
      name: 'Flights',
      icon: '*',
      source: 'Fixture',
      enabled: false,
      showInTogglePanel: true,
      stats: {},
    },
  ];
  const panel = new LayerPanel({
    getLayers: () => layers,
    isEnabled: (id) =>
      Boolean(layers.find((layer) => layer.id === id)?.enabled),
    setEnabled() {},
    setLayerParams() {},
    getRowControls: () => null,
    hasRowControls: () => false,
    subscribeRowControls() {},
    ...overrides,
  });
  t.after(() => panel.destroy());
  panel.mount(container);
  return { panel, layers };
}

test('busy is synchronous and focusable, repeated activation is guarded, and detached controls are revoked', async (t) => {
  let finish,
    calls = 0;
  const { panel } = fixture(t, {
    setEnabled: () => {
      calls++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const button = container.querySelector('.data-toggle-btn');
  button.focus();
  button.click();
  button.click();
  assert.equal(calls, 1);
  assert.equal(button.getAttribute('aria-busy'), 'true');
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'OFF');
  assert.equal(document.activeElement, button);
  panel.mount(container);
  button.click();
  assert.equal(calls, 1);
  finish();
  await Promise.resolve();
  const next = container.querySelector('.data-toggle-btn');
  assert.equal(next.getAttribute('aria-busy'), 'false');
  panel.destroy();
  next.click();
  assert.equal(calls, 1);
});

test('voice reveal makes filtered rows visible without changing their English name', async (t) => {
  const { nextTick } = await import('vue');
  fixture(t);
  const input = container.querySelector('input[type=search]');
  input.value = 'no such layer';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
  const row = container.querySelector('[data-layer-id=flights]');
  assert.equal(row.style.display, 'none');
  container.dispatchEvent(
    new CustomEvent('gev:focus-layer-row', { detail: 'flights' }),
  );
  await nextTick();
  assert.notEqual(row.style.display, 'none');
  assert.equal(row.dataset.layerName, 'Live Flights');
  assert.equal(input.value, '');
});

test('My data uses the import owner channel and actions, without becoming a registered layer', async (t) => {
  const { nextTick } = await import('vue');
  const { panel, layers } = fixture(t);
  let files = [
    {
      id: 'file-1',
      name: 'Route.geojson',
      format: 'GeoJSON',
      entityCount: 2,
      visible: true,
    },
  ];
  const channel = createStateChannel(() => ({ files }));
  const calls = [];
  const search = container.querySelector('input[type=search]');
  search.focus();
  panel.attachImports({
    channel,
    list: () => files,
    setVisible(id, visible) {
      calls.push(['visible', id, visible]);
      files = files.map((file) => ({ ...file, visible }));
      channel.publish();
    },
    flyTo: (id) => calls.push(['fly', id]),
    remove(id) {
      calls.push(['remove', id]);
      files = [];
      channel.publish();
    },
  });
  assert.equal(container.querySelector('input[type=search]'), search);
  assert.equal(document.activeElement, search);
  container.querySelectorAll('[role=tab]')[2].click();
  await nextTick();
  const imported = container.querySelector('[data-import-id=file-1]');
  imported.querySelector('[role=switch]').click();
  assert.deepEqual(calls[0], ['visible', 'file-1', false]);
  assert.equal(
    imported.querySelector('.gev-icon-button').getAttribute('aria-label'),
    'Fly to Route.geojson',
  );
  imported.querySelector('.gev-icon-button').click();
  imported.querySelector('.gev-action-button').click();
  assert.deepEqual(calls.slice(1), [
    ['fly', 'file-1'],
    ['remove', 'file-1'],
  ]);
  assert.equal(container.querySelector('[data-import-id]'), null);
  assert.equal(layers.length, 1);
  panel.attachImports(null);
  assert.equal(container.querySelector('input[type=search]'), search);
  files = [{ id: 'stale', name: 'Detached.geojson' }];
  channel.publish();
  assert.equal(container.querySelector('[data-import-id]'), null);
  panel.destroy();
  channel.publish();
  channel.destroy();
});

test('readout chevrons open the existing detail host and detached actions are revoked', (t) => {
  const calls = [];
  const { panel, layers } = fixture(t, {
    getRowControls: () => ({ readout: true }),
    openDetails: (id) => calls.push(id),
  });
  layers[0].id = 'weather-radar';
  panel._refreshTogglePanel();
  const details = container.querySelector('.layer-details');
  assert.equal(details.getAttribute('aria-controls'), 'weather-panel');
  assert.equal(details.hasAttribute('aria-expanded'), false);
  assert.equal(details.disabled, true);
  details.click();
  assert.deepEqual(calls, []);
  layers[0].enabled = true;
  panel._refreshTogglePanel();
  assert.equal(details.disabled, false);
  details.click();
  assert.deepEqual(calls, ['weather-panel']);
  panel.destroy();
  details.click();
  assert.deepEqual(calls, ['weather-panel']);
});

test('descriptor refresh preserves focused chips and dispatches only the latest descriptor', (t) => {
  let active = false,
    changed,
    invoked = 0;
  const { panel, layers } = fixture(t, {
    hasRowControls: () => true,
    subscribeRowControls: (_id, callback) => {
      changed = callback;
      return () => {
        changed = null;
      };
    },
    getRowControls: () => ({
      chips: [
        {
          id: 'choice',
          label: active ? 'New' : 'Old',
          onClick: () => {
            invoked += active ? 10 : 1;
          },
        },
      ],
    }),
  });
  layers[0].enabled = true;
  panel._refreshTogglePanel();
  const chip = container.querySelector('[data-chip-id=choice]');
  chip.focus();
  active = true;
  changed();
  panel._flushRowControlsRefresh();
  assert.equal(container.querySelector('[data-chip-id=choice]'), chip);
  assert.equal(document.activeElement, chip);
  chip.click();
  assert.equal(invoked, 10);
  panel.destroy();
  assert.equal(changed, null);
  chip.click();
  assert.equal(invoked, 10);
});

test('readout rows contain only toggles and metadata; ordinary rows retain controls', async () => {
  const { LayerPanel } = await import('./layerPanel.js');
  const f = {
    document,
    container,
    find: (fn) => [...container.querySelectorAll('*')].find(fn),
  };
  const previousDocument = globalThis.document;
  globalThis.document = f.document;
  const ids = [
    'wind',
    'weather-radar',
    'weather-satellite',
    'weather-lightning',
    'weather-cyclones',
    'other',
  ];
  let refresh;
  const layers = ids.map((id) => ({
    id,
    name: id,
    icon: '*',
    source: 'Source',
    enabled: true,
    showInTogglePanel: true,
    stats: {},
  }));
  const calls = [];
  const panel = new LayerPanel({
    getLayers: () => layers,
    isEnabled: () => true,
    setEnabled: (...args) => calls.push(args),
    setLayerParams: (...args) => calls.push(args),
    hasRowControls: () => true,
    subscribeRowControls: (_id, callback) => {
      refresh = callback;
    },
    getRowControls: (id) => ({
      readout: id !== 'other',
      summary: { status: 'Loading' },
      info: 'Detailed time',
      chips: [{ id: 'config', label: 'Soft', params: { opacity: 'light' } }],
      legend: [{ label: 'Rain', color: '#abcdef' }],
      list: {
        items: [{ id: 'storm', text: 'Storm', params: { focus: true } }],
      },
    }),
  });
  try {
    panel.mount(f.container);
    for (const id of ids.slice(0, -1)) {
      const row = f.find((n) => n.dataset.layerId === id);
      assert.equal(row.children.length, 2);
      assert.ok(row.querySelector('.data-name'));
      assert.ok(row.querySelector('.data-toggle-meta'));
      for (const cls of [
        'data-toggle-chip',
        'data-count',
        'data-toggle-controls',
        'data-toggle-controls-status',
        'data-row-list',
      ])
        assert.equal(row.querySelector(`.${cls}`), null);
      row.querySelector('.data-toggle-btn').click();
    }
    assert.deepEqual(
      calls.map(([id]) => id),
      ids.slice(0, -1),
    );
    const ordinary = f.find((n) => n.dataset.layerId === 'other');
    assert.equal(
      ordinary.querySelector('.data-toggle-controls-info').textContent,
      'Detailed time',
    );
    assert.ok(ordinary.querySelector('.data-toggle-legend-item'));
    ordinary.querySelector('.data-toggle-chip').click();
    assert.deepEqual(calls.at(-1), [
      'other',
      { opacity: 'light' },
      { origin: 'user' },
    ]);
    assert.equal(typeof refresh, 'function');
  } finally {
    panel.destroy();
    globalThis.document = previousDocument;
  }
});

test('the Recent Imagery readout mounts in its rail body like the weather readout and is rebuilt or released with the panel', async () => {
  const { LayerPanel } = await import('./layerPanel.js');
  const f = {
    document,
    container,
    find: (fn) => [...container.querySelectorAll('*')].find(fn),
  };
  const body = f.document.createElement('div');
  body.id = 'recent-imagery-panel-body';
  document.body.append(body);
  const previousDocument = globalThis.document;
  globalThis.document = f.document;
  const mounted = [];
  const factory = (container) => {
    const readout = {
      container,
      destroyed: false,
      destroy() {
        this.destroyed = true;
      },
    };
    mounted.push(readout);
    return readout;
  };
  const panel = new LayerPanel({
    getLayers: () => [],
    isEnabled: () => false,
    setEnabled() {},
    setLayerParams() {},
    hasRowControls: () => false,
    subscribeRowControls() {},
    getRowControls: () => null,
  });
  try {
    panel.attachRecentImagery(factory);
    assert.equal(mounted.length, 0, 'no body before the panel mounts');
    panel.mount(f.container);
    assert.equal(mounted.length, 1);
    assert.equal(mounted[0].container, body);
    panel.mount(f.container);
    assert.equal(mounted[0].destroyed, true, 'a remount rebuilds it');
    assert.equal(mounted.length, 2);
    panel.attachRecentImagery(null);
    assert.equal(mounted[1].destroyed, true);
    panel.attachRecentImagery(factory);
    assert.equal(mounted.length, 3);
    panel.destroy();
    assert.equal(mounted[2].destroyed, true);
    panel.attachRecentImagery(factory);
    assert.equal(mounted.length, 3, 'a destroyed panel mounts nothing');
  } finally {
    panel.destroy();
    globalThis.document = previousDocument;
  }
});

test('the footer follows the one clear transaction synchronously from footer, legacy control and voice', async (t) => {
  const { ContextControls } = await import('./contextControls.js');
  const { bindClearLayersControl } = await import('./clearLayersControl.js');
  let legacyControl,
    settle,
    calls = 0;
  const owner = new ContextControls({
    elements: {},
    installations: {},
    actions: {
      getCockpit: () => null,
      setClearBusy: (busy) => legacyControl?.setBusy(busy),
      showToast() {},
    },
  });
  owner._syncContextModeButtons = () => {};
  owner._dataManager = {
    clearSelectedLayers: () => {
      calls++;
      return new Promise((resolve) => {
        settle = resolve;
      });
    },
  };
  const { panel } = fixture(t, {
    clearChannel: owner.clearChannel,
    clearSelectedLayers: () => owner.clearSelectedLayers(),
  });
  const legacy = document.body.appendChild(document.createElement('button'));
  legacyControl = bindClearLayersControl(legacy, () =>
    owner.clearSelectedLayers(),
  );
  t.after(() => {
    legacyControl.destroy();
    owner.stop();
  });
  const footer = container.querySelector('.layer-footer button');
  for (const start of [
    () => footer.click(),
    () => legacy.click(),
    () => owner.clearSelectedLayers(),
  ]) {
    footer.focus();
    start();
    const pending = owner._clearSelectedLayersPromise;
    assert.equal(footer.getAttribute('aria-busy'), 'true');
    assert.equal(footer.getAttribute('aria-disabled'), 'true');
    assert.equal(legacy.getAttribute('aria-busy'), 'true');
    assert.equal(footer.disabled, false);
    assert.equal(document.activeElement, footer);
    const before = calls;
    footer.click();
    assert.equal(owner.clearSelectedLayers(), pending);
    assert.equal(calls, before);
    settle({
      targetIds: ['flights'],
      clearedIds: ['flights'],
      notClearedIds: [],
    });
    await pending;
    assert.equal(footer.getAttribute('aria-busy'), 'false');
    assert.equal(footer.getAttribute('aria-disabled'), 'false');
    assert.equal(legacy.getAttribute('aria-busy'), 'false');
  }
  assert.equal(calls, 3);
  panel.destroy();
  footer.click();
  assert.equal(calls, 3);
});

test('an already-current list item scrolls into view on mount and remount', async (t) => {
  const { nextTick } = await import('vue');
  const previous = HTMLElement.prototype.scrollIntoView;
  const scrolled = [];
  HTMLElement.prototype.scrollIntoView = function () {
    scrolled.push(this.dataset.listItemId);
  };
  t.after(() => {
    if (previous) HTMLElement.prototype.scrollIntoView = previous;
    else delete HTMLElement.prototype.scrollIntoView;
  });
  const { panel } = fixture(t, {
    getLayers: () => [
      {
        id: 'directions',
        name: 'Directions',
        enabled: true,
        showInTogglePanel: true,
        stats: {},
      },
    ],
    getRowControls: () => ({
      list: {
        items: [{ id: 'step-2', current: true, text: 'Continue', lead: '2' }],
      },
    }),
  });
  await nextTick();
  assert.deepEqual(scrolled, ['step-2']);
  panel.mount(container);
  await nextTick();
  assert.deepEqual(scrolled, ['step-2', 'step-2']);
});

test('Directions follows the drawer destination without losing the phone disclosure or mounted controls', (t) => {
  let active = false;
  const drawerChannel = createStateChannel(() => ({
    active,
    destination: null,
  }));
  t.after(() => drawerChannel.destroy());
  const calls = [];
  const commands = [];
  const { panel, layers } = fixture(t, {
    drawerChannel,
    getRowControls: () => ({
      chips: [{ id: 'set-a', label: 'SET A', params: { arm: 'a' } }],
    }),
    openDetails: (id) => calls.push(id),
    setLayerParams: (...args) => commands.push(args),
  });
  layers[0].id = 'directions';
  layers[0].enabled = true;
  panel._refreshTogglePanel();
  const root = container.querySelector('#directions-controls-body');
  const details = container.querySelector('.layer-route-link');
  const controls = root.querySelector('.data-toggle-controls');
  assert.equal(controls.hidden, false, 'fallback retains its expanded default');
  assert.notEqual(root.style.display, 'none');
  assert.equal(details.textContent.includes('Tools'), false);
  details.click();
  panel._pushView();
  assert.equal(
    controls.hidden,
    true,
    'fallback closes in place without a Tools host',
  );
  assert.equal(details.getAttribute('aria-expanded'), 'false');
  assert.equal(root.style.display, 'none');
  assert.deepEqual(calls, []);
  active = true;
  drawerChannel.publish({ type: 'active-changed' });
  assert.equal(container.querySelector('#directions-controls-body'), root);
  assert.equal(
    controls.hidden,
    false,
    'Tools is independent of phone collapse',
  );
  assert.equal(
    details.getAttribute('aria-controls'),
    'directions-controls-body',
  );
  assert.equal(details.hasAttribute('aria-expanded'), false);
  details.click();
  assert.deepEqual(calls, ['directions-controls-body']);
  const host = document.createElement('div');
  host.className = 'gev-legacy-host';
  document.body.append(host);
  t.after(() => host.remove());
  const home = document.createComment('directions-home');
  root.before(home);
  host.append(root);
  const chip = root.querySelector('[data-chip-id=set-a]');
  layers[0].stats = { count: 2 };
  panel._refreshTogglePanel();
  assert.equal(root.parentNode, host, 'updates keep the same borrowed root');
  assert.equal(root.querySelector('[data-chip-id=set-a]'), chip);
  chip.click();
  assert.deepEqual(commands, [
    ['directions', { arm: 'a' }, { origin: 'user' }],
  ]);
  home.replaceWith(root);
  active = false;
  drawerChannel.publish({ type: 'active-changed' });
  assert.equal(details.getAttribute('aria-expanded'), 'false');
  assert.equal(controls.hidden, true, 'the fallback disclosure was retained');
  details.click();
  panel._pushView();
  assert.equal(controls.hidden, false);
  active = true;
  drawerChannel.publish();
  host.append(root);
  panel.destroy();
  assert.equal(root.parentNode, null, 'Vue removes a borrowed root on dispose');
  chip.click();
  assert.equal(commands.length, 1, 'retained borrowed controls are inert');
  details.click();
  active = true;
  drawerChannel.publish();
  assert.deepEqual(calls, ['directions-controls-body']);
  assert.equal(document.getElementById('directions-controls-body'), null);
});

test('the Tools switch owns the Directions transaction while Layers only navigates', async (t) => {
  const layer = {
    id: 'directions',
    name: 'Directions',
    enabled: false,
    showInTogglePanel: true,
    stats: {},
  };
  const drawerChannel = createStateChannel(() => ({
    active: true,
    destination: 'tools',
  }));
  t.after(() => drawerChannel.destroy());
  let finish,
    calls = 0;
  const { panel } = fixture(t, {
    drawerChannel,
    getLayers: () => [layer],
    isEnabled: () => layer.enabled,
    setEnabled: (_id, enabled) => {
      calls++;
      return new Promise((resolve) => {
        finish = () => {
          layer.enabled = enabled;
          resolve();
        };
      });
    },
  });
  const tools = container.querySelector(
    '#directions-controls-body [role=switch]',
  );
  assert.equal(container.querySelector('.data-toggle-top [role=switch]'), null);
  const link = container.querySelector('.layer-route-link');
  assert.match(link.textContent, /Route planning.*Tools \/ Directions/s);
  tools.click();
  assert.equal(calls, 1);
  assert.equal(tools.getAttribute('aria-busy'), 'true');
  tools.click();
  assert.equal(calls, 1);
  finish();
  await Promise.resolve();
  assert.equal(tools.getAttribute('aria-checked'), 'true');
  assert.equal(container.querySelector('.data-toggle-top [role=switch]'), null);
  panel.destroy();
  tools.click();
  assert.equal(calls, 1);
});

test('collapse retains its node and listener while sharing the search row, and returns for Cyber or teardown', async () => {
  const { mountView } = await import('./mountView.js');
  const { default: LayerPanelView } = await import('./LayerPanelView.vue');
  container.innerHTML =
    '<div id="home"><div id="data-panel"><div class="data-panel-inner"><div class="panel-header"><button class="panel-collapse-btn">Collapse</button></div><div id="data-toggles"></div></div></div></div><div class="gev-legacy-host"></div>';
  const panel = container.querySelector('#data-panel'),
    header = panel.querySelector('.panel-header'),
    button = header.querySelector('button'),
    home = container.querySelector('#home'),
    host = container.querySelector('.gev-legacy-host');
  let clicks = 0;
  button.addEventListener('click', () => clicks++);
  const view = mountView(LayerPanelView, {
    parent: panel.querySelector('#data-toggles'),
    props: { rows: [], files: [] },
  });
  const flush = () => new Promise((resolve) => queueMicrotask(resolve));
  try {
    assert.equal(button.parentElement, header);
    host.append(panel);
    await flush();
    assert.equal(button.parentElement, panel.querySelector('.layer-search'));
    const input = panel.querySelector('.layer-filter');
    assert.ok(
      input.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    button.click();
    assert.equal(clicks, 1);
    document.documentElement.dataset.uiTheme = 'cyber';
    await flush();
    assert.equal(button.parentElement, header);
    delete document.documentElement.dataset.uiTheme;
    await flush();
    assert.equal(button.parentElement, panel.querySelector('.layer-search'));
    home.append(panel);
    await flush();
    assert.equal(button.parentElement, header);
    host.append(panel);
    await flush();
    view.dispose();
    assert.equal(button.parentElement, header);
    button.click();
    assert.equal(clicks, 2);
  } finally {
    view.dispose();
  }
});

test('the real disclosure remains expandable and focused after collapse and theme moves', async () => {
  const { mountView } = await import('./mountView.js');
  const { bindPanelDisclosure } = await import('./panelDisclosure.js');
  const { default: LayerPanelView } = await import('./LayerPanelView.vue');
  container.innerHTML =
    '<div class="gev-legacy-host"><div id="data-panel" class="panel-collapsible"><div class="data-panel-inner"><div class="panel-header"><button class="panel-collapse-btn" data-collapse-target="data-panel">−</button></div><div id="data-toggles"></div></div></div></div>';
  const panel = container.querySelector('#data-panel');
  const button = panel.querySelector('button');
  const header = panel.querySelector('.panel-header');
  let changes = 0;
  const disclosure = bindPanelDisclosure({
    panel,
    buttons: [button],
    onEscape() {},
    onChange(collapsed) {
      changes++;
      panel.classList.toggle('collapsed', collapsed);
      button.textContent = collapsed ? '+' : '−';
      button.setAttribute('aria-expanded', String(!collapsed));
    },
  });
  const view = mountView(LayerPanelView, {
    parent: panel.querySelector('#data-toggles'),
    props: { rows: [] },
  });
  const flush = () => new Promise((resolve) => queueMicrotask(resolve));
  try {
    for (let cycle = 0; cycle < 3; cycle++) {
      button.focus();
      button.click();
      await flush();
      assert.equal(panel.classList.contains('collapsed'), true);
      assert.equal(button.parentElement, header);
      assert.equal(document.activeElement, button);
      button.click();
      await flush();
      assert.equal(panel.classList.contains('collapsed'), false);
      assert.equal(button.parentElement, panel.querySelector('.layer-search'));
      assert.equal(document.activeElement, button);
    }
    assert.equal(changes, 6, 'each activation invokes the existing owner once');
    document.documentElement.dataset.uiTheme = 'cyber';
    await flush();
    assert.equal(button.parentElement, header);
    assert.equal(document.activeElement, button);
    delete document.documentElement.dataset.uiTheme;
    await flush();
    assert.equal(button.parentElement, panel.querySelector('.layer-search'));
    assert.equal(document.activeElement, button);
  } finally {
    disclosure.destroy();
    view.dispose();
  }
});

test('category navigation keeps rows mounted while search, active and reveals expose every group', async (t) => {
  const { nextTick } = await import('vue');
  const ids = [
    'flights',
    'satellites',
    'wind',
    'cctv',
    'alpr-cameras',
    'earthquakes',
    'radio',
  ];
  const layers = ids.map((id) => ({
    id,
    name: id,
    enabled: true,
    showInTogglePanel: true,
    stats: {},
  }));
  fixture(t, {
    getLayers: () => layers,
    setEnabled() {
      throw new Error('Navigation must not toggle a layer');
    },
    setLayerParams() {
      throw new Error('Navigation must not change layer parameters');
    },
  });
  const row = (id) => container.querySelector(`[data-layer-id="${id}"]`);
  const shown = (node) =>
    ![node, ...ancestors(node)].some(
      (el) => el.style.display === 'none' || el.hidden,
    );
  function* ancestors(node) {
    for (let el = node.parentElement; el; el = el.parentElement) yield el;
  }
  const identities = new Map(ids.map((id) => [id, row(id)]));
  assert.equal(shown(row('flights')), true);
  assert.equal(shown(row('radio')), true);
  for (const id of ids.slice(1, -1)) assert.equal(shown(row(id)), false, id);
  const categories = [...container.querySelectorAll('.layer-category')];
  assert.equal(categories.length, 5);
  categories[0].click();
  await nextTick();
  assert.equal(shown(row('satellites')), true);
  assert.equal(categories[0].getAttribute('aria-expanded'), 'true');
  container.querySelector('.layer-category-back').click();
  await nextTick();
  assert.equal(shown(row('satellites')), false);
  assert.equal(document.activeElement, categories[0]);
  const input = container.querySelector('.layer-filter');
  for (const id of ids) {
    input.value = row(id).dataset.layerName;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    assert.equal(shown(row(id)), true, `search ${id}`);
  }
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  container.querySelectorAll('[role=tab]')[1].click();
  await nextTick();
  for (const id of ids) assert.equal(shown(row(id)), true, `active ${id}`);
  container.querySelectorAll('[role=tab]')[2].click();
  await nextTick();
  for (const id of ids) {
    container.dispatchEvent(
      new CustomEvent('gev:focus-layer-row', { detail: id }),
    );
    await nextTick();
    assert.equal(shown(row(id)), true, `reveal ${id}`);
    assert.equal(row(id), identities.get(id));
  }
});
