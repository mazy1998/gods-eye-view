import test from 'node:test';
import assert from 'node:assert/strict';
import { container } from '../testSupport/componentDom.mjs';
const { LocationControls } = await import('gods-eye-view/ui/location');

test('published LocationControls accepts native base-shaped elements without field or views', () => {
  container.innerHTML =
    '<div id="pills"></div><div id="pois"></div><hr><button id="search"></button><input><button id="reset"></button><span id="city"></span><span id="poi"></span>';
  const by = (s) => container.querySelector(s);
  const calls = [];
  const frames = [];
  const elements = {
    pills: by('#pills'),
    poiRow: by('#pois'),
    divider: by('hr'),
    searchToggle: by('#search'),
    search: by('input'),
    resetButtons: [by('#reset')],
    statusCity: by('#city'),
    statusPoi: by('#poi'),
  };
  const control = new LocationControls({
    elements,
    cities: { a: { name: '<City>', pois: [{ name: '<Site>' }] } },
    getExpandedCity: () => 'a',
    onCity: (id) => calls.push(['city', id]),
    onPoi: (id, index) => calls.push(['poi', id, index]),
    onSearch: (query) => calls.push(['search', query]),
    onReset: () => calls.push(['reset']),
    requestFrame: (fn) => {
      frames.push(fn);
      return frames.length;
    },
    cancelFrame() {},
  });
  assert.ok(control instanceof LocationControls);
  const city = elements.pills.querySelector('button');
  city.click();
  assert.deepEqual(calls.shift(), ['city', 'a']);
  assert.equal(city.textContent, '<City>');
  control.showPois('a');
  frames.shift()();
  const poi = elements.poiRow.querySelector('button');
  poi.click();
  assert.deepEqual(calls.shift(), ['poi', 'a', 0]);
  control.highlightCity('a');
  control.highlightPoi(0);
  elements.searchToggle.click();
  assert.equal(elements.search.classList.contains('expanded'), true);
  elements.search.value = 'A native query';
  elements.search.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
  );
  assert.deepEqual(calls.shift(), ['search', 'A native query']);
  control.renderStatus({ city: { name: 'Austin' }, poi: { name: 'Capitol' } });
  assert.match(elements.statusCity.textContent, /Austin/);
  control.destroy();
  control.destroy();
  city.click();
  poi.click();
  elements.searchToggle.click();
  assert.deepEqual(calls, []);
  assert.equal(control.destroyed, true);
});
