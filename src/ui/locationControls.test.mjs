import assert from 'node:assert/strict';
import test from 'node:test';
import {
  locationFixture as fixture,
  enter,
  key,
} from '../testSupport/locationFixture.mjs';
const { DisplayBindings } = await import('./displayBindings.js');

test('global Escape outside search closes the owner and one click reopens an empty field', () => {
  const f = fixture();
  const bindings = new DisplayBindings({
    viewer: {},
    services: { isScopeMaskEnabled: () => false },
    elements: { _locationSearch: f.elements.search },
    operations: { closeLocationSearch: () => f.field.close() },
    readState: () => ({}),
  });
  bindings._initUI();
  try {
    f.elements.searchToggle.click();
    enter(f.elements.search, 'Paris');
    f.elements.resetButtons[0].focus();
    key(document.activeElement, 'Escape');
    assert.equal(f.field.getState().query, '');
    assert.equal(f.field.getState().expanded, false);
    assert.equal(f.elements.search.value, '');
    assert.equal(f.elements.search.classList.contains('expanded'), false);
    f.elements.searchToggle.click();
    assert.equal(f.field.getState().expanded, true);
    assert.equal(f.elements.search.classList.contains('expanded'), true);
    assert.equal(f.elements.search.value, '');
    assert.equal(document.activeElement, f.elements.search);
  } finally {
    bindings.destroy();
  }
});

test('hiding a POI row cancels frame zero and rejects an already queued expansion', () => {
  const f = fixture();
  f.controls.showPois('a');
  const callback = f.frames.get(0);
  f.controls.hidePois();
  callback();
  assert.deepEqual(f.cancelled, [0]);
  assert.equal(f.elements.poiRow.classList.contains('expanded'), false);
  assert.equal(f.elements.divider.classList.contains('visible'), false);
});
test('replacing POIs revokes old click actions and presents the final row', () => {
  const f = fixture();
  f.controls.showPois('a');
  const old = f.elements.poiRow.children[0];
  f.controls.showPois('b');
  old.click();
  assert.deepEqual(f.calls, []);
  f.elements.poiRow.children[0].click();
  assert.deepEqual(f.calls, [['poi', 'b', 0]]);
  f.frames.get(0)();
  assert.equal(f.elements.poiRow.classList.contains('expanded'), false);
  f.frames.get(1)();
  assert.equal(f.elements.poiRow.classList.contains('expanded'), true);
});
test('destruction revokes document, search, reset, city and POI actions and removes orbit UI', () => {
  const f = fixture();
  f.controls.showPois('a');
  f.controls.createOrbitIndicator();
  assert.ok(document.getElementById('orbit-indicator'));
  const city = f.elements.pills.children[0];
  const poi = f.elements.poiRow.children[0];
  f.controls.destroy();
  f.controls.destroy();
  city.click();
  poi.click();
  enter(f.elements.search, 'Place');
  key(f.elements.search, 'Enter');
  key(document, 'Q');
  f.elements.resetButtons[0].click();
  f.frames.get(0)();
  assert.deepEqual(f.calls, []);
  assert.equal(document.getElementById('orbit-indicator'), null);
});
test('location and POI keys route once while form controls retain typing', () => {
  const f = fixture();
  key(document.body, 'W');
  key(f.elements.search, 'Q');
  f.elements.resetButtons[0].click();
  assert.deepEqual(f.calls, [['poi', 'a', 1], ['reset']]);
});
test('typing clears an error; blurring a kept query preserves it', () => {
  const f = fixture();
  enter(f.elements.search, 'Pariss');
  f.field.set({ error: 'Try again' });
  f.calls.length = 0;
  f.elements.search.dispatchEvent(new FocusEvent('blur'));
  assert.deepEqual(f.calls, []);
  assert.equal(
    document.getElementById('location-search-error').textContent,
    'Try again',
  );
  enter(f.elements.search, 'Paris');
  assert.equal(
    document.getElementById('location-search-error').textContent,
    '',
  );
  assert.equal(f.elements.search.getAttribute('aria-invalid'), null);
  enter(f.elements.search, '');
  f.calls.length = 0;
  f.elements.search.dispatchEvent(new FocusEvent('blur'));
  assert.deepEqual(f.calls, [['edit']]);
});
test('submit commits the native value to its owner; composition and edits do not submit', () => {
  const f = fixture();
  assert.equal(
    f.elements.search.getAttribute('aria-label'),
    'Search location by name or coordinates',
  );
  assert.equal(f.elements.search.placeholder, 'Search places or coordinates');
  assert.equal(document.querySelectorAll('#location-search').length, 1);
  enter(f.elements.search, 'geo:39.7,-104.9');
  f.elements.search.value = 'uncommitted DOM';
  key(f.elements.search, 'Enter', { isComposing: true });
  assert.deepEqual(f.calls, [['edit']]);
  key(f.elements.search, 'Enter');
  assert.deepEqual(f.calls.at(-1), ['search', 'uncommitted DOM']);
  assert.equal(f.field.getState().query, 'uncommitted DOM');
  f.elements.searchToggle.click();
  assert.equal(f.elements.search.dataset.openedByOwner, 'true');
  assert.equal(document.activeElement, f.elements.search);
  assert.equal(f.elements.searchToggle.getAttribute('aria-expanded'), 'true');
});
test('provider labels and errors remain text, and fly-to reuses the lookup owner', () => {
  const f = fixture();
  const label = '<b>Provider label</b>';
  f.result({
    status: 'found',
    query: 'Original query',
    destination: { label },
  });
  f.field.set({ error: '<em>Try again</em>' });
  assert.equal(
    f.container.querySelector('.gev-location-result-label').textContent,
    label,
  );
  assert.equal(
    document.getElementById('location-search-error').textContent,
    '<em>Try again</em>',
  );
  assert.equal(f.container.querySelector('b, em'), null);
  const fly = f.container.querySelector('.gev-location-fly');
  assert.equal(fly.getAttribute('aria-label'), `Fly to ${label}`);
  fly.click();
  assert.deepEqual(f.calls, [['search', 'Original query']]);
  f.controls.destroy();
  fly.click();
  assert.equal(f.calls.length, 1);
});
test('owner highlighting and mini-status are painted synchronously', () => {
  const f = fixture();
  f.controls.showPois('a');
  f.controls.highlightCity('a');
  f.controls.highlightPoi(1);
  assert.equal(
    f.elements.pills.querySelector('.active').dataset.locationId,
    'a',
  );
  assert.equal(
    f.elements.poiRow.querySelector('.active').dataset.poiIndex,
    '1',
  );
  f.controls.renderStatus({ searchedLabel: '<b>Result</b>, City' });
  assert.equal(f.elements.statusCity.querySelector('b'), null);
  assert.match(
    f.elements.statusPoi.textContent + f.elements.statusCity.textContent,
    /<b>Result<\/b>/,
  );
});
