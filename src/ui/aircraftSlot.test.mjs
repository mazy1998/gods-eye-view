import test from 'node:test';
import assert from 'node:assert/strict';
import { connectAircraftSlot } from './aircraftSlot.js';
import { aircraftPresentation } from './aircraftPresentation.js';
import { setLocale, t as translate } from '../i18n/index.js';
import { formatQuantity } from './unitLabels.js';

function setup(t, { initialOrigin } = {}) {
  const events = new EventTarget();
  let tracked, item, release, trackedListener, feedListener, tick;
  let current = null;
  if (initialOrigin)
    tracked = {
      gevTrackedId: 'flights:abc',
      gevSelectionOrigin: initialOrigin,
    };
  let paints = 0,
    disposed = 0;
  const infos = {
    flights: { icao24: 'abc', callsign: 'FL1' },
    military: { icao24: 'def' },
    'local-adsb': { icao24: '123' },
  };
  const closed = [];
  const layers = Object.fromEntries(
    Object.keys(infos).map((id) => [
      id,
      {
        getTrackedInfo: () => infos[id],
        getSelectedAircraftInfo: () => infos[id],
        getStats: () => ({ source: 'receiver' }),
        stopTracking: () => closed.push(id),
        deselectAircraft: (icao) => closed.push(icao),
      },
    ]),
  );
  const slot = {
    current: () => current,
    show(next) {
      if (next.id === current) {
        item.title = next.title;
        return;
      }
      const old = item;
      release?.();
      release = null;
      item = next;
      current = next.id;
      release = next.mount?.({ body: {} });
      old?.replaced?.();
    },
    hide(id) {
      if (current === id) {
        release?.();
        release = null;
        current = null;
        item = null;
      }
    },
  };
  const viewer = {
    get trackedEntity() {
      return tracked;
    },
    trackedEntityChanged: {
      addEventListener(fn) {
        trackedListener = fn;
        return () => {
          trackedListener = null;
        };
      },
    },
  };
  const disconnect = connectAircraftSlot({
    slot,
    viewer,
    events,
    layers,
    readSelectedContext: () => null,
    subscribePresentation(fn) {
      feedListener = fn;
      return () => {
        feedListener = null;
      };
    },
    mount() {
      paints++;
      return {
        update() {
          paints++;
        },
        dispose() {
          disposed++;
        },
      };
    },
    schedule(fn) {
      tick = fn;
      return 1;
    },
    cancel() {
      tick = null;
    },
    now: () => 100_000,
  });
  t.after(disconnect);
  return {
    slot,
    infos,
    closed,
    get item() {
      return item;
    },
    get paints() {
      return paints;
    },
    get disposed() {
      return disposed;
    },
    get ticking() {
      return Boolean(tick);
    },
    track(layer = 'flights', id = 'abc', origin = 'user') {
      tracked = id
        ? { gevTrackedId: `${layer}:${id}`, gevSelectionOrigin: origin }
        : null;
      trackedListener?.();
    },
    event(type, detail) {
      events.dispatchEvent(new CustomEvent(type, { detail }));
    },
    refresh(id = 'flights:abc') {
      feedListener?.({ gevTrackedId: id });
    },
    disconnect,
  };
}

test('presentation keeps unknowns, zero measurements, units, route and honest receive age', () => {
  const model = aircraftPresentation(
    {
      icao24: 'abc',
      altitudeM: 0,
      velocityMps: 0,
      track: 0,
      verticalRateMps: null,
      lastContactAtMs: 90_000,
      source: 'adsb.lol',
      origin: 'LHR',
      destination: 'JFK',
      squawk: '0070',
    },
    100_000,
  );
  assert.equal(model.title, 'abc');
  assert.deepEqual(
    model.telemetry.map((row) => row.value),
    ['0\u00a0ft', '0\u00a0kt', '0°', '—', '0070', '—'],
  );
  assert.equal(model.received, 'Received 10 s ago');
  assert.equal(model.route[0].value, 'LHR');
  const unknown = aircraftPresentation({});
  assert.equal(unknown.received, 'Receive time unavailable');
  assert.equal(unknown.telemetry[0].value, '—');
  assert.equal(
    aircraftPresentation({ onGround: true }).telemetry[0].value,
    'On ground',
  );
});

test('selection claims once, feed updates dedupe and another aircraft replaces the title', (t) => {
  const state = setup(t);
  state.track();
  assert.equal(state.slot.current(), 'aircraft');
  const paints = state.paints;
  state.refresh();
  assert.equal(state.paints, paints);
  state.infos.flights.callsign = 'FL2';
  state.refresh();
  assert.equal(state.item.title, 'FL2');
  assert.equal(state.disposed, 0);
  state.track('military', 'def');
  assert.equal(state.item.title, 'def');
  state.item.close();
  assert.deepEqual(state.closed, ['military']);
  assert.equal(state.slot.current(), null);
  assert.equal(state.ticking, false);
});

test('camera replacement survives stale refreshes and clears; fresh selection can reclaim', (t) => {
  const state = setup(t);
  state.track();
  state.slot.show({ id: 'cctv' });
  state.refresh();
  state.event('gev:entity-selection-cleared', { layerId: 'flights' });
  assert.equal(state.slot.current(), 'cctv');
  assert.equal(state.ticking, false);
  state.track();
  assert.equal(state.slot.current(), 'aircraft');
  state.disconnect();
  state.refresh();
  assert.equal(state.slot.current(), null);
});

