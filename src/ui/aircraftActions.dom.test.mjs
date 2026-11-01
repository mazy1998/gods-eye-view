import '../testSupport/componentDom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const { StyleManager } = await import('./applicationShell.js');

test('card actions allow explicit Cockpit preparation and refuse unsupported receiver subjects', () => {
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
  assert.equal(read().cockpit, true);
  assert.equal(read().cockpitReason, '');
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

test('one Cockpit click waits for Contacts, keeps the aircraft and enters only after the gate opens', async () => {
  const calls = [];
  let settle,
    ready = false,
    focused = null;
  const shell = {
    getCockpitState: () => ({
      entryAllowed: ready && focused === 'abc',
      subject: { layerId: 'flights', id: 'abc' },
    }),
    setContextMode: (mode) => {
      calls.push(['mode', mode]);
      return new Promise((resolve) => {
        settle = () => {
          ready = true;
          resolve({ ok: true });
        };
      });
    },
    services: {
      militaryAwarenessLayer: {
        focusTarget: (layer, id, options) => {
          calls.push(['focus', layer, id, options]);
          focused = id;
          return true;
        },
      },
    },
    _contextControls: { showInspectTab() {} },
    setPanelCollapsed() {},
    _drawer: { open() {} },
    cockpitView: {
      enter() {
        assert.equal(ready, true);
        assert.equal(focused, 'abc');
        calls.push(['cockpit']);
        return true;
      },
    },
    _showToast() {
      throw Error('unexpected failure notice');
    },
  };
  shell._openAircraftContacts = (...args) =>
    StyleManager.prototype._openAircraftContacts.call(shell, ...args);
  const pending = StyleManager.prototype._enterAircraftCockpit.call(
    shell,
    { layerId: 'flights', icao: 'abc' },
    () => true,
  );
  assert.deepEqual(calls, [['mode', 'contacts']]);
  settle();
  assert.equal(await pending, true);
  assert.deepEqual(calls, [
    ['mode', 'contacts'],
    ['focus', 'flights', 'abc', { origin: 'user' }],
    ['cockpit'],
  ]);
  const notices = [];
  shell._showToast = (message) => notices.push(message);
  for (const entry of [
    () => false,
    () => {
      throw Error('target gone');
    },
  ]) {
    shell.cockpitView.enter = entry;
    assert.equal(
      await StyleManager.prototype._enterAircraftCockpit.call(
        shell,
        { layerId: 'flights', icao: 'abc' },
        () => true,
      ),
      false,
    );
  }
  assert.deepEqual(
    notices,
    Array(2).fill(
      'Contacts could not complete the requested transition; try again',
    ),
  );
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
