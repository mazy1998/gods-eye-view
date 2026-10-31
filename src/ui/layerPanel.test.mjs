import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { mount } from '../testSupport/componentDom.mjs';
const { LayerPanel } = await import('./layerPanel.js');
const { default: LayerRow } = await import('./LayerRow.vue');

function renderToggle(layer) {
  const row = (value) => ({
    ...value,
    name: value.name,
    englishName: value.name,
    count: '',
    meta: '',
    toggle: LayerPanel.prototype._toggleState(value),
  });
  const view = mount(LayerRow, { props: { row: row(layer) } });
  return {
    button: view.element.querySelector('.data-toggle-btn'),
    update: (next = layer) => view.update({ row: row(next) }),
  };
}

test('panel presentation places Transit between Street Traffic and Bike Share in Transport', () => {
  const source = readFileSync(
    new URL('./layerPanel.js', import.meta.url),
    'utf8',
  );
  const declarations = source.slice(
    source.indexOf('const PANEL_GROUPS ='),
    source.indexOf('const PANEL_POSITIONS ='),
  );
  const order = JSON.parse(
    runInNewContext(
      `const msg = (text) => text;\n${declarations}\nJSON.stringify(PANEL_ORDER)`,
    ),
  );
  assert.deepEqual(
    order.filter(({ label }) => label === 'Transport').map(({ id }) => id),
    [
      'flights',
      'military',
      'local-adsb',
      'ais-live-vessels',
      'traffic',
      'transit',
      'bikeshare',
      'directions',
    ],
  );
  assert.equal(order.filter(({ id }) => id === 'transit').length, 1);
});

test('partial feed controls distinguish incomplete records from stale data and outages', async () => {
  const { LayerPanel, layerFeedState } = await import('./layerPanel.js');
  const layer = {
    id: 'ais-live-vessels',
    name: 'Live Vessels',
    source: 'AISStream',
    enabled: true,
    stats: {
      partial: true,
      stale: false,
      count: 2,
      acceptedRowCount: 2,
      rawRowCount: 3,
      lastUpdate: Date.now(),
    },
  };
  const panel = LayerPanel.prototype;
  const { button, update } = renderToggle(layer);
  assert.equal(button.textContent, 'PARTIAL');
  assert.equal(button.dataset.feedState, 'partial');
  assert.equal(button.classList.contains('feed-partial'), true);
  assert.equal(button.classList.contains('feed-stale'), false);
  assert.match(button.getAttribute('aria-label'), /PARTIAL/);
  assert.match(
    panel._buildMetaText(layer),
    /^PARTIAL · AISStream · 2 of 3 records accepted · /,
  );
  assert.match(
    panel._buildMetaText({
      ...layer,
      stats: { ...layer.stats, rawRowCount: 2 },
    }),
    /incomplete snapshot/,
  );
  assert.equal(layerFeedState({ ...layer.stats, stale: true }), 'stale');
  assert.equal(
    layerFeedState({ ...layer.stats, error: 'Connection lost' }),
    'degraded',
  );
  assert.equal(
    layerFeedState({ ...layer.stats, status: 'unavailable' }),
    'unavailable',
  );
  assert.equal(layerFeedState({ ...layer.stats, loading: true }), 'loading');
  layer.stats = { ...layer.stats, partial: false };
  update();
  assert.equal(button.textContent, 'ON');
  assert.equal(button.classList.contains('feed-partial'), false);
  layer.enabled = false;
  update();
  assert.equal(button.textContent, 'OFF');
});

test('a stale row dates cached data by its oldest tile, not the last load', async () => {
  const { LayerPanel } = await import('./layerPanel.js');
  const panel = LayerPanel.prototype;
  const layer = {
    id: 'traffic',
    name: 'Street Traffic',
    source: 'TomTom',
    enabled: true,
    stats: {
      mode: 'live',
      stale: true,
      count: 4,
      lastUpdate: Date.now(),
      oldestTileAt: Date.now() - 3 * 3600_000,
    },
  };
  assert.match(panel._buildMetaText(layer), /^STALE · TomTom · 3h ago$/);
  delete layer.stats.oldestTileAt;
  assert.match(panel._buildMetaText(layer), /^STALE · TomTom · just now$/);
});

test('an omitted source is visibly unavailable and cannot be toggled on', async () => {
  const { LayerPanel } = await import('./layerPanel.js');
  const layer = {
    id: 'flights',
    name: 'Flights',
    enabled: false,
    stats: {
      sourceUnavailable: true,
      status: 'unavailable',
      error: 'Data source not configured: flights',
    },
  };
  const { button, update } = renderToggle(layer);
  assert.equal(button.textContent, 'UNAVAILABLE');
  assert.equal(button.getAttribute('aria-disabled'), 'true');
  assert.match(button.title, /not configured/);
  update({ ...layer, enabled: true });
  assert.equal(
    button.getAttribute('aria-disabled'),
    'false',
    'an active layer can always be switched off',
  );
});

