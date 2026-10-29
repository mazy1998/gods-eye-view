import test from 'node:test';
import assert from 'node:assert/strict';
import '../testSupport/componentDom.mjs';

const { createStateChannel } = await import('../app/stateChannel.js');
const { createShellChrome } = await import('./shellChrome.js');
const { mountView } = await import('./mountView.js');
const { default: SearchField } =
  await import('./locationViews/SearchField.vue');
const { default: SearchResults } =
  await import('./locationViews/SearchResults.vue');
const { locationFixture } = await import('../testSupport/locationFixture.mjs');
const { StyleManager } = await import('./applicationShell.js');
const { LocationNavigation } = await import('./locationNavigation.js');
const { NavigationController } = await import('./navigationController.js');

/** The real search views in the location tray, placed in the header. */
function setup() {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div id="command-dock"><div id="location-bar"><div id="seat"></div></div></div>
     <header id="gev-header"><div id="gev-header-search"></div></header>`,
  );
  let active = false;
  const channel = createStateChannel(() => ({ active }));
  const seat = document.getElementById('seat');
  const search = mountView(SearchField, {
    parent: seat.parentNode,
    before: seat,
  });
  const results = mountView(SearchResults, {
    parent: seat.parentNode,
    before: seat,
  });
  seat.remove();
  const slot = () => document.getElementById('gev-header-search');
  const chrome = createShellChrome({
    channel,
    placements: [
      [() => search.element, slot],
      [() => results.element, slot],
    ],
  });
  active = true;
  channel.publish({ type: 'active-changed' });
  return {
    search,
    results,
    chrome,
    cleanup() {
      chrome.destroy();
      channel.destroy();
      search.dispose();
      results.dispose();
      document.getElementById('command-dock')?.remove();
      document.getElementById('gev-header')?.remove();
    },
  };
}

test('disposing the views before the chrome leaves them out of the document', (t) => {
  const { search, results, chrome, cleanup } = setup();
  t.after(cleanup);
  const input = document.getElementById('location-search');
  const resultsRoot = results.element;
  assert.ok(input.closest('#gev-header-search'));
  // The application disposes its views first, then the chrome.
  search.dispose();
  results.dispose();
  assert.equal(input.isConnected, false);
  chrome.destroy();
  assert.equal(input.isConnected, false, 'not returned to the dock');
  assert.equal(resultsRoot.isConnected, false);
});

// What shell.css hides under the header's search.
const HIDDEN_RESULTS =
  '#gev-header-search > .gev-location-results:not(:has(.gev-location-result, .location-search-error:not(:empty)))';
const FOUND = {
  status: 'found',
  query: 'Paris',
  destination: { label: 'Paris' },
  searching: false,
};

/** The location views under their real controls, placed in the header. */
function headerFixture() {
  const fixture = locationFixture({
    // As the shell answers: the field is always shown in the header.
    isSearchAlwaysShown: () => !!fixture.elements.search.closest('#gev-header'),
  });
  document.body.insertAdjacentHTML(
    'beforeend',
    '<header id="gev-header"><div id="gev-header-search"></div></header>',
  );
  const slot = document.getElementById('gev-header-search');
  const results = fixture.views.results.element;
  slot.append(fixture.views.search.element, results);
  const shell = {
    _navigation: { locationField: fixture.field },
    _locationViews: fixture.views,
    _panelChrome: { setPanelCollapsed() {} },
  };
  const navigation = {
    _disposed: false,
    views: fixture.views,
    navigation: { locationField: fixture.field },
    _setLocationSearchError:
      LocationNavigation.prototype._setLocationSearchError,
  };
  return {
    fixture,
    shell,
    input: fixture.elements.search,
    results,
    card: () => results.querySelector('.gev-location-result'),
    hidden: () => results.matches(HIDDEN_RESULTS),
    startSearch: () =>
      LocationNavigation.prototype._handleLocationSearchState.call(
        navigation,
        { status: 'searching', query: 'Paris', searching: true },
        { type: 'started', generation: 2 },
      ),
    cleanup: () => document.getElementById('gev-header')?.remove(),
  };
}

test('a found result in the header stays after its search and Escape puts it away until the next search', (t) => {
  const header = headerFixture();
  t.after(header.cleanup);
  header.fixture.result(FOUND);
  assert.ok(header.card());
  // A search that arrived clears and closes the field; its result stays to
  // fly to again.
  NavigationController.prototype._settleLocationSearchUi.call(
    {
      _activeLocationSearchGeneration: 1,
      searchInput: header.input,
      locationField: header.fixture.field,
    },
    1,
  );
  assert.equal(header.input.value, '');
  assert.ok(header.card());
  assert.equal(header.hidden(), false);
  StyleManager.prototype._escapeHeaderSearch.call(
    header.shell,
    new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }),
  );
  assert.equal(header.card(), null);
  assert.equal(header.hidden(), true, 'Escape puts the found result away');
  header.startSearch();
  header.fixture.result(FOUND);
  assert.ok(header.card(), 'the next search shows its result');
  assert.equal(header.hidden(), false);
});

test('a click or focus outside the header search puts a found result away; inside keeps it', (t) => {
  const header = headerFixture();
  t.after(header.cleanup);
  header.fixture.result(FOUND);
  const dismiss = (target) =>
    StyleManager.prototype._dismissHeaderSearchResult.call(header.shell, {
      target,
    });
  dismiss(header.results.querySelector('.gev-location-fly'));
  dismiss(header.input);
  assert.ok(header.card());
  dismiss(document.body);
  assert.equal(header.card(), null);
  assert.equal(header.hidden(), true);
});

test('outside the header the found result keeps its tray behaviour', () => {
  const fixture = locationFixture();
  fixture.result(FOUND);
  StyleManager.prototype._dismissHeaderSearchResult.call(
    {
      _navigation: { locationField: fixture.field },
      _locationViews: fixture.views,
    },
    { target: document.body },
  );
  assert.ok(
    fixture.views.results.element.querySelector('.gev-location-result'),
  );
  assert.equal(fixture.field.getState().resultDismissed, false);
});

test('the header search button focuses the field on every press', (t) => {
  const header = headerFixture();
  t.after(header.cleanup);
  const button = document.getElementById('search-toggle');
  button.click();
  assert.equal(document.activeElement, header.input);
  header.input.blur(); // a click on the globe
  button.click();
  assert.equal(document.activeElement, header.input, 'the second press too');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
});

test('in the tray the search button still opens and closes the field', () => {
  const fixture = locationFixture({ isSearchAlwaysShown: () => false });
  const button = document.getElementById('search-toggle');
  button.click();
  assert.equal(fixture.field.getState().expanded, true);
  assert.equal(document.activeElement, fixture.elements.search);
  button.click();
  assert.equal(fixture.field.getState().expanded, false);
});
