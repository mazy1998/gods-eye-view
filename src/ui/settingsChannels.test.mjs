import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalePickerModel } from './localePicker.js';
import { createVoicePreferences } from '../voice/panel/preferences.js';

test('the locale picker publishes each change a view would show, and no-ops publish nothing', () => {
  const model = createLocalePickerModel({
    locales: ['en', 'es', 'ru'],
    current: 'en',
    nativeNames: { en: 'English', es: 'Español', ru: 'Русский' },
  });
  const seen = [];
  model.channel.subscribe(({ state }) => seen.push(state), { emitCurrent: false });
  model.openList();
  model.keydown({ key: 'ArrowDown' });
  model.setActive(99); // out of range: nothing changes
  model.keydown({ key: 'Tab' }); // not handled: nothing changes
  model.closeList();
  assert.deepEqual(
    seen.map(({ open, activeCode }) => [open, activeCode]),
    [
      [true, 'en'],
      [true, seen[1].visible[1]],
      [false, seen[1].visible[1]],
    ],
  );
  assert.deepEqual(seen[0].visible, ['en', ...seen[0].visible.slice(1)]);
});

test('voice preferences publish once per applied change, from browser-local state only', () => {
  const store = new Map();
  const preferences = createVoicePreferences({
    storage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
    },
  });
  const seen = [];
  preferences.channel.subscribe(({ state, change }) => seen.push([state, change]), {
    emitCurrent: false,
  });
  preferences.setMinutes(10);
  preferences.setMinutes('abc'); // invalid: not applied, not published
  preferences.setPreviewEnabled(false);
  assert.deepEqual(
    seen.map(([state, change]) => [state.minutes, state.previewEnabled, change.field]),
    [
      [10, true, 'minutes'],
      [10, false, 'previewEnabled'],
    ],
  );
});
