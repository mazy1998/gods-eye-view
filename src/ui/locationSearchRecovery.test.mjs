import assert from 'node:assert/strict';
import test from 'node:test';
import { NavigationController } from './navigationController.js';
import { locationFixture } from '../testSupport/locationFixture.mjs';
const { LocationNavigation } = await import('./locationNavigation.js');

function settle(fixture, options) {
  const owner = {
    _activeLocationSearchGeneration: 4,
    searchInput: fixture.elements.search,
    locationField: fixture.field,
  };
  NavigationController.prototype._settleLocationSearchUi.call(owner, 4, options);
  return owner;
}

test('a search that found nothing keeps its query, the open field and focus', () => {
  const fixture = locationFixture();
  fixture.field.set({ query: 'Pariss', expanded: true, busy: true });
  const field = fixture.elements.search;
  const owner = settle(fixture, { keepQuery: true });
  assert.equal(owner._activeLocationSearchGeneration, null);
  assert.equal(field.value, 'Pariss');
  assert.equal(field.classList.contains('expanded'), true);
  assert.equal(field.classList.contains('searching'), false);
  assert.equal(document.activeElement, field);
  assert.equal(field.selectionStart, 0);
  assert.equal(field.selectionEnd, field.value.length);
});

test('a search that arrived still clears and closes the field', () => {
  const fixture = locationFixture();
  fixture.field.set({ query: 'Pariss', expanded: true, busy: true });
  const field = fixture.elements.search;
  field.focus();
  settle(fixture);
  assert.equal(field.value, '');
  assert.equal(field.classList.contains('expanded'), false);
  assert.notEqual(document.activeElement, field);
});

function navigation() {
  const fixture = locationFixture();
  const field = fixture.elements.search;
  const error = document.getElementById('location-search-error');
  const settled = [];
  const toasts = [];
  const owner = {
    _disposed: false,
    navigation: { locationField: fixture.field },
    _locationSearch: field,
    _locationSearchError: error,
    _activeLocationSearchGeneration: null,
    _settleLocationSearchUi: (generation, options) =>
      settled.push([generation, options]),
    _showToast: (message) => toasts.push(message),
    _setLocationSearchError:
      LocationNavigation.prototype._setLocationSearchError,
  };
  const handle = (status, type) =>
    LocationNavigation.prototype._handleLocationSearchState.call(
      owner,
      { status, query: field.value },
      { type, generation: 7 },
    );
  return { owner, field, error, settled, toasts, handle };
}

for (const [status, text] of [
  ['missing', 'Location not found'],
  ['failed', 'Search failed'],
]) {
  test(`a ${status} search announces a lasting error on the field instead of a toast`, () => {
    const n = navigation();
    n.handle('searching', 'started');
    n.handle(status, status);
    n.handle(status, 'settled');
    assert.match(n.error.textContent, new RegExp(`^${text}\\. `));
    assert.equal(n.field.getAttribute('aria-invalid'), 'true');
    assert.equal(
      n.field.getAttribute('aria-describedby'),
      'location-search-error',
    );
    assert.deepEqual(n.settled, [[7, { keepQuery: true }]]);
    assert.deepEqual(n.toasts, []);
    n.handle('searching', 'started');
    assert.equal(n.error.textContent, '');
    assert.equal(n.field.getAttribute('aria-invalid'), null);
    assert.equal(n.field.getAttribute('aria-describedby'), null);
  });
}
