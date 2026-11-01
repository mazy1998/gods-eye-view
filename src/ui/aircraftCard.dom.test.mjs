import test from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '../testSupport/componentDom.mjs';
const { default: AircraftCard } = await import('./AircraftCard.vue');
const { aircraftPresentation } = await import('./aircraftPresentation.js');
const { createSelectionSlot } = await import('./selectionSlot.js');
const { connectAircraftSlot } = await import('./aircraftSlot.js');
const { mountView } = await import('./mountView.js');

test('aircraft values are literal text, grouped and updated without new actions', (t) => {
  const view = mount(AircraftCard, {
    props: {
      presentation: aircraftPresentation({
        icao24: 'abc',
        typeName: '<img src=x onerror=alert(1)>',
        origin: 'LHR',
        destination: 'JFK',
      }),
    },
  });
  t.after(() => view.dispose());
  assert.equal(document.querySelector('img'), null);
  assert.match(document.querySelector('article').textContent, /<img src=x/);
  assert.equal(
    document.querySelectorAll('.gev-aircraft-metrics > div').length,
    0,
  );
  assert.equal(document.querySelectorAll('button').length, 2);
  assert.ok(
    [...document.querySelectorAll('button')].every((button) => button.disabled),
  );
  view.update({
    presentation: aircraftPresentation({
      icao24: 'abc',
      altitudeM: 3048,
      stale: true,
    }),
  });
  assert.match(document.querySelector('article').textContent, /10,000\u00a0ft/);
  assert.equal(document.querySelector('.gev-aircraft-route'), null);
  assert.match(document.querySelector('footer').textContent, /Stale source/);
});

test('the real slot rests, remounts with the latest target, and releases the card', (t) => {
  const slot = createSelectionSlot({ document });
  document.body.append(slot.body);
  let listener;
  let info = { icao24: 'a', callsign: 'First' };
  const viewer = {
    trackedEntity: { gevTrackedId: 'flights:a' },
    trackedEntityChanged: {
      addEventListener(fn) {
        listener = fn;
        return () => {};
      },
    },
  };
  let timers = 0;
  const disconnect = connectAircraftSlot({
    slot,
    viewer,
    events: window,
    layers: { flights: { getTrackedInfo: () => info } },
    readSelectedContext: () => null,
    subscribePresentation: () => () => {},
    mount: (body, props) => mountView(AircraftCard, { parent: body, props }),
    schedule: () => ++timers,
    cancel: () => --timers,
  });
  t.after(() => {
    disconnect();
    slot.destroy();
  });
  assert.ok(document.querySelector('.gev-aircraft-card'));
  assert.equal(timers, 1);
  slot.setActive(false);
  assert.equal(document.querySelector('.gev-aircraft-card'), null);
  assert.equal(timers, 0);
  info = { icao24: 'b', callsign: 'Second', registration: 'NEW-REG' };
  viewer.trackedEntity = { gevTrackedId: 'flights:b' };
  listener();
  slot.setActive(true);
  assert.equal(slot.channel.getSnapshot().item.title, 'Second');
  assert.match(document.querySelector('article').textContent, /NEW-REG/);
  assert.equal(timers, 1);
  slot.show({ id: 'camera' });
  assert.equal(document.querySelector('.gev-aircraft-card'), null);
  assert.equal(timers, 0);
});