test('Local ADS-B selection is independent of an older followed flight', (t) => {
  const state = setup(t);
  state.track();
  state.event('gev:entity-selected', {
    layerId: 'local-adsb',
    entity: { gevTrackedId: 'local-adsb:123' },
  });
  assert.equal(state.item.title, '123');
  state.refresh();
  assert.equal(state.item.title, '123');
  state.track('flights', null);
  assert.equal(state.item.title, '123');
  state.item.close();
  assert.deepEqual(state.closed, ['123']);
});

test('queued awareness selection cannot reclaim after a newer context selection or destruction', async (t) => {
  const state = setup(t);
  state.event('gev:awareness-subject-selected', {
    layerId: 'flights',
    id: 'abc',
  });
  state.event('gev:entity-selected', { layerId: 'vessels' });
  await Promise.resolve();
  assert.equal(state.slot.current(), null);
  state.event('gev:awareness-subject-selected', {
    layerId: 'flights',
    id: 'abc',
  });
  state.disconnect();
  await Promise.resolve();
  assert.equal(state.slot.current(), null);
});

test('a stale close never stops the newer target of the same owner', (t) => {
  const state = setup(t);
  state.track();
  state.infos.flights.icao24 = 'new';
  state.item.close();
  assert.deepEqual(state.closed, []);
  assert.equal(state.slot.current(), null);
});

test('aircraft speed labels and quantities follow every locale without changing wind labels', () => {
  const locales = [
    'en',
    'de',
    'es',
    'fr',
    'it',
    'ja',
    'pt',
    'ru',
    'uk',
    'zh-CN',
    'zh-Hant',
  ];
  try {
    for (const locale of locales) {
      setLocale(locale);
      const model = aircraftPresentation({
        altitudeM: 3048,
        velocityMps: 230,
        verticalRateMps: 1,
      });
      assert.equal(model.telemetry[1].label, translate('Ground speed'), locale);
      for (const [index, value, unit] of [
        [0, 10000, 'ft'],
        [1, 230 * 1.9438444924406, 'kt'],
        [3, 60 / 0.3048, 'ft/min'],
      ]) {
        assert.equal(
          model.telemetry[index].value,
          formatQuantity(value, unit, {
            useGrouping: true,
            maximumFractionDigits: 0,
          }),
          `${locale}: ${unit}`,
        );
      }
      if (['ja', 'zh-CN', 'zh-Hant'].includes(locale)) {
        assert.notEqual(model.telemetry[1].label, translate('Speed'), locale);
        assert.equal(translate('Speed'), locale === 'zh-CN' ? '风速' : '風速');
      }
      if (locale === 'ru') {
        assert.match(model.telemetry[0].value, /\u00a0фт$/);
        assert.match(model.telemetry[1].value, /\u00a0уз$/);
        assert.match(model.telemetry[3].value, /\u00a0фт\/мин$/);
      }
      if (locale === 'ja')
        assert.match(model.telemetry[3].value, /\u00a0ft\/分$/);
    }
  } finally {
    setLocale('en');
  }
});

test('automatic tracking never opens the slot or replaces a camera on either selection path', async (t) => {
  const state = setup(t);
  state.track('flights', 'abc', 'programmatic');
  state.event('gev:awareness-subject-selected', {
    layerId: 'flights',
    id: 'abc',
    origin: 'programmatic',
  });
  await Promise.resolve();
  assert.equal(state.slot.current(), null);
  state.slot.show({ id: 'cctv' });
  state.track('military', 'def', 'programmatic');
  state.event('gev:awareness-subject-selected', {
    layerId: 'military',
    id: 'def',
    origin: 'programmatic',
  });
  state.refresh('military:def');
  await Promise.resolve();
  assert.equal(state.slot.current(), 'cctv');
  assert.equal(state.paints, 0);
});

test('click, Find, voice, tools and share or reload restores can claim the slot on both paths', async (t) => {
  const state = setup(t);
  for (const origin of [
    'user',
    'voice',
    'tool',
    'share-restore',
    'local-restore',
  ]) {
    state.slot.show({ id: 'cctv' });
    state.track('flights', 'abc', origin);
    assert.equal(state.slot.current(), 'aircraft', `tracked: ${origin}`);
    state.slot.show({ id: 'cctv' });
    state.event('gev:awareness-subject-selected', {
      layerId: 'flights',
      id: 'abc',
      origin,
    });
    await Promise.resolve();
    assert.equal(state.slot.current(), 'aircraft', `awareness: ${origin}`);
  }
});

test('initial selection observes the same automatic versus reload origin policy', (t) => {
  assert.equal(
    setup(t, { initialOrigin: 'programmatic' }).slot.current(),
    null,
  );
  for (const initialOrigin of ['user', 'share-restore', 'local-restore'])
    assert.equal(setup(t, { initialOrigin }).slot.current(), 'aircraft');
});

test('automatic handoff withdraws an obsolete aircraft without claiming its replacement', (t) => {
  const state = setup(t);
  state.track();
  state.track('military', 'def', 'programmatic');
  assert.equal(state.slot.current(), null);
  assert.deepEqual(state.closed, []);
});

test('a later automatic intent cancels a queued explicit selection on either path', async (t) => {
  const state = setup(t);
  state.slot.show({ id: 'cctv' });
  const explicit = () =>
    state.event('gev:awareness-subject-selected', {
      layerId: 'flights',
      id: 'abc',
      origin: 'user',
    });
  explicit();
  state.event('gev:awareness-subject-selected', {
    layerId: 'military',
    id: 'def',
    origin: 'programmatic',
  });
  await Promise.resolve();
  assert.equal(state.slot.current(), 'cctv');
  explicit();
  state.track('military', 'def', 'programmatic');
  await Promise.resolve();
  assert.equal(state.slot.current(), 'cctv');
});