test('row text keeps a hyphenated code whole and never starts a line with the separator', async () => {
  const { setRowText } = await import('./layerPanel.js');
  const previousDocument = globalThis.document;
  const element = () => ({
    className: '',
    textContent: '',
    children: [],
    appendChild(child) {
      this.children.push(child);
      return child;
    },
  });
  globalThis.document = { createElement: element };
  try {
    const text = (node) =>
      node.children.length
        ? node.children.map((child) => child.textContent).join('')
        : node.textContent;
    const kept = (node) =>
      node.children
        .filter((child) => child.className === 'data-keep')
        .map((child) => child.textContent);

    const name = element();
    setRowText(name, 'Локальный ADS-B');
    assert.equal(text(name), 'Локальный ADS-B');
    assert.deepEqual(kept(name), ['ADS-B']);

    const meta = element();
    setRowText(meta, 'UNAVAILABLE · NASA FIRMS · LIVE · KEY REQUIRED');
    assert.equal(text(meta), 'UNAVAILABLE · NASA FIRMS · LIVE · KEY REQUIRED');
    assert.deepEqual(kept(meta), [' ·', ' ·', ' ·']);
    assert.ok(
      meta.children.every((child) => !child.textContent.startsWith('·')),
      'the space before each dot is held to the piece it closes',
    );

    const plain = element();
    setRowText(plain, 'Satellites');
    assert.equal(plain.textContent, 'Satellites');
    assert.equal(plain.children.length, 0);

    const compound = element();
    setRowText(compound, 'Kartierte ALPR-Kameras · ADS-B-Flüge');
    assert.equal(text(compound), 'Kartierte ALPR-Kameras · ADS-B-Flüge');
    assert.deepEqual(
      kept(compound),
      [' ·', 'ADS-B'],
      'a compound may break at its hyphen; the code inside it stays whole',
    );

    const long = element();
    setRowText(long, 'see https-proxy-endpoint-config-x');
    assert.deepEqual(kept(long), [], 'a long hyphenated run may still wrap');
  } finally {
    globalThis.document = previousDocument;
  }
});

test('the unavailable chip may abbreviate, but its accessible name keeps the full state', async () => {
  const { LayerPanel } = await import('./layerPanel.js');
  const { button } = renderToggle({
    id: 'local-firms',
    name: 'FIRMS Active Fires',
    enabled: false,
    stats: { sourceUnavailable: true, error: 'KEY REQUIRED' },
  });
  assert.equal(button.textContent, 'UNAVAILABLE');
  assert.equal(button.dataset.feedState, 'unavailable');
  assert.match(
    button.getAttribute('aria-label'),
    /^Active Fires: UNAVAILABLE\./,
  );
});

test('the Weather readout receives enabled air-quality alongside weather layers', async () => {
  const { LayerPanel } = await import('./layerPanel.js');
  const layers = ['wind', 'air-quality', 'other'].map((id) => ({
    id,
    icon: '*',
    enabled: true,
  }));
  layers.push({ id: 'weather-radar', icon: '*', enabled: false });
  const panel = new LayerPanel({
    getLayers: () => layers,
    getRowControls: (id) => ({ readout: true, summary: { label: id } }),
  });
  let entries = null;
  panel._weatherPanel = {
    update: (next) => {
      entries = next;
    },
  };
  panel._refreshWeatherPanel();
  assert.deepEqual(
    entries.map(({ id, summary }) => [id, summary.label]),
    [
      ['wind', 'wind'],
      ['air-quality', 'air-quality'],
    ],
  );
});

test('uncertain lifecycle state overrides ordinary feed status without disabling reconciliation', () => {
  const layer = {
    id: 'radio',
    name: 'Radio',
    source: 'Radio Browser',
    enabled: true,
    lifecycleState: 'enabled',
    lifecycleUncertain: true,
    stats: { count: 750, lastUpdate: Date.now() },
  };
  const { button } = renderToggle(layer);
  assert.equal(button.textContent, 'UNCERTAIN');
  assert.equal(button.dataset.feedState, 'uncertain');
  assert.equal(
    button.disabled,
    false,
    'the lifecycle toggle remains available to reconcile authority',
  );
  assert.equal(button.getAttribute('aria-label'), 'Radio: UNCERTAIN');
  assert.equal(button.classList.contains('lifecycle-uncertain'), true);
  assert.equal(button.classList.contains('feed-nominal'), false);
  assert.equal(
    LayerPanel.prototype._buildMetaText(layer),
    'UNCERTAIN · Radio Browser · lifecycle state requires reconciliation',
  );
});
