import { afterEach } from 'node:test';
import { container, mount } from './componentDom.mjs';
const { LocationControls } = await import('../ui/locationControls.js');
const { LocationField } = await import('../ui/locationField.js');
const { mountLocationViews } = await import('../ui/locationViews.js');
const owners = new Set();
afterEach(() => {
  for (const owner of owners) owner.destroy();
  owners.clear();
});

export function locationFixture({
  cities = {
    a: { name: 'City A', pois: [{ name: 'First' }, { name: 'Second' }] },
    b: { name: 'City B', pois: [{ name: 'Elsewhere' }] },
  },
  expandedCity = 'a',
} = {}) {
  container.innerHTML = `
    <template data-location-view="search"></template>
    <template data-location-view="results"></template>
    <template data-location-view="status"></template>
    <template data-location-view="pin"></template>
    <div id="location-pills"></div><div id="poi-row"></div>
    <div id="location-bar-divider"></div><button id="reset"></button>`;
  const views = mountLocationViews(mount);
  const element = (id) => document.getElementById(id);
  const elements = {
    pills: element('location-pills'),
    poiRow: element('poi-row'),
    divider: element('location-bar-divider'),
    search: element('location-search'),
    searchToggle: element('search-toggle'),
    resetButtons: [element('reset')],
    statusCity: element('location-mini-city'),
    statusPoi: element('location-mini-poi'),
  };
  const calls = [],
    frames = new Map(),
    cancelled = [];
  let next = 0;
  const field = new LocationField(elements.search);
  let searchState = { status: 'idle', query: '' };
  const controls = new LocationControls({
    elements,
    views,
    field,
    cities,
    getExpandedCity: () => expandedCity,
    getSearchState: () => searchState,
    onCity: (id) => calls.push(['city', id]),
    onPoi: (id, index) => calls.push(['poi', id, index]),
    onSearch: (query) => calls.push(['search', query]),
    onSearchOpen: () => {
      elements.search.dataset.openedByOwner = 'true';
    },
    onSearchEdit: () => {
      calls.push(['edit']);
      field.set({ error: '' });
    },
    onReset: () => calls.push(['reset']),
    requestFrame: (fn) => {
      const id = next++;
      frames.set(id, fn);
      return id;
    },
    cancelFrame: (id) => cancelled.push(id),
  });
  owners.add(controls);
  owners.add(field);
  return {
    elements,
    views,
    field,
    controls,
    calls,
    frames,
    cancelled,
    container,
    result(state) {
      searchState = state;
      views.results.update({ state });
    },
  };
}
export function enter(input, query) {
  input.value = query;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
export function key(node, value, options = {}) {
  node.dispatchEvent(
    new KeyboardEvent('keydown', { key: value, bubbles: true, ...options }),
  );
}
