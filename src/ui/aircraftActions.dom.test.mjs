import '../testSupport/componentDom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { StyleManager } = await import('./applicationShell.js');

test('card actions preserve Cockpit eligibility and refuse unsupported receiver subjects', () => {
  const shell = {
    getCockpitState: () => ({
      entryAllowed: false,
      entryBlockedReason: 'contacts-inactive',
      subject: { layerId: 'flights', id: 'abc' },
    }),
    getContextModeState: () => ({ changing: false }),
  };
  const read = () =>
    StyleManager.prototype._aircraftActionAvailability.call(shell, {
      layerId: 'flights',
      icao: 'abc',
    });
  assert.equal(read().cockpit, false);
  assert.equal(read().cockpitReason, 'Open Contacts to enter Cockpit');
  shell.getCockpitState = () => ({
    entryAllowed: true,
    subject: { layerId: 'flights', id: 'abc' },
  });
  assert.equal(read().cockpit, true);
  const local = StyleManager.prototype._aircraftActionAvailability.call(shell, {
    layerId: 'local-adsb',
    icao: 'abc',
  });
  assert.equal(local.cockpit, false);
  assert.equal(local.contacts, false);
});

test('Contacts explicitly enters the existing session, focuses the requested aircraft and reveals Inspect', async () => {
  const calls = [];
  const shell = {
    setContextMode: async (mode) => {
      calls.push(['mode', mode]);
      return { ok: true };
    },
    services: {
      militaryAwarenessLayer: {
        focusTarget: (...args) => {
          calls.push(['focus', ...args]);
          return true;
        },
      },
    },
    _contextControls: { showInspectTab: (tab) => calls.push(['tab', tab]) },
    setPanelCollapsed: (...args) => calls.push(['panel', ...args]),
    _drawer: { open: (id) => calls.push(['drawer', id]) },
  };
  assert.equal(
    await StyleManager.prototype._openAircraftContacts.call(
      shell,
      { layerId: 'military', icao: 'abc' },
      () => true,
    ),
    true,
  );
  assert.deepEqual(calls.slice(0, 3), [
    ['mode', 'contacts'],
    ['focus', 'military', 'abc', { origin: 'user' }],
    ['tab', 'context'],
  ]);
  assert.deepEqual(calls.at(-1), ['drawer', 'inspect']);
});

test('a superseded Contacts request cannot refocus the old aircraft', async () => {
  let current = true;
  const shell = {
    setContextMode: async () => {
      current = false;
      return { ok: true };
    },
    services: {
      militaryAwarenessLayer: {
        focusTarget() {
          throw Error('stale focus');
        },
      },
    },
  };
  assert.equal(
    await StyleManager.prototype._openAircraftContacts.call(
      shell,
      { layerId: 'flights', icao: 'abc' },
      () => current,
    ),
    false,
  );
});
