// What the Cockpit shows is held by its owners, not read back from the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { CockpitViewController } from './cockpitController.js';
import { emptyContextReadout, updateContext } from './cockpitContext.js';
import {
  emptyBriefView,
  renderRegionalBrief,
  renderRegionalBriefStatus,
  setBriefView,
} from './cockpitBriefing.js';
import { setCockpitRollingValue } from './cockpitPresentation.js';

function withGlobals(globals, run) {
  const prior = Object.fromEntries(
    Object.keys(globals).map((key) => [key, globalThis[key]]),
  );
  Object.assign(globalThis, globals);
  try {
    return run();
  } finally {
    Object.assign(globalThis, prior);
  }
}

test('a weather click asks for the opposite of the state the effects reported', () => {
  const document = Object.assign(new EventTarget(), {
    getElementById: () => null,
    querySelectorAll: () => [],
    body: { classList: { remove() {} } },
  });
  const window = Object.assign(new EventTarget(), { clearTimeout, setTimeout });
  const event = { addEventListener: () => () => {} };
  withGlobals({ document, window, CustomEvent }, () => {
    const owner = new CockpitViewController(
      {
        scene: { preUpdate: event, screenSpaceCameraController: {} },
        trackedEntityChanged: event,
        entities: { contains: () => false },
      },
      { services: {} },
    );
    const requested = [];
    window.addEventListener('gev:cockpit-weather-toggle', (e) =>
      requested.push(e.detail.enabled),
    );
    window.dispatchEvent(
      new CustomEvent('gev:cockpit-weather-state', {
        detail: { enabled: true },
      }),
    );
    assert.equal(owner.getContactView().weatherEnabled, true);
    owner.toggleWeather();
    assert.deepEqual(requested, [false]);
    assert.equal(owner.getContactView().weatherEnabled, false);
    owner.dispose();
  });
});

test('rolling readouts keep their history with the owner', () => {
  const { window } = new JSDOM('<span id="speed"></span>');
  withGlobals({ document: window.document }, () => {
    const element = window.document.getElementById('speed');
    const history = {};
    setCockpitRollingValue(element, '120', 120, history);
    assert.equal(history.text, '120');
    assert.equal(history.value, 120);
    assert.equal(element.getAttribute('aria-label'), '120');
    assert.equal(element.textContent, '120');
    assert.deepEqual({ ...element.dataset }, {});
    // A second value within 220 ms waits for the next roll.
    setCockpitRollingValue(element, '125', 125, history);
    assert.equal(history.text, '120');
    setCockpitRollingValue(element, '130', 130, history, { immediate: true });
    assert.equal(history.text, '130');
    assert.equal(element.textContent, '130');
  });
});

function contextOwner(snapshot) {
  let layouts = 0;
  const owner = {
    context: { hidden: false, dataset: {} },
    contextCohorts: new Map(),
    contextReadout: emptyContextReadout(),
    contextLayoutStamp: null,
    services: {
      militaryAwarenessLayer: { getContextSnapshot: () => snapshot.current },
      formatAwarenessLabel: (item) => item?.label ?? '—',
    },
    scheduleContextLayout: () => (layouts += 1),
    publishContactView() {},
    pushCockpitSignal() {},
    updateCockpitSignals() {},
  };
  return { owner, layouts: () => layouts };
}

