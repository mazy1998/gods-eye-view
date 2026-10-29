import assert from 'node:assert/strict';
import test from 'node:test';
import { LocationField } from './locationField.js';

test('draft and disclosure survive a replaced input without reading stale DOM', () => {
  const first = {
    value: '',
    classList: {
      toggle() {},
      contains() {
        return false;
      },
    },
    focus() {},
    blur() {},
  };
  const owner = new LocationField(first);
  owner.edit('geo:39.7,-104.9');
  owner.toggle();
  first.value = 'stale DOM';
  assert.equal(owner.getState().query, 'geo:39.7,-104.9');
  const replacement = { ...first, value: '' };
  owner.input = replacement;
  owner.set({});
  assert.equal(
    replacement.value,
    '',
    'only a subscribed view paints the input',
  );
  assert.equal(owner.getState().query, 'geo:39.7,-104.9');
  assert.equal(owner.getState().expanded, true);
  owner.set({ error: 'Previous error' });
  owner.close();
  assert.equal(owner.getState().error, '');
  assert.equal(replacement.value, '');
  assert.equal(owner.getState().expanded, false);
  owner.destroy();
  owner.edit('late edit');
  assert.equal(owner.getState().query, '');
});