test('a lost contact holds the readout derived while it was live', () => {
  const live = {
    subject: { id: 'a1', layerId: 'flights', label: 'EJA353' },
    radiusM: 250000,
    evaluatedAt: Date.UTC(2026, 9, 30, 12, 0, 0),
    navigation: { canPrevious: false, canNext: true },
    cohorts: [
      {
        id: 'flights',
        label: 'Flights',
        count: 3,
        relationship: 'OBSERVED',
        nearest: [{ label: 'N1', distanceM: 14000 }],
      },
    ],
  };
  const snapshot = { current: live };
  const { owner, layouts } = contextOwner(snapshot);
  const info = { icao24: 'a1', layerId: 'flights' };
  updateContext.call(owner, info, 0);
  const held = owner.contextReadout;
  assert.equal(held.state, 'current');
  assert.deepEqual(held.cohorts, [
    { id: 'flights', count: '3', unknown: false },
  ]);
  assert.equal(layouts(), 1);
  snapshot.current = {
    ...live,
    subjectPresent: false,
    navigation: { canPrevious: true, canNext: true },
    cohorts: [{ ...live.cohorts[0], count: 9, nearest: [] }],
  };
  updateContext.call(owner, info, 0);
  updateContext.call(owner, info, 0);
  const lost = owner.contextReadout;
  assert.equal(lost.state, 'lost');
  assert.equal(owner.context.dataset.state, 'lost');
  assert.deepEqual(lost.cohorts, held.cohorts);
  assert.equal(lost.distance, held.distance);
  assert.equal(lost.nearest, held.nearest);
  assert.equal(lost.canPrevious, true, 'navigation stays live');
  assert.match(lost.uncertainty, /CONTACT LOST/);
  assert.equal(layouts(), 2, 'one layout on the way into LOST');
  snapshot.current = null;
  updateContext.call(owner, info, 0);
  assert.equal(owner.contextReadout.visible, false);
  assert.equal(owner.contextReadout.state, 'lost');
});

test('the regional brief status is held with its payload', () => {
  const owner = {
    updateLocalPosition() {},
    scheduleContextLayout() {},
    services: { weatherCodeLabel: () => '' },
    briefPageIndex: 0,
    briefView: emptyBriefView(),
    briefChannel: { publish() {} },
    setBriefView(view) {
      return setBriefView.call(this, view);
    },
  };
  renderRegionalBriefStatus.call(owner, 'loading', {});
  assert.equal(owner.regionalBriefStatus, 'loading');
  renderRegionalBriefStatus.call(owner, 'unavailable', {});
  assert.equal(owner.regionalBriefStatus, 'unavailable');
  renderRegionalBrief.call(owner, { articles: [] }, {});
  assert.equal(owner.regionalBriefStatus, 'loaded');
});

test('the News and Local pages follow the regional brief', () => {
  const published = [];
  const owner = {
    scheduleContextLayout() {},
    services: { weatherCodeLabel: () => 'Overcast' },
    briefPageIndex: 0,
    briefView: emptyBriefView(),
    briefChannel: { publish: () => published.push(owner.briefView) },
    setBriefView(view) {
      return setBriefView.call(this, view);
    },
    updateLocalPosition(info) {
      this.setBriefView({ local: { coordinates: `${info.latitude}` } });
    },
  };
  renderRegionalBriefStatus.call(owner, 'loading', { latitude: 1 });
  assert.equal(owner.briefView.news.statusText, 'ACQUIRING REGIONAL NEWS');
  assert.equal(owner.briefView.local.place, 'RESOLVING REGION');
  renderRegionalBrief.call(
    owner,
    {
      newsStatus: 'ok',
      articles: Array.from({ length: 6 }, (_, i) => ({
        url: `https://news.example/${i}`,
        title: `<b>Story ${i}</b>`,
        domain: 'news.example',
      })),
      place: { label: 'Austin' },
      weather: { temperatureC: 21.6, windKph: 12.2, cloudCoverPct: 40 },
    },
    { latitude: 2 },
  );
  const { news, local } = owner.briefView;
  assert.equal(news.statusHidden, true);
  assert.equal(news.articles.length, 4, 'at most four articles');
  assert.equal(news.articles[0].title, '<b>Story 0</b>');
  assert.equal(local.place, 'AUSTIN');
  assert.equal(local.temperature, '22°C');
  assert.equal(local.coordinates, '2');
  const count = published.length;
  owner.updateLocalPosition({ latitude: 2 });
  assert.equal(published.length, count, 'an unchanged view is not published');
});
